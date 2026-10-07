/**
 * Fetches web-size originals for the archive's preview-only records (approved by the project owner,
 * 3 Oct 2026): only rows whose rights status is CLEAR or LIKELY CLEAR, and only from Wikimedia
 * Commons' file servers (upload.wikimedia.org). Rows marked VERIFY BEFORE PUBLIC USE are never
 * requested. Files are saved under the manifest's own filename in assets-src/archive/, then
 * `npm run import:archive` builds web sizes and links them to their (unchanged) metadata.
 *
 *   node scripts/fetch-archive.mjs            (resumable: existing files are skipped)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'assets-src/archive')
const LOG = resolve(ROOT, 'docs/archive/FETCH_LOG.json')
const WIDTH = 1600
// Wikimedia rate-limits bursts (HTTP 429): one request at a time, spaced, with backoff.
const CONCURRENCY = 1
// 1.3 s still drew 429s on 3 Oct 2026; 3 s keeps a full run under the limit.
const SPACING_MS = 3000
const UA = 'InheritedVisualHistory/1.0 (non-commercial student competition project; archive fetch of CC/PD files)'

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''))
  const keys = header.map((h) => h.replace(/^﻿/, '').trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

function commonsName(downloadUrl) {
  const m = /Special:FilePath\/([^?]+)/.exec(downloadUrl)
  if (!m) return null
  return decodeURIComponent(m[1]).replace(/ /g, '_')
}

/** Thumbnail URL forms: rasters scale directly; SVG renders to PNG; DjVu/PDF render page 1 to JPEG. */
function thumbUrl(path, name) {
  const enc = encodeURIComponent(name)
  if (/\.svg$/i.test(name)) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${WIDTH}px-${enc}.png`
  if (/\.(djvu|pdf|tiff?)$/i.test(name)) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/page1-${WIDTH}px-${enc}.jpg`
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${WIDTH}px-${enc}`
}

function hashedPath(name) {
  const md5 = createHash('md5').update(name, 'utf8').digest('hex')
  return `${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(name).replace(/%2F/g, '/')}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt < 5) {
    const retry = Number(res.headers.get('retry-after')) || 0
    await sleep(Math.max(retry * 1000, 4000 * 2 ** attempt))
    return get(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

const rows = parseCsv(readFileSync(resolve(ROOT, 'docs/archive/MASTER_IMAGE_MANIFEST.csv'), 'utf8'))
const todo = rows.filter(
  (r) => r.zip_contents.startsWith('PREVIEW') && !r.license_status.toUpperCase().startsWith('VERIFY') && /commons\.wikimedia\.org/.test(r.download_url),
)
mkdirSync(OUT, { recursive: true })
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {}
let done = 0
let failed = 0

async function worker(queue) {
  for (;;) {
    const r = queue.shift()
    if (!r) return
    const dest = resolve(OUT, r.filename)
    if (existsSync(dest)) {
      done++
      continue
    }
    const name = commonsName(r.download_url)
    if (!name) {
      failed++
      log[r.filename] = { status: 'skipped', reason: 'no Commons file name' }
      continue
    }
    const path = hashedPath(name)
    const thumb = thumbUrl(path, name)
    const original = `https://upload.wikimedia.org/wikipedia/commons/${path}`
    // Most catalogued images are modest rasters: fetch the original directly (thumbnails are
    // rate-limited, and are refused for files smaller than the requested width). Large or
    // non-raster files go through the thumbnail renderer.
    const dims = /^(\d+)\s*x\s*(\d+)$/i.exec(r.dimensions || '')
    const raster = !/\.(svg|djvu|pdf|tiff?)$/i.test(name)
    const small = dims ? Math.max(Number(dims[1]), Number(dims[2])) <= 2600 : false
    const order = raster && small ? [original, thumb] : raster ? [thumb, original] : [thumb]
    try {
      let buf
      let from
      let lastError
      for (const url of order) {
        try {
          buf = await get(url)
          from = url
          break
        } catch (e) {
          lastError = e
          await sleep(SPACING_MS)
        }
      }
      if (!buf) throw lastError
      writeFileSync(dest, buf)
      log[r.filename] = { status: 'ok', from, bytes: buf.length, fetchedAt: new Date().toISOString() }
      done++
    } catch (e) {
      failed++
      log[r.filename] = { status: 'failed', error: String(e.message ?? e) }
    }
    writeFileSync(LOG, JSON.stringify(log, null, 1))
    if ((done + failed) % 20 === 0) console.log(`... ${done + failed}/${todo.length}`)
    await sleep(SPACING_MS)
  }
}

const queue = [...todo]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))
writeFileSync(LOG, JSON.stringify(log, null, 1))
console.log(`fetched/present ${done}, failed ${failed}, of ${todo.length}`)
