/**
 * Pure helpers for working with the single normalized cinematic progress value (0..1).
 * Everything here is deterministic and side-effect free so reverse scrolling is free.
 */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t

/** Local 0..1 progress of `p` inside [a, b], clamped. */
export function seg(p: number, a: number, b: number): number {
  if (b <= a) return p >= b ? 1 : 0
  return clamp01((p - a) / (b - a))
}

/** Linear remap of p from [a,b] to [c,d], clamped to [c,d]. */
export function remap(p: number, a: number, b: number, c: number, d: number): number {
  return mix(c, d, seg(p, a, b))
}

/**
 * A 0 → 1 → 0 window: rises over [a, a+fadeIn], holds, falls over [b-fadeOut, b].
 * Useful for things that should exist only during one chapter (captions, haze bursts).
 */
export function bell(p: number, a: number, b: number, fadeIn = 0.02, fadeOut = 0.02): number {
  if (p <= a || p >= b) return 0
  const rise = seg(p, a, a + fadeIn)
  const fall = 1 - seg(p, b - fadeOut, b)
  return Math.min(rise, fall)
}

export const ease = {
  linear: (t: number) => t,
  smoothstep: (t: number) => {
    t = clamp01(t)
    return t * t * (3 - 2 * t)
  },
  smootherstep: (t: number) => {
    t = clamp01(t)
    return t * t * t * (t * (t * 6 - 15) + 10)
  },
  inSine: (t: number) => 1 - Math.cos((clamp01(t) * Math.PI) / 2),
  outSine: (t: number) => Math.sin((clamp01(t) * Math.PI) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2,
  inQuad: (t: number) => {
    t = clamp01(t)
    return t * t
  },
  outQuad: (t: number) => {
    t = clamp01(t)
    return 1 - (1 - t) * (1 - t)
  },
  inCubic: (t: number) => {
    t = clamp01(t)
    return t * t * t
  },
  outCubic: (t: number) => {
    t = clamp01(t)
    return 1 - Math.pow(1 - t, 3)
  },
  inOutCubic: (t: number) => {
    t = clamp01(t)
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  },
  inOutQuint: (t: number) => {
    t = clamp01(t)
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
  },
  outExpo: (t: number) => {
    t = clamp01(t)
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
  },
  inExpo: (t: number) => {
    t = clamp01(t)
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10)
  },
} as const

export type Easing = (t: number) => number

/**
 * Frame-rate independent exponential smoothing.
 * `lambda` is the approach rate per second (6 ≈ reaches ~95% in 0.5s).
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return mix(current, target, 1 - Math.exp(-lambda * dt))
}

/** Hysteresis helper: returns new boolean state given thresholds. */
export function hysteresis(state: boolean, value: number, onAbove: number, offBelow: number): boolean {
  if (state) return value >= offBelow
  return value >= onAbove
}
