/**
 * Restores and upscales every original in assets-src/archive/ into an ENHANCED master in
 * assets-src/enhanced/ (same filename). The originals are read only and never overwritten.
 *
 *   npm run enhance:archive          (skips masters that are already up to date)
 *   npm run enhance:archive -- --force
 *
 * Method — deterministic restoration, never generative:
 *  - Upscale with a Lanczos-3 kernel to at least MASTER_LONG_EDGE px on the long edge (originals
 *    already larger are kept at their own size), so the film can push in, crop and parallax at
 *    full-screen high-density sizes without visible pixels.
 *  - Small, heavily compressed JPEGs get a very light pre-blur (σ 0.45) before enlargement so
 *    8×8 compression blocks are softened instead of being magnified.
 *  - Edge-limited unsharp mask after enlargement: flat areas are never sharpened (grain, paper and
 *    skin stay as they are), brightening/darkening is clamped to prevent halos. Graphics (PNG maps,
 *    charts) are only resampled, never sharpened.
 *  - No AI super-resolution: models that "recover" detail generate it, and would invent faces,
 *    text and architecture. Where the original holds no detail, the master stays soft, not fake.
 *
 * Every master's parameters are written to assets-src/enhanced/ENHANCE_LOG.json.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'assets-src/archive')
const OUT = resolve(ROOT, 'assets-src/enhanced')
const LOG = resolve(OUT, 'ENHANCE_LOG.json')
const MASTER_LONG_EDGE = 3840
const FORCE = process.argv.includes('--force')

mkdirSync(OUT, { recursive: true })
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {}

/** Design textures are tooling, not archive material. */
const isTexture = (f) => f.startsWith('tex_')

async function enhance(file) {
  const src = resolve(SRC, file)
  const ext = extname(file).toLowerCase()
  const graphic = ext === '.png'
  const dest = resolve(OUT, graphic ? file : file.replace(/\.[a-z0-9]+$/i, '.jpg'))
  if (!FORCE && existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) return 'skip'

  const meta = await sharp(src).metadata()
  const w0 = meta.width ?? 0
  const h0 = meta.height ?? 0
  const rotated = (meta.orientation ?? 1) >= 5
  const [w, h] = rotated ? [h0, w0] : [w0, h0]
  const long = Math.max(w, h)
  const factor = Math.max(1, MASTER_LONG_EDGE / long)
  const bytesPerPixel = statSync(src).size / Math.max(1, w * h)

  let img = sharp(src, { limitInputPixels: false }).rotate()
  const steps = []
  // Light de-blocking for small, heavily compressed JPEGs only.
  if (!graphic && factor > 1.5 && bytesPerPixel < 0.25) {
    img = img.blur(0.45)
    steps.push('deblock σ0.45')
  }
  if (factor > 1) {
    img = img.resize({ width: Math.round(w * factor), height: Math.round(h * factor), kernel: 'lanczos3' })
    steps.push(`lanczos3 ×${factor.toFixed(2)}`)
    if (!graphic) {
      // Sharpen radius grows gently with the enlargement; flat areas (m1 = 0) are left alone.
      const sigma = Math.min(2.2, 0.6 + 0.45 * Math.log2(factor))
      img = img.sharpen({ sigma, m1: 0, m2: 1.1, x1: 2.5, y2: 8, y3: 14 })
      steps.push(`edge-limited unsharp σ${sigma.toFixed(2)}`)
    }
  } else {
    steps.push('kept at original resolution')
  }
  if (graphic) await img.png({ compressionLevel: 9 }).toFile(dest)
  else await img.jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(dest)

  const out = await sharp(dest).metadata()
  log[file] = { master: dest.slice(ROOT.length + 1).replace(/\\/g, '/'), original: `${w}x${h}`, enhanced: `${out.width}x${out.height}`, steps, at: new Date().toISOString() }
  return 'done'
}

const files = readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f) && !isTexture(f))
let done = 0
let skipped = 0
for (const f of files) {
  try {
    const r = await enhance(f)
    if (r === 'skip') skipped++
    else done++
  } catch (e) {
    log[f] = { error: String(e.message ?? e) }
    console.warn(`failed ${f}: ${e.message}`)
  }
}
writeFileSync(LOG, JSON.stringify(log, null, 1))
console.log(`enhanced ${done}, up to date ${skipped}, of ${files.length} originals → ${OUT}`)
