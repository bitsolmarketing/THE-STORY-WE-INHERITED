/**
 * Imports the research visual archive (docs/archive/MASTER_IMAGE_MANIFEST.csv) into the frontend's
 * archive contract (src/data/archive/assets.json) and builds web sizes of every full-resolution
 * original found in assets-src/archive/ into public/assets/archive/.
 *
 *   npm run import:archive
 *
 * Rules (spec §17, brief STEP 08):
 *  - Every manifest row becomes an archive record, with source, licence, rights status and
 *    authenticity class carried over verbatim. Nothing is upgraded or silently re-labelled.
 *  - Only rows whose original file exists locally get an image. Preview-only rows stay
 *    metadata records (the UI renders them as typographic document frames with a source link).
 *  - Images are resized and re-encoded only. No grading, cropping or retouching of the originals.
 *  - The manifest's ~190 px previews are never published (the archive README forbids it).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs'
import { dirname, resolve, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MANIFEST = resolve(ROOT, 'docs/archive/MASTER_IMAGE_MANIFEST.csv')
const ORIGINALS = resolve(ROOT, 'assets-src/archive')
const OUT_IMG = resolve(ROOT, 'public/assets/archive')
const OUT_JSON = resolve(ROOT, 'src/data/archive/assets.json')

/** JPEG sizes per image: archive detail, in-film texture (and its high-density twin), thumbnail. */
const SIZES = { detail: 1600, film: 1024, filmHi: 2048, thumb: 400 }
/** WebP widths for responsive delivery (archive detail, full-screen and cinematic push-ins). */
const WEBP_WIDTHS = [1024, 1600, 2560, 3840]
/** Restored masters (scripts/enhance-archive.mjs); the untouched original is used when absent. */
const ENHANCED = resolve(ROOT, 'assets-src/enhanced')

function masterFor(filename) {
  for (const name of [filename, filename.replace(/\.[a-z0-9]+$/i, '.jpg')]) {
    const p = resolve(ENHANCED, name)
    if (existsSync(p)) return p
  }
  return resolve(ORIGINALS, filename)
}

/** Minimal RFC 4180 CSV parser (quoted fields, embedded commas/newlines, "" escapes). */
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

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Manifest image_type + authenticity → the spec's archive asset types. */
function assetType(r) {
  const t = r.image_type
  const auth = r.historical_authenticity.toUpperCase()
  const name = r.filename.toLowerCase()
  if (t.startsWith('C')) return 'newspaper'
  if (t.startsWith('F')) return 'map'
  if (t.startsWith('G')) return 'texture'
  if (auth.includes('STAMP') || name.includes('stamp')) return 'stamp'
  if (t.startsWith('D')) return auth.includes('PHOTOGRAPH') ? 'photograph' : 'document'
  return 'photograph'
}

function rightsStatus(s) {
  const u = s.toUpperCase()
  if (u.startsWith('VERIFY')) return 'verify'
  if (u.startsWith('OWNER SUPPLIED')) return 'owner-supplied'
  if (u.startsWith('LIKELY CLEAR')) return 'likely-clear'
  if (u.startsWith('CLEAR')) return 'clear'
  return 'verify'
}

/** The brief's material classes. Reconstruction/stand-in wins over rights: it is about what the image IS. */
function materialClass(r) {
  const a = r.historical_authenticity.toUpperCase()
  if (/RECONSTRUCTION|ARTWORK|ILLUSTRATION|COMPILATION/.test(a)) return 'reconstruction'
  if (/STAND-IN/.test(a)) return 'stand-in'
  if (/^MODERN|VIDEO FRAME|DATA VISUALIZATION|TEXTURE/.test(a)) return 'contextual'
  return 'historical'
}

function yearOf(r) {
  const m = /^(\d{4})/.exec(r.date)
  if (m) return Number(m[1])
  const e = /^(\d{4})/.exec(r.year)
  return e ? Number(e[1]) : 0
}

/** Archive file names that are catalogue numbers rather than titles (IA PROPIX ids, NASA frame ids…). */
const MACHINE_TITLE = /PROPIX|DVIDS|^NASA [a-z]*\d|^NASA GSFC|^iss\d|^PD |DSC \d|IMG \d|^\d{4} \d{2} \d{2}|^US Navy \d|^TC-\d|^\d+$/i

