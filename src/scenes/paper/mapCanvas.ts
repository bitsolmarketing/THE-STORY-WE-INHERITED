import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three'
import { GEO, type Line } from '@/data/geo/geo'
import { MAP } from '@/scenes/world/layout'

/**
 * Paints the 1947 map into textures (Natural Earth via build-geo; contemporary 1947 names).
 *
 * mapTex (RGB used as three grayscale layers, composited with 'lighter'):
 *   R  outline of the land (coast + safe frontiers) — what the dust becomes
 *   G  map detail: graticule, rivers, towns, lettering, cartouche — soaked in by paperReveal
 *   B  land mask — a faint parchment tint that separates land from sea
 * stateTex (smaller):
 *   R  the two wings of the new state on 14 August 1947 (soft-masked out of Jammu & Kashmir)
 *   G  side mask for the partition split (hard)
 *
 * The partition line itself is NOT painted here: it is ink geometry (crisp at any zoom).
 */
const x0 = MAP.center[0] - MAP.size / 2
const z0 = MAP.center[1] - MAP.size / 2

function makeCanvas(size: number) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  return { c, ctx }
}

function tracer(ctx: CanvasRenderingContext2D, size: number) {
  const k = size / MAP.size
  const px = (x: number) => (x - x0) * k
  const pz = (z: number) => (z - z0) * k
  return {
    k,
    px,
    pz,
    path(line: Line, close = false) {
      ctx.beginPath()
      line.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))))
      if (close) ctx.closePath()
    },
  }
}

function toTexture(c: HTMLCanvasElement, mips = true): CanvasTexture {
  const t = new CanvasTexture(c)
  t.flipY = false
  t.generateMipmaps = mips
  t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter
  t.magFilter = LinearFilter
  t.anisotropy = 8
  return t
}

