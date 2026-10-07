import { useEffect, useMemo } from 'react'

/** A 256px tiled monochrome noise tile as a data URL, multiplied over everything at low opacity. */
function makeGrainDataUrl(size = 256): string {
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(size, size)
  const d = img.data
  // Deterministic LCG so the tile is identical every boot (no shimmer on re-mount).
  let seed = 1947
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < d.length; i += 4) {
    const v = 225 + Math.floor(rnd() * 30)
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

/** Film grain over the stage, and the same grain made available to the paper layers (--grain-url). */
export function GrainVeil() {
  const url = useMemo(() => makeGrainDataUrl(), [])
  useEffect(() => {
    if (url) document.documentElement.style.setProperty('--grain-url', `url(${url})`)
  }, [url])
  return <div className="grain-veil" aria-hidden="true" style={{ backgroundImage: url ? `url(${url})` : undefined }} />
}