function cleanCatalogueSuffixes(t) {
  return t
    .replace(/\s*-\s*DPLA\s*-\s*[0-9a-f]{16,}$/i, '')
    .replace(/\s*-\s*NARA\s*-\s*\d+$/i, '')
    .replace(/\s*\(\d{8,}\)$/, '')
    .replace(/,\s*RP-F-[A-Z0-9-]+$/i, '')
    .replace(/\s*TMnr \d+$/i, '')
    .replace(/^COLLECTIE TROPENMUSEUM\s*/i, '')
    .trim()
}

/** First sentence of a researcher's description, without the trailing "— handling note". */
function firstClause(text) {
  const s = text
    .split(/(?<=[a-z0-9)])\.\s/)[0]
    .split(' — ')[0]
    .replace(/\.$/, '')
    .trim()
  return s.length > 110 ? `${s.slice(0, 107).replace(/\s+\S*$/, '')}…` : s
}

function titleOf(r) {
  // Owner-supplied records: the reviewed caption, without its "(… not recorded)" qualifier.
  if (r.original) return firstClause(r.description.replace(/\s*\([^)]*not (recorded|identified|visible)[^)]*\)/g, ''))
  const raw = r.source_file_title ? r.source_file_title.replace(/\.[a-z0-9]+$/i, '') : basename(r.filename, extname(r.filename))
  let t = cleanCatalogueSuffixes(raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
  if (MACHINE_TITLE.test(t) && r.description) t = firstClause(r.description)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const httpOrUndefined = (u) => (/^https?:\/\//i.test(u) ? u : undefined)

async function buildImages(r, id) {
  if (!existsSync(resolve(ORIGINALS, r.filename))) return null
  const src = masterFor(r.filename)
  try {
    const built = await buildImagesFrom(src, id)
    // Report the original's own dimensions (the record describes the source, not our master).
    const orig = await sharp(resolve(ORIGINALS, r.filename)).metadata()
    return { ...built, width: orig.width, height: orig.height, enhanced: src.startsWith(ENHANCED) }
  } catch (e) {
    // An unreadable or half-written original is skipped (the record stays metadata-only).
    console.warn(`skipped image for ${r.filename}: ${e.message}`)
    return null
  }
}

/** An output newer than its master is kept (re-runs only rebuild what changed). */
const fresh = (out, src) => existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs

async function buildImagesFrom(src, id) {
  const meta = await sharp(src).metadata()
  const paths = {}
  for (const [key, size] of Object.entries(SIZES)) {
    const file = `${id}-${size}.jpg`
    paths[key] = `/assets/archive/${file}`
    if (fresh(resolve(OUT_IMG, file), src)) continue
    await sharp(src)
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: key === 'thumb' ? 72 : 80, mozjpeg: true, progressive: true })
      .toFile(resolve(OUT_IMG, file))
  }
  const webp = []
  for (const w of WEBP_WIDTHS) {
    if (w > Math.max(meta.width ?? 0, meta.height ?? 0)) continue
    const file = `${id}-${w}.webp`
    webp.push({ w, path: `/assets/archive/${file}` })
    if (fresh(resolve(OUT_IMG, file), src)) continue
    await sharp(src).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, smartSubsample: true }).toFile(resolve(OUT_IMG, file))
  }
  return { paths, webp, width: meta.width, height: meta.height }
}

/*
 * Images supplied by the project owner (docs/archive/OWNER_SUPPLIED.json), reviewed one by one.
 * The owner's file is copied, never modified, into the originals folder; the record carries the
 * rights the owner must confirm, and a credit that says it was not recorded rather than a guess.
 */
const OWNER = resolve(ROOT, 'docs/archive/OWNER_SUPPLIED.json')
const OWNER_DIR = resolve(ROOT, '../../remaining project pics/remaining project pics')
const OWNER_RIGHTS = 'OWNER SUPPLIED — agency photograph supplied by the project owner; licence to be confirmed by the owner before public release'

function ownerRows() {
  if (!existsSync(OWNER)) return []
  return JSON.parse(readFileSync(OWNER, 'utf8')).records.map((r) => {
    const dest = resolve(ORIGINALS, r.filename)
    const from = resolve(OWNER_DIR, r.original)
    if (!existsSync(dest) && existsSync(from)) copyFileSync(from, dest)
    return {
      source: 'Supplied by the project owner',
      source_url: `Owner's folder — remaining project pics/${r.original}`,
      creator: 'Photographer not recorded',
      license: 'Not recorded',
      attribution_required: 'Yes — credit to be confirmed',
      quality: 'LOW (preview-size original)',
      recommended_use: '',
      notes: 'Replace with the licensed full-resolution file before public release.',
      license_status: OWNER_RIGHTS,
      public_domain: '',
      ...r,
    }
  })
}

