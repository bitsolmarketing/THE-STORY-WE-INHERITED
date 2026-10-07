import { cinematic, frame } from '@/engine/store/cinematicStore'
import { ease } from '@/engine/progress/ranges'
import { onTick } from '@/engine/loop/ticker'

/**
 * Moving through the film on purpose (timeline, menu, archive, chapter keys).
 *
 * - Nearby targets GLIDE: the film plays through to the destination at its own (capped) speed,
 *   the page is synchronised when it arrives. Any wheel / touch cancels the glide.
 * - Far targets CUT through paper: the frame becomes parchment, the camera is placed at the
 *   destination under it, the odometer rolls from the old year to the new one, the paper lifts.
 *   The camera is never seen teleporting.
 */
export interface TravelState {
  active: boolean
  /** 0 → 1 over the whole travel (out, cut, in). */
  t: number
  fromYear: number
  toYear: number
  /** Paper veil opacity 0..1 contributed by the travel. */
  veil: number
}

export const travel: TravelState = { active: false, t: 0, fromYear: 0, toYear: 0, veil: 0 }

/** A glide in progress (the loop skips the scroll leash while it runs). */
export const glide = { active: false, to: 0 }

/** Film seconds beyond which a jump becomes a cut rather than a glide. */
const GLIDE_MAX_SECONDS = 24
const OUT_S = 0.45
const HOLD_S = 0.35
const IN_S = 0.6
let target = 0
let elapsed = 0
let cut = false

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
}

/** Jump the scroll position and the film to p immediately (only ever under a full veil). */
export function placeAt(p: number): void {
  window.scrollTo({ top: p * maxScroll(), behavior: 'auto' })
  frame.target = p
  frame.progress = p
}

export function travelTo(p: number): void {
  const { timeline } = cinematic.get()
  const clamped = Math.min(1, Math.max(0, p))
  const distanceSeconds = Math.abs(clamped - frame.progress) * timeline.totalSeconds
  if (distanceSeconds <= GLIDE_MAX_SECONDS) {
    glide.active = true
    glide.to = clamped
    return
  }
  glide.active = false
  target = clamped
  elapsed = 0
  cut = false
  travel.active = true
  travel.t = 0
  travel.fromYear = timeline.yearAt(frame.progress)
  travel.toYear = timeline.yearAt(clamped)
}

/** Step to the next / previous chapter's settled frame (← → keys). */
export function stepChapter(direction: 1 | -1): void {
  const { timeline } = cinematic.get()
  const p = glide.active ? glide.to : frame.progress
  const resting = [
    ...timeline.beats.filter((b) => b.kind === 'opening').map((b) => b.start + (b.end - b.start) * 0.55),
    ...timeline.eventBeats.map((b) => timeline.restingProgress(b)),
    timeline.byId('epilogue') ? 0.985 : 1,
  ].sort((a, b) => a - b)
  const eps = 0.5 / timeline.totalSeconds
  const next = direction > 0 ? resting.find((r) => r > p + eps) : [...resting].reverse().find((r) => r < p - eps)
  if (next !== undefined) travelTo(next)
}

onTick((f) => {
  if (glide.active) {
    frame.target = glide.to
    if (Math.abs(frame.progress - glide.to) < 2e-4) {
      glide.active = false
      window.scrollTo({ top: glide.to * maxScroll(), behavior: 'auto' })
    }
  }
  if (!travel.active) return
  elapsed += f.dt
  const total = OUT_S + HOLD_S + IN_S
  travel.t = Math.min(1, elapsed / total)
  if (elapsed < OUT_S) travel.veil = ease.inOutSine(elapsed / OUT_S)
  else if (elapsed < OUT_S + HOLD_S) {
    travel.veil = 1
    if (!cut) {
      cut = true
      placeAt(target)
    }
  } else travel.veil = 1 - ease.inOutSine((elapsed - OUT_S - HOLD_S) / IN_S)
  if (elapsed >= total) {
    travel.active = false
    travel.veil = 0
  }
})

/** The visitor takes the wheel: a glide stops where the film is. */
export function cancelGlide(): void {
  if (!glide.active) return
  glide.active = false
  window.scrollTo({ top: frame.progress * maxScroll(), behavior: 'auto' })
  frame.target = frame.progress
}

/** The year the odometer should show during a travel (rolls across the cut). */
export function travelYear(): number {
  const k = ease.inOutCubic(Math.min(1, Math.max(0, (travel.t - 0.15) / 0.6)))
  return travel.fromYear + (travel.toYear - travel.fromYear) * k
}

/** Chapter keys and glide interruption. Installed once by the app shell. */
export function installNavigationKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const s = cinematic.get()
    if (!s.entered || s.overlay || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      if (s.mode === 'judges' && s.playing) s.setPlaying(false)
      stepChapter(e.key === 'ArrowRight' ? 1 : -1)
    } else if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) cancelGlide()
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('wheel', cancelGlide, { passive: true })
  window.addEventListener('touchstart', cancelGlide, { passive: true })
  return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('wheel', cancelGlide)
    window.removeEventListener('touchstart', cancelGlide)
  }
}
