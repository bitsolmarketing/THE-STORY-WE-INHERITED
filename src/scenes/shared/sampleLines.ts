import type { Line } from '@/data/geo/geo'

/** Deterministic PRNG so particle layouts are identical every visit. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface LineSample {
  x: number
  z: number
  /** Unit normal (perpendicular to the line). */
  nx: number
  nz: number
}

/** Samples points uniformly by length along a set of polylines. */
export function sampleLines(lines: Line[], count: number, random: () => number, weight?: (x: number, z: number) => number): LineSample[] {
  const segs: { ax: number; az: number; bx: number; bz: number; len: number }[] = []
  let total = 0
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [ax, az] = l[i - 1]
      const [bx, bz] = l[i]
      const w = weight ? weight((ax + bx) / 2, (az + bz) / 2) : 1
      const len = Math.hypot(bx - ax, bz - az) * w
      if (len <= 0) continue
      segs.push({ ax, az, bx, bz, len })
      total += len
    }
  }
  const cum: number[] = []
  let acc = 0
  for (const s of segs) cum.push((acc += s.len))
  const out: LineSample[] = []
  for (let i = 0; i < count; i++) {
    const r = random() * total
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < r) lo = mid + 1
      else hi = mid
    }
    const s = segs[lo]
    const t = random()
    const dx = s.bx - s.ax
    const dz = s.bz - s.az
    const dl = Math.hypot(dx, dz) || 1
    out.push({ x: s.ax + dx * t, z: s.az + dz * t, nx: -dz / dl, nz: dx / dl })
  }
  return out
}
