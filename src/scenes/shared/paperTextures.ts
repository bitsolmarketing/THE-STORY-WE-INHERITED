import { CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three'

/**
 * Procedural paper grain shared by the opening paper and the chronicle table.
 * RGBA tile: R = fibre/grain height, G,B = surface normal (x, z) for raking light, A = stain noise.
 * Generated once on the CPU, tiled in world space by the shaders. Deterministic (no shimmer).
 */
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function valueNoise(size: number, cells: number, rnd: () => number): Float32Array {
  const grid = new Float32Array((cells + 1) * (cells + 1))
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  // Tileable: wrap the last row/column.
  for (let i = 0; i <= cells; i++) {
    grid[i * (cells + 1) + cells] = grid[i * (cells + 1)]
    grid[cells * (cells + 1) + i] = grid[i]
  }
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cells
    const iy = Math.floor(gy)
    const fy = gy - iy
    const sy = fy * fy * (3 - 2 * fy)
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells
      const ix = Math.floor(gx)
      const fx = gx - ix
      const sx = fx * fx * (3 - 2 * fx)
      const a = grid[iy * (cells + 1) + ix]
      const b = grid[iy * (cells + 1) + ix + 1]
      const c = grid[(iy + 1) * (cells + 1) + ix]
      const d = grid[(iy + 1) * (cells + 1) + ix + 1]
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }
  }
  return out
}

export function createGrainTexture(size: number): DataTexture {
  const rnd = lcg(1947)
  const h = new Float32Array(size * size)
  const octaves: [number, number][] = [
    [4, 0.35],
    [16, 0.25],
    [64, 0.22],
    [size / 2, 0.18],
  ]
  for (const [cells, amp] of octaves) {
    const n = valueNoise(size, Math.max(2, Math.round(cells)), rnd)
    for (let i = 0; i < h.length; i++) h[i] += n[i] * amp
  }
  // Fibres: long, thin, slightly curved strokes pressed into the sheet.
  const fibres = Math.round(size * 0.9)
  for (let f = 0; f < fibres; f++) {
    let x = rnd() * size
    let y = rnd() * size
    let ang = rnd() * Math.PI * 2
    const length = 12 + rnd() * size * 0.08
    const depth = 0.05 + rnd() * 0.09
    for (let s = 0; s < length; s++) {
      ang += (rnd() - 0.5) * 0.18
      x += Math.cos(ang)
      y += Math.sin(ang)
      const xi = ((Math.round(x) % size) + size) % size
      const yi = ((Math.round(y) % size) + size) % size
      h[yi * size + xi] += depth
    }
  }
  let lo = Infinity
  let hi = -Infinity
  for (const v of h) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const stains = valueNoise(size, 3, rnd)
  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => (h[(((y + size) % size) * size + ((x + size) % size))] - lo) / (hi - lo)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const hv = at(x, y)
      const dx = at(x + 1, y) - at(x - 1, y)
      const dy = at(x, y + 1) - at(x, y - 1)
      data[i] = Math.round(hv * 255)
      data[i + 1] = Math.round(Math.max(0, Math.min(1, 0.5 - dx * 3.5)) * 255)
      data[i + 2] = Math.round(Math.max(0, Math.min(1, 0.5 - dy * 3.5)) * 255)
      data[i + 3] = Math.round(stains[y * size + x] * 255)
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/** A soft height field of text (e.g. "1947") for embossing, blurred so the relief has shoulders. */
export function createEmbossTexture(text: string, width = 1024, height = 424): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${Math.round(height * 0.92)}px "Cormorant Garamond", Georgia, serif`
  ctx.filter = 'blur(5px)'
  ctx.fillText(text, width / 2, height * 0.54)
  ctx.filter = 'blur(1.5px)'
  ctx.fillText(text, width / 2, height * 0.54)
  const tex = new CanvasTexture(c)
  tex.flipY = false
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = false
  return tex
}
