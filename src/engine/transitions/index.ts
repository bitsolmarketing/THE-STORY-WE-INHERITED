import { ease, seg, mix, type Easing } from '@/engine/progress/ranges'
import type { CameraKeyframe } from '@/engine/camera/CameraController'

/**
 * Reusable transition primitives (spec §21).
 *
 * A transition is a pure mapping from cinematic progress to a small set of parameters that a
 * material, object or DOM element consumes. Nothing here owns state or touches the scene graph,
 * which is what makes the primitives reusable across the rest of the documentary and reversible.
 *
 * Shader-side counterparts live in src/shaders/chunks.ts (paperReveal, inkSpread, imageReveal,
 * fadeToPaper, environmentMorph) and consume the numbers produced here.
 */

export interface Window01 {
  start: number
  end: number
  ease?: Easing
}

/** Generic timed window → eased 0..1. */
export function window01(p: number, w: Window01): number {
  return (w.ease ?? ease.inOutSine)(seg(p, w.start, w.end))
}

/** paperReveal: how much of the map has soaked into the paper (0 paper … 1 map). */
export function paperReveal(p: number, w: Window01): { reveal: number; edge: number } {
  const t = window01(p, { ease: ease.inOutSine, ...w })
  // The reveal edge is widest mid-transition so the ink "soaks" rather than wipes.
  const edge = 0.08 + 0.22 * Math.sin(Math.PI * t)
  return { reveal: t, edge }
}

/** inkSpread: normalized distance the ink has travelled along a path, plus bleed strength. */
export function inkSpread(p: number, w: Window01): { ink: number; bleed: number } {
  const t = window01(p, { ease: ease.inOutCubic, ...w })
  const bleed = 0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.15))
  return { ink: t, bleed }
}

/** mapToWorld: ordered sub-phases of the paper diorama rising out of the map. */
export function mapToWorld(
  p: number,
  w: Window01,
): { tilt: number; ground: number; rise: number; haze: number; people: number } {
  const t = seg(p, w.start, w.end)
  return {
    /** camera/plane tilt progress (consumed by the camera path; exposed for coupled effects) */
    tilt: ease.inOutSine(seg(t, 0.0, 0.7)),
    /** map ink → ground/earth material morph */
    ground: ease.inOutSine(seg(t, 0.15, 0.8)),
    /** architecture (platform, columns, roof, train) rising from the paper */
    rise: ease.outCubic(seg(t, 0.3, 0.85)),
    /** fog/haze density */
    haze: ease.inOutSine(seg(t, 0.2, 0.9)),
    /** crowd + luggage appearing (after the architecture) */
    people: ease.outCubic(seg(t, 0.55, 1.0)),
  }
}

/** imageReveal: an archival plane developing out of the paper, with a lift and settle. */
export function imageReveal(p: number, w: Window01): { reveal: number; lift: number; opacity: number } {
  const t = window01(p, { ease: ease.outCubic, ...w })
  return { reveal: t, lift: Math.sin(Math.PI * t) * 0.35, opacity: ease.outQuad(seg(t, 0, 0.5)) }
}

/** fadeToPaper: the world desaturates and gains grain until it is parchment. */
export function fadeToPaper(p: number, w: Window01): { paper: number; desaturate: number; grain: number } {
  const t = window01(p, { ease: ease.inOutSine, ...w })
  return { paper: t, desaturate: ease.outQuad(seg(t, 0, 0.7)), grain: ease.inQuad(seg(t, 0.2, 1)) }
}

/** environmentMorph: generic cross-morph scalar for material blends (ground, light, fog colour). */
export function environmentMorph(p: number, w: Window01): number {
  return window01(p, { ease: ease.inOutSine, ...w })
}

/**
 * yearRoll: digit offsets for a mechanical type-wheel between two years.
 * Returns, for each of the 4 columns, the fractional digit position (e.g. 7.35 → between 7 and 8).
 * Columns that do not change hold their digit. The rightmost changing column leads;
 * higher columns follow with a small mechanical lag (carry).
 */
export function yearRoll(from: number, to: number, t: number): number[] {
  const a = String(from).padStart(4, '0').split('').map(Number)
  const b = String(to).padStart(4, '0').split('').map(Number)
  const tt = ease.inOutCubic(seg(t, 0, 1))
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    if (a[i] === b[i]) {
      out.push(a[i])
      continue
    }
    // Mechanical carry: columns further left start slightly later.
    const lag = (3 - i) * 0.12
    const local = ease.inOutCubic(seg(tt, lag, 1))
    let delta = b[i] - a[i]
    // Wheels only roll forward (…8, 9, 0, 1…) when going up, and backward when going down.
    if (to > from && delta < 0) delta += 10
    if (to < from && delta > 0) delta -= 10
    out.push(a[i] + delta * local)
  }
  return out
}

/**
 * cameraPush / cameraPull: helpers to author keyframes that move along the view axis.
 * Given a base keyframe, returns a new keyframe `distance` units closer to (push) or
 * further from (pull) the lookAt target at progress `at`.
 */
function alongView(base: CameraKeyframe, at: number, distance: number, fov?: number): CameraKeyframe {
  const [px, py, pz] = base.position
  const [lx, ly, lz] = base.lookAt
  const dx = lx - px
  const dy = ly - py
  const dz = lz - pz
  const len = Math.hypot(dx, dy, dz) || 1
  const k = distance / len
  return {
    at,
    position: [px + dx * k, py + dy * k, pz + dz * k],
    lookAt: base.lookAt,
    fov: fov ?? base.fov,
  }
}

export function cameraPush(base: CameraKeyframe, at: number, distance: number, fov?: number): CameraKeyframe {
  return alongView(base, at, Math.abs(distance), fov)
}

export function cameraPull(base: CameraKeyframe, at: number, distance: number, fov?: number): CameraKeyframe {
  return alongView(base, at, -Math.abs(distance), fov)
}

/** Light direction sweep across the paper in Scene 01 (spec §07: light moves across the surface). */
export function lightSweep(p: number, w: Window01): [number, number, number] {
  const t = window01(p, { ease: ease.inOutSine, ...w })
  // From low on the left (raking light) to higher on the right. Always above the surface.
  const azimuth = mix(-2.4, -0.6, t)
  const elevation = mix(0.35, 0.95, t)
  const c = Math.cos(elevation)
  return [Math.cos(azimuth) * c, Math.sin(elevation), Math.sin(azimuth) * c]
}
