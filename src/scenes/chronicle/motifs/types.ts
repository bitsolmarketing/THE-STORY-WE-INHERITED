import type { StoryEvent } from '@/data/story/types'
import type { InkFill, InkStroke } from '@/scenes/shared/ink'

/**
 * Motif authoring frame ("plate space"): u runs to screen-right, v runs forward (screen-up),
 * origin at the plate centre, ~1 unit ≈ 1/19 of the frame width at the camera's focus.
 * Usable area is roughly u ∈ [−6.5, 6.5], v ∈ [−4.5, 4.5].
 *
 * Motif time `t` is the beat-local progress (0 when the frame's beat starts, 1 when it ends).
 * Windows are in that time. Draw the essential gesture in the first ~60% so even a fast
 * scroller sees it complete; the remainder is settle time.
 */
export type UV = [number, number]

export interface MotifStroke extends Omit<InkStroke, 'points'> {
  points: UV[]
}

export interface MotifFill extends Omit<InkFill, 'polygon' | 'rise'> {
  polygon: UV[]
  /** Rise direction in plate space; default upward (+v). */
  rise?: UV
}

export interface MotifLabel {
  text: string
  at: UV
  /** Cap height in plate units. */
  size: number
  font?: 'mono' | 'display' | 'italic' | 'sans'
  color?: string
  align?: 'left' | 'center' | 'right'
  /** In-plane rotation (radians, counter-clockwise as seen from above). */
  angle?: number
  window: [number, number]
  /** Letter-spacing in em. */
  tracking?: number
}

/** Particles that move from → to inside a window (crowds, flows, lights). */
export interface MotifDots {
  from: UV[]
  to: UV[]
  /** Per-dot start delay as a fraction of the window (0..1). */
  delay?: number[]
  window: [number, number]
  /** Pixel size at the focus distance. */
  size: number
  color: string
  /** Additive glow (lights) instead of ink. */
  glow?: boolean
  /** Return to `from` in the second half of the window (e.g. distancing, then reconnecting). */
  pingPong?: boolean
}

export interface PrintSlot {
  at: UV
  /** Photo width in plate units. */
  width: number
  /** Small in-plane rotation (radians). */
  angle?: number
  window: [number, number]
}

export interface MotifOutput {
  strokes: MotifStroke[]
  fills?: MotifFill[]
  labels?: MotifLabel[]
  dots?: MotifDots[]
  /** Where the event's archival prints lie (in order of `visualTreatment.prints`). */
  prints?: PrintSlot[]
}

export type MotifGenerator = (event: StoryEvent) => MotifOutput
