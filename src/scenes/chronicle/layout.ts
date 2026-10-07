import type { Beat, Timeline } from '@/engine/timeline/timeline'
import { TRANSITION_EASE } from '@/engine/timeline/timeline'
import { clamp01 } from '@/engine/progress/ranges'

/**
 * The chronicle (1948 → 2026) is a long paper table. A meandering ink line — the spine ("the
 * timeline is the spine", storyboard) — runs along it; each storyboard frame is laid beside it,
 * and every year is a tick on it. A rostrum camera glides along the spine.
 *
 * Event-locked motion:
 *   TRANSITION  accelerates away from the settled frame, travelling over the year ticks (each
 *               tick sits exactly where the odometer reads that year)
 *   EVENT       decelerates into the new frame (speed matched at the seam), then HOLDS, drifting
 *               by a hair while the motif develops and the year stays still
 */
export const CHRONICLE_ORIGIN = { x: 0, z: 3000 } as const

export const CHRONICLE = {
  plateLateral: 3.0,
  /** Spine travel for a transition: same-year cut, or base + per year crossed. */
  travel: { sameYear: 7, base: 9, perYear: 1.5, max: 30 },
  /** Hold drift across the frame after the camera has arrived. */
  drift: 0.9,
  camera: { height: 10.5, back: 12.5, lookLateral: 1.8, fov: 36 },
} as const

export interface ChronicleSlot {
  beat: Beat
  s0: number
  s1: number
  /** Events: the frame's centre (where the camera settles). */
  sMid: number
}

export interface YearMark {
  year: number
  s: number
}

export interface ChronicleLayout {
  slots: ChronicleSlot[]
  length: number
  marks: YearMark[]
  slotFor(beat: Beat): ChronicleSlot | undefined
}

export function buildChronicleLayout(timeline: Timeline): ChronicleLayout {
  const slots: ChronicleSlot[] = []
  const byIndex = new Map<number, ChronicleSlot>()
  const marks: YearMark[] = []
  const chron = timeline.beats.filter((b) => b.scene === 'chronicle')
  let s = 0
  let prevTransition: { span: number; seconds: number } | null = null

  for (const beat of chron) {
    let slot: ChronicleSlot
    if (beat.kind === 'transition') {
      const gap = beat.year - (beat.fromYear ?? beat.year)
      const span = gap <= 0 ? CHRONICLE.travel.sameYear : Math.min(CHRONICLE.travel.max, CHRONICLE.travel.base + CHRONICLE.travel.perYear * gap)
      slot = { beat, s0: s, s1: s + span, sMid: s + span / 2 }
      // Ticks for the years crossed, placed where the odometer reads each of them.
      for (let y = (beat.fromYear ?? beat.year) + 1; y < beat.year; y++) {
        const k = (y - (beat.fromYear ?? y)) / gap
        marks.push({ year: y, s: s + span * travelAt(inverseEase(k)) })
      }
      prevTransition = { span, seconds: beat.seconds }
    } else if (beat.kind === 'event') {
      const arrive = timeline.phases(beat).arrive
      // Match the transition's exit speed (ease-in: 2·D/T) with the arrival's entry speed (ease-out: 2·d/t).
      const arriveDist = prevTransition ? Math.min(10, Math.max(2.5, (prevTransition.span * (arrive * beat.seconds)) / prevTransition.seconds)) : 4
      slot = { beat, s0: s, sMid: s + arriveDist, s1: s + arriveDist + CHRONICLE.drift }
      marks.push({ year: beat.year, s: slot.sMid })
      prevTransition = null
    } else {
      slot = { beat, s0: s, s1: s + 24, sMid: s + 12 }
    }
    slots.push(slot)
    byIndex.set(beat.index, slot)
    s = slot.s1
  }
  // One tick per year (an event year can appear twice when two events share it).
  const seen = new Set<number>()
  const unique = marks.filter((m) => (seen.has(m.year) ? false : (seen.add(m.year), true)))
  return { slots, length: s, marks: unique, slotFor: (b) => byIndex.get(b.index) }
}

/** Camera travel within a transition (ease-in: leaves the settled frame gently, arrives fast). */
function travelAt(t: number): number {
  return t * t
}

function inverseEase(k: number): number {
  // Invert TRANSITION_EASE (inOutSine) by bisection; it is monotonic.
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (TRANSITION_EASE(mid) < k) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Spine shape: x advances, z meanders softly. Returns world XZ. */
export function spinePoint(s: number, out: { x: number; z: number } = { x: 0, z: 0 }) {
  out.x = CHRONICLE_ORIGIN.x + s
  out.z = CHRONICLE_ORIGIN.z + 5.5 * Math.sin(s / 61) + 2.4 * Math.sin(s / 27 + 1.3)
  return out
}

/** Unit tangent (tx, tz) and left-to-right normal (nx, nz) of the spine at s. Screen right = +normal. */
export function spineFrame(s: number, out = { tx: 1, tz: 0, nx: 0, nz: 1 }) {
  const dz = (5.5 / 61) * Math.cos(s / 61) + (2.4 / 27) * Math.cos(s / 27 + 1.3)
  const len = Math.hypot(1, dz)
  out.tx = 1 / len
  out.tz = dz / len
  out.nx = -out.tz
  out.nz = out.tx
  return out
}

/** Spine distance the camera is focused on at global progress p. */
export function focusAt(timeline: Timeline, layout: ChronicleLayout, p: number): number {
  const beat = timeline.beatAt(p)
  const slot = layout.slotFor(beat)
  if (!slot) return 0
  const t = timeline.local(p, beat)
  if (beat.kind === 'transition') return slot.s0 + (slot.s1 - slot.s0) * travelAt(t)
  if (beat.kind === 'event') {
    const arrive = timeline.phases(beat).arrive
    if (t < arrive) {
      const k = t / arrive
      return slot.s0 + (slot.sMid - slot.s0) * (1 - (1 - k) * (1 - k))
    }
    return slot.sMid + (slot.s1 - slot.sMid) * ((t - arrive) / (1 - arrive))
  }
  // Epilogue: glide to the middle of the slot and stop there while the camera rises.
  return slot.s0 + (slot.sMid - slot.s0) * Math.sin((clamp01(t * 2.2) * Math.PI) / 2)
}
