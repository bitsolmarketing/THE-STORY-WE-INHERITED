import { PALETTE } from '@/scenes/world/layout'
import { GEO, type Line } from '@/data/geo/geo'
import { rng } from '@/scenes/shared/sampleLines'
import type { MotifFill, MotifLabel, MotifStroke, UV } from './types'

/** Drawing kit for motifs. Everything returns plain data in plate space (u right, v forward/up). */
export const INK = PALETTE.charcoal
export const OLIVE = PALETTE.olive
export const BRASS = PALETTE.brass
export const SAGE = PALETTE.sage
export const TAUPE = PALETTE.taupe
export const SAND = PALETTE.sandstone
export const PARCH = PALETTE.parchment

export type Win = [number, number]

export function stroke(points: UV[], width: number, color: string, window: Win, extra: Partial<MotifStroke> = {}): MotifStroke {
  return { points, width, color, window, ...extra }
}

export function fill(polygon: UV[], color: string, window: Win, extra: Partial<MotifFill> = {}): MotifFill {
  return { polygon, color, window, ...extra }
}

export function label(text: string, at: UV, size: number, window: Win, extra: Partial<MotifLabel> = {}): MotifLabel {
  return { text, at, size, window, ...extra }
}

export function rect(cu: number, cv: number, w: number, h: number): UV[] {
  return [
    [cu - w / 2, cv - h / 2],
    [cu + w / 2, cv - h / 2],
    [cu + w / 2, cv + h / 2],
    [cu - w / 2, cv + h / 2],
  ]
}

/** Closed polyline (first point repeated) for outlining a polygon. */
export function closed(poly: UV[]): UV[] {
  return [...poly, poly[0]]
}

export function ellipse(cu: number, cv: number, ru: number, rv: number, n = 48, a0 = 0, a1 = Math.PI * 2): UV[] {
  const out: UV[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cu + Math.cos(a) * ru, cv + Math.sin(a) * rv])
  }
  return out
}

/** Subdivide a polyline so ink draws on smoothly and wobble has something to bend. */
export function resample(points: UV[], step: number): UV[] {
  const out: UV[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [a0, a1] = points[i - 1]
    const [b0, b1] = points[i]
    const n = Math.max(1, Math.ceil(Math.hypot(b0 - a0, b1 - a1) / step))
    for (let k = 1; k <= n; k++) out.push([a0 + ((b0 - a0) * k) / n, a1 + ((b1 - a1) * k) / n])
  }
  return out
}

/** A hand-drawn tremor (deterministic). */
export function wobble(points: UV[], amp: number, seed = 1): UV[] {
  const r = rng(seed)
  let du = 0
  let dv = 0
  return points.map(([u, v], i) => {
    if (i === 0 || i === points.length - 1) return [u, v]
    du = du * 0.7 + (r() - 0.5) * amp
    dv = dv * 0.7 + (r() - 0.5) * amp
    return [u + du, v + dv]
  })
}

/** A side-view parabola from a to b with apex height h above the chord (diagram on paper). */
export function parabola(a: UV, b: UV, h: number, n = 40): UV[] {
  const out: UV[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * h * t * (1 - t)])
  }
  return out
}

/** Ruled "text" lines of a document: abstract, never legible words. */
export function textLines(cu: number, top: number, width: number, count: number, gap: number, window: Win, seed = 3, color = INK): MotifStroke[] {
  const r = rng(seed)
  const out: MotifStroke[] = []
  for (let i = 0; i < count; i++) {
    const w = width * (i === count - 1 ? 0.45 + r() * 0.2 : 0.82 + r() * 0.18)
    const v = top - i * gap
    const a = window[0] + ((window[1] - window[0]) * i) / count
    const b = window[0] + ((window[1] - window[0]) * (i + 1)) / count
    out.push(stroke(wobble(resample([[cu - width / 2, v], [cu - width / 2 + w, v]], 0.2), 0.01, seed + i), 0.045, color, [a, b], { alpha: 0.55 }))
  }
  return out
}

/**
 * An abstract pen flourish standing in for a signature. Deliberately generic: it imitates the act
 * of signing, not any person's hand (the frame carries the EDITORIAL RECONSTRUCTION mark).
 */
export function flourish(cu: number, cv: number, width: number, seed: number): UV[] {
  const r = rng(seed)
  const pts: UV[] = []
  const loops = 3 + Math.floor(r() * 3)
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    const u = cu - width / 2 + width * t
    const v = cv + Math.sin(t * Math.PI * 2 * loops + r() * 0.2) * (0.22 + 0.12 * Math.sin(t * 7)) * (1 - t * 0.5) + (t > 0.85 ? (t - 0.85) * 1.6 : 0)
    pts.push([u + Math.cos(t * Math.PI * 2 * loops) * 0.12, v])
  }
  return pts
}

/* ── Maps inside a plate ─────────────────────────────────────────────────────────────────────── */

export interface MapFit {
  /** Convert world XZ (geo json) to plate UV. */
  (x: number, z: number): UV
  k: number
}

/** Fit a world-space box (geo units) into a plate rectangle (centre cu,cv; height h). North is up. */
export function fitMap(box: { x0: number; x1: number; z0: number; z1: number }, cu: number, cv: number, h: number): MapFit {
  const k = h / (box.z1 - box.z0)
  const cx = (box.x0 + box.x1) / 2
  const cz = (box.z0 + box.z1) / 2
  const f = ((x: number, z: number): UV => [cu + (x - cx) * k, cv - (z - cz) * k]) as MapFit
  f.k = k
  return f
}

export function mapLines(lines: Line[], fit: MapFit): UV[][] {
  return lines.map((l) => l.map(([x, z]) => fit(x, z)))
}

export function placeUV(name: string, fit: MapFit): UV {
  const p = GEO.places.find((x) => x.name === name)
  if (!p) throw new Error(`Unknown place ${name}`)
  return fit(p.x, p.z)
}

/** World box around post-1971 Pakistan (and its northern routes), in geo units. */
export const PAKISTAN_BOX = { x0: -38.5, x1: 6, z0: -27, z1: 27 }

/** Faint outline of Pakistan (coast + western frontiers + the Punjab/Sindh boundary). No line in Kashmir. */
export function pakistanOutline(fit: MapFit, window: Win, alpha = 0.5): MotifStroke[] {
  const w = GEO.pakistanWing
  const own = [...w.coast, ...w.iran, ...w.afghanistan, ...w.india].map((l) => stroke(l.map(([x, z]) => fit(x, z)), 0.045, INK, window, { alpha }))
  // The Afghanistan–Iran frontier, fainter: Pakistan sits among its neighbours, not on a blank sheet.
  const near = GEO.neighbourBorders.map((l) => stroke(l.map(([x, z]) => fit(x, z)), 0.03, TAUPE, window, { alpha: alpha * 0.8 }))
  return [...own, ...near]
}

/** The neighbours' names on a map of Pakistan, wherever they fall inside the plate. */
export function neighbourLabels(fit: MapFit, window: Win): MotifLabel[] {
  const out: MotifLabel[] = []
  for (const n of GEO.neighbourLabels) {
    const [u, v] = fit(n.x, n.z)
    if (Math.abs(v) > 4.4 || u < -6.8 || u > 6.8) continue
    // Names near the right edge are set right-aligned so they stay on the plate.
    const align = u > 4.6 ? 'right' : 'center'
    out.push(label(n.name, [align === 'right' ? 6.7 : u, v], 0.17, window, { font: 'display', align, color: TAUPE, tracking: 0.32 }))
  }
  return out
}