const rows = [...parseCsv(readFileSync(MANIFEST, 'utf8')), ...ownerRows()]
mkdirSync(OUT_IMG, { recursive: true })

const seen = new Set()
const assets = []
let withImage = 0
for (const r of rows) {
  const type = assetType(r)
  if (type === 'texture') continue // design textures are tooling, not historical records
  let id = slug(r.filename)
  while (seen.has(id)) id += '-b'
  seen.add(id)

  const img = await buildImages(r, id)
  if (img) withImage++

  assets.push({
    id,
    type,
    title: titleOf(r),
    year: yearOf(r),
    date: r.date || undefined,
    // Non-URL source references (e.g. "Internet Archive — PROPIX item …") stay in `sourceRef`.
    source: r.source,
    url: httpOrUndefined(r.source_url),
    sourceRef: httpOrUndefined(r.source_url) ? undefined : r.source_url || undefined,
    downloadUrl: httpOrUndefined(r.download_url),
    license: r.license || undefined,
    credit: r.creator || undefined,
    attribution: r.attribution_required || undefined,
    description: r.description,
    localPath: img?.paths.detail,
    filmPath: img?.paths.film,
    filmHiPath: img?.paths.filmHi,
    thumbPath: img?.paths.thumb,
    webp: img?.webp,
    enhanced: img?.enhanced || undefined,
    width: img?.width,
    height: img?.height,
    eventIds: [r.event_id],
    rights: {
      status: rightsStatus(r.license_status),
      statement: r.license_status,
      publicDomain: r.public_domain || undefined,
    },
    authenticity: r.historical_authenticity,
    materialClass: materialClass(r),
    imageClass: r.image_type,
    quality: r.quality || undefined,
    recommendedUse: r.recommended_use || undefined,
    notes: r.notes || undefined,
    originalFilename: r.filename,
    provenance: {
      status: img ? 'verified' : 'unverified',
      note: r.original
        ? 'Supplied by the project owner (4 Oct 2026); reviewed against the picture itself. Photographer, agency and licence not recorded.'
        : img
        ? 'Original file held locally (research archive, 3 Oct 2026).'
        : 'Catalogued from the source page; the full-resolution file has not been obtained yet. Open the source link.',
      capturedAt: '2026-10-03',
    },
  })
}

writeFileSync(OUT_JSON, JSON.stringify(assets, null, 1))

/*
 * Film index: per storyboard beat, the images the cinematic layer may show — local file, rights
 * clear / likely clear, real material (never reconstruction or stand-in) — ordered hero → archive →
 * map → newspaper → document → context. Small, so the film can load it synchronously.
 */
const CLASS_ORDER = { A: 0, B: 1, F: 2, C: 3, D: 4, E: 5 }
const filmIndex = {}
for (const a of assets) {
  const usable = a.filmPath && a.rights.status !== 'verify' && a.materialClass !== 'reconstruction' && a.materialClass !== 'stand-in'
  if (!usable) continue
  for (const ev of a.eventIds) {
    ;(filmIndex[ev] ??= []).push({
      id: a.id,
      title: a.title,
      filmPath: a.filmPath,
      filmHiPath: a.filmHiPath,
      thumbPath: a.thumbPath,
      width: a.width,
      height: a.height,
      year: a.year,
      date: a.date,
      credit: a.credit,
      source: a.source,
      materialClass: a.materialClass,
      imageClass: a.imageClass,
      eventIds: a.eventIds,
    })
  }
}
for (const list of Object.values(filmIndex)) {
  list.sort((x, y) => (CLASS_ORDER[x.imageClass?.[0]] ?? 9) - (CLASS_ORDER[y.imageClass?.[0]] ?? 9))
}
writeFileSync(resolve(ROOT, 'src/data/archive/filmIndex.json'), JSON.stringify(filmIndex))
console.log(`film index: ${Object.values(filmIndex).reduce((n, l) => n + l.length, 0)} prints across ${Object.keys(filmIndex).length} beats`)
const byRights = assets.reduce((m, a) => ((m[a.rights.status] = (m[a.rights.status] ?? 0) + 1), m), {})
console.log(`wrote ${assets.length} archive records → ${OUT_JSON}`)
console.log(`images built for ${withImage} originals → ${OUT_IMG}`)
console.log('rights:', byRights)