export function createMapTexture(size: number): CanvasTexture {
  const { c, ctx } = makeCanvas(size)
  const t = tracer(ctx, size)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = 'lighter'

  // B — land tint.
  ctx.fillStyle = 'rgb(0,0,255)'
  for (const ring of GEO.landRings) {
    t.path(ring, true)
    ctx.fill()
  }

  // R — outline of the land.
  ctx.strokeStyle = 'rgb(255,0,0)'
  ctx.lineWidth = Math.max(1.5, 0.17 * t.k)
  for (const l of GEO.coast) {
    t.path(l)
    ctx.stroke()
  }
  // Frontiers: solid and lighter than the coast (dashes smear when the camera comes close).
  ctx.strokeStyle = 'rgb(150,0,0)'
  ctx.lineWidth = Math.max(1.2, 0.1 * t.k)
  for (const l of GEO.contextSafe) {
    t.path(l)
    ctx.stroke()
  }
  // The neighbours' own settled frontiers (Afghanistan–Iran, the Soviet frontier): quieter still,
  // so the subcontinent reads as part of a continent rather than an island.
  ctx.strokeStyle = 'rgb(105,0,0)'
  ctx.lineWidth = Math.max(1, 0.08 * t.k)
  for (const l of GEO.neighbourBorders) {
    t.path(l)
    ctx.stroke()
  }

  // G — detail. Graticule first, faint.
  ctx.strokeStyle = 'rgba(0,44,0,1)'
  ctx.lineWidth = Math.max(1, 0.05 * t.k)
  for (const l of GEO.graticule) {
    t.path(l)
    ctx.stroke()
  }
  // Rivers of the plains (the Indus and the five rivers of the Punjab), thin and quiet.
  ctx.strokeStyle = 'rgba(0,96,0,1)'
  ctx.lineWidth = Math.max(1, 0.07 * t.k)
  for (const line of GEO.plainsRivers) {
    t.path(line)
    ctx.stroke()
  }
  // Coastal water lines: two faint echoes offshore read as an engraved coast.
  ctx.strokeStyle = 'rgba(0,38,0,1)'
  for (const w of [0.55, 1.15]) {
    ctx.lineWidth = Math.max(1, w * t.k)
    for (const l of GEO.coast) {
      t.path(l)
      ctx.stroke()
    }
  }

  // Towns: a dot and an italic name (1947 spellings).
  ctx.textBaseline = 'middle'
  for (const city of GEO.cities) {
    const r = (city.size === 3 ? 0.36 : city.size === 2 ? 0.28 : 0.2) * t.k
    ctx.fillStyle = 'rgb(0,255,0)'
    ctx.beginPath()
    ctx.arc(t.px(city.x), t.pz(city.z), r, 0, Math.PI * 2)
    ctx.fill()
    const fs = (city.size === 3 ? 1.45 : city.size === 2 ? 1.2 : 0.98) * t.k
    ctx.font = `italic 500 ${fs}px "Cormorant Garamond", Georgia, serif`
    ctx.fillStyle = 'rgb(0,225,0)'
    // Amritsar sits right next to Lahore: set its name to the east, Lahore's to the west.
    const west = city.name === 'Lahore' || city.name === 'Karachi' || city.name === 'Quetta'
    ctx.textAlign = west ? 'right' : 'left'
    ctx.fillText(city.name, t.px(city.x) + (west ? -1 : 1) * r * 2.2, t.pz(city.z) - r * 0.4)
  }

  // Regions and seas: spaced capitals.
  ctx.textAlign = 'center'
  // Neighbouring states are lettered larger and lighter than the provinces of British India; the
  // note marks the northern frontier that no 1947 map could draw.
  const STYLE = {
    sea: { fs: 1.9, font: 'italic 400', ink: 'rgb(0,130,0)', track: 0.5 },
    region: { fs: 1.35, font: '500', ink: 'rgb(0,150,0)', track: 0.42 },
    country: { fs: 1.6, font: '500', ink: 'rgb(0,120,0)', track: 0.62 },
    note: { fs: 0.95, font: 'italic 400', ink: 'rgb(0,110,0)', track: 0.12 },
  } as const
  for (const label of GEO.labels) {
    const s = STYLE[label.kind]
    ctx.font = `${s.font} ${s.fs * t.k}px "Cormorant Garamond", Georgia, serif`
    ctx.fillStyle = s.ink
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${s.track * t.k}px`
    ctx.fillText(label.name, t.px(label.x), t.pz(label.z))
  }
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'

  // Cartouche, lower right (south of the Bay of Bengal), clear of the film's caption.
  const cx = t.px(58)
  const cz = t.pz(66)
  ctx.strokeStyle = 'rgb(0,170,0)'
  ctx.lineWidth = Math.max(1, 0.08 * t.k)
  ctx.strokeRect(cx - 11 * t.k, cz - 4.2 * t.k, 22 * t.k, 8.4 * t.k)
  ctx.lineWidth = Math.max(1, 0.04 * t.k)
  ctx.strokeRect(cx - 10.4 * t.k, cz - 3.6 * t.k, 20.8 * t.k, 7.2 * t.k)
  ctx.fillStyle = 'rgb(0,220,0)'
  ctx.font = `500 ${1.7 * t.k}px "Cormorant Garamond", Georgia, serif`
  ctx.fillText('THE SUBCONTINENT', cx, cz - 1.1 * t.k)
  ctx.font = `italic 400 ${1.25 * t.k}px "Cormorant Garamond", Georgia, serif`
  ctx.fillStyle = 'rgb(0,170,0)'
  ctx.fillText('in the year 1947', cx, cz + 1.5 * t.k)

  return toTexture(c)
}

export function createStateTexture(size: number): CanvasTexture {
  const { c, ctx } = makeCanvas(size)
  const t = tracer(ctx, size)
  const wings = [...GEO.regionRings.pakistan, ...GEO.regionRings.bangladesh]

  // G — hard side mask (Pakistan side = 1) for the split.
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgb(0,255,0)'
  for (const ring of wings) {
    t.path(ring, true)
    ctx.fill()
  }

  // R — the wash: same wings, softened, then cut out of Jammu & Kashmir with a blurred mask.
  const wash = makeCanvas(size)
  const tw = tracer(wash.ctx, size)
  wash.ctx.fillStyle = '#f00'
  wash.ctx.filter = `blur(${Math.max(1, 0.35 * tw.k)}px)`
  for (const ring of wings) {
    tw.path(ring, true)
    wash.ctx.fill()
  }
  wash.ctx.filter = `blur(${Math.max(2, 1.6 * tw.k)}px)`
  wash.ctx.globalCompositeOperation = 'destination-out'
  wash.ctx.fillStyle = '#000'
  tw.path(GEO.kashmirMask, true)
  wash.ctx.fill()
  wash.ctx.globalCompositeOperation = 'source-over'
  wash.ctx.filter = 'none'
  ctx.drawImage(wash.c, 0, 0)

  return toTexture(c, false)
}
