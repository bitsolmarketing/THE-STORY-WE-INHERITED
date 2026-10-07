import type { OpeningChapter } from '@/data/story/chapters'
import type { Importance, MovementId, StoryEvent } from '@/data/story/types'
import { clamp01, ease } from '@/engine/progress/ranges'

/**
 * The timeline turns story data into the one thing the cinematic engine understands: ranges of the
 * single normalized progress value — with EVENT-LOCKED chronology:
 *
 *   YEAR → EVENT (arrive → develop → hold) → TRANSITION (the year advances) → NEXT EVENT
 *
 * - The year never changes inside an event. It advances only inside a transition beat, where the
 *   odometer rolls through the intermediate years while the camera travels past them.
 * - Pacing is authored twice, in seconds: `seconds` is scroll distance for the free experience
 *   (heavier, every event has room to breathe) and `judgesSeconds` is the pace of the ~2-minute
 *   Judges' Cut autoplay. Same film, same scroll track; only the playback speed differs.
 *
 * Nothing here imports content. Give it other chapters/events (the backend) and the film re-paces.
 */

export type SceneId = 'opening' | 'chronicle'
export type BeatKind = 'opening' | 'event' | 'transition' | 'epilogue'

export interface PaceTable {
  major: number
  featured: number
  standard: number
  /** Transition between two events in the same year (a cut, no year change). */
  sameYear: number
  /** Transition into a different year: base + per skipped year, capped. */
  yearBase: number
  yearPerGap: number
  yearMax: number
  epilogue: number
  /** Multiplier on the opening chapters' authored seconds. */
  opening: number
}

export interface Pacing {
  full: PaceTable
  judges: PaceTable
  /** Viewport heights of scrolling per full-experience second. */
  vhPerSecond: number
  /** Event phases as fractions of the beat: camera arrives by `arrive`, the motif completes by `develop`, then it holds. */
  phases: Record<Importance, { arrive: number; develop: number }>
}

export const PACING: Pacing = {
  full: { major: 7, featured: 4, standard: 2.6, sameYear: 0.9, yearBase: 1.3, yearPerGap: 0.12, yearMax: 2.4, epilogue: 9, opening: 1.45 },
  judges: { major: 2.9, featured: 1.4, standard: 0.8, sameYear: 0.26, yearBase: 0.38, yearPerGap: 0.03, yearMax: 0.62, epilogue: 6, opening: 0.92 },
  vhPerSecond: 42,
  phases: {
    major: { arrive: 0.16, develop: 0.58 },
    featured: { arrive: 0.2, develop: 0.62 },
    standard: { arrive: 0.24, develop: 0.68 },
  },
}

export interface Beat {
  /** 'open:<chapter>' | event id ('E03') | 'T:E05>E06' | 'epilogue' */
  id: string
  index: number
  kind: BeatKind
  scene: SceneId
  /** Year at rest (events) or the year being arrived at (transitions). */
  year: number
  /** Transitions: the year being left. */
  fromYear?: number
  movement: MovementId
  importance?: Importance
  /** Full-experience seconds (scroll distance). */
  seconds: number
  /** Judges' Cut seconds (autoplay pace). */
  judgesSeconds: number
  t0: number
  t1: number
  start: number
  end: number
  event?: StoryEvent
  chapter?: OpeningChapter
  /** Neighbouring events (transitions only). */
  prevEvent?: StoryEvent
  nextEvent?: StoryEvent
  sceneIndex: number
}

export interface SceneSpan {
  start: number
  end: number
}

export interface Timeline {
  beats: readonly Beat[]
  /** Story events told by the chronicle, in order (no transitions). */
  eventBeats: readonly Beat[]
  totalSeconds: number
  judgesTotalSeconds: number
  trackVh: number
  scenes: Record<SceneId, SceneSpan>
  firstYear: number
  lastYear: number
  pacing: Pacing
  beatAt(p: number): Beat
  local(p: number, beat: Beat): number
  sceneLocal(p: number, scene: SceneId): number
  /** Continuous year value for the odometer: integer inside events, rolling inside transitions. */
  yearAt(p: number): number
  byId(id: string): Beat | undefined
  chapterRange(id: OpeningChapter['id']): SceneSpan
  /** Event phase helpers (beat-local 0..1 → 0..1 within the phase). */
  phases(beat: Beat): { arrive: number; develop: number }
  /** Progress where an event's hold begins (its "settled" frame), for navigation. */
  restingProgress(beat: Beat): number
  /** Judges' Cut clock: seconds elapsed at p, and p at a given elapsed time. */
  judgesTimeAt(p: number): number
  progressAtJudgesTime(s: number): number
}

export interface TimelineInput {
  opening: readonly OpeningChapter[]
  events: readonly StoryEvent[]
  firstYear?: number
  lastYear?: number
  pacing?: Pacing
}

/** Same-year cuts and year transitions both ease along the travel. */
export const TRANSITION_EASE = ease.inOutSine

export function buildTimeline(input: TimelineInput): Timeline {
  const pacing = input.pacing ?? PACING
  const firstYear = input.firstYear ?? 1947
  const lastYear = input.lastYear ?? 2026
  type Draft = Omit<Beat, 'index' | 't0' | 't1' | 'start' | 'end' | 'sceneIndex'>
  const draft: Draft[] = []

  const openingEvents = new Map(input.events.filter((e) => e.presentation === 'opening').map((e) => [e.id, e]))
  for (const c of input.opening) {
    const ev = openingEvents.get(c.eventId)
    draft.push({
      id: `open:${c.id}`,
      kind: 'opening',
      scene: 'opening',
      year: firstYear,
      movement: c.id === 'prologue' ? 'prologue' : (ev?.movement ?? 'birth'),
      seconds: c.seconds * pacing.full.opening,
      judgesSeconds: c.seconds * pacing.judges.opening,
      chapter: c,
      event: ev,
    })
  }

  const chronicle = input.events.filter((e) => e.presentation !== 'opening')
  let prev: StoryEvent | undefined
  let prevYear = firstYear
  for (const e of chronicle) {
    // A transition before every chronicle event except the first (the opening's own window → paper
    // handoff is the transition into the first chronicle year).
    if (prev) {
      const gap = e.year - prevYear
      const t = (table: PaceTable) => (gap <= 0 ? table.sameYear : Math.min(table.yearMax, table.yearBase + table.yearPerGap * (gap - 1)))
      draft.push({
        id: `T:${prev.id}>${e.id}`,
        kind: 'transition',
        scene: 'chronicle',
        year: e.year,
        fromYear: prevYear,
        movement: e.movement,
        seconds: t(pacing.full),
        judgesSeconds: t(pacing.judges),
        prevEvent: prev,
        nextEvent: e,
      })
    }
    draft.push({
      id: e.id,
      kind: 'event',
      scene: 'chronicle',
      year: e.year,
      fromYear: prev ? prevYear : firstYear,
      movement: e.movement,
      importance: e.importance,
      seconds: e.duration ?? pacing.full[e.importance],
      judgesSeconds: pacing.judges[e.importance],
      event: e,
    })
    prev = e
    prevYear = Math.max(prevYear, e.year)
  }
  draft.push({
    id: 'epilogue',
    kind: 'epilogue',
    scene: 'chronicle',
    year: lastYear,
    movement: 'next',
    seconds: pacing.full.epilogue,
    judgesSeconds: pacing.judges.epilogue,
    prevEvent: prev,
  })

  const totalSeconds = draft.reduce((s, b) => s + b.seconds, 0)
  const judgesTotalSeconds = draft.reduce((s, b) => s + b.judgesSeconds, 0)
  let t = 0
  const sceneCounters: Record<SceneId, number> = { opening: 0, chronicle: 0 }
  const beats: Beat[] = draft.map((b, index) => {
    const t0 = t
    t += b.seconds
    return { ...b, index, t0, t1: t, start: t0 / totalSeconds, end: t / totalSeconds, sceneIndex: sceneCounters[b.scene]++ }
  })
  beats[beats.length - 1].end = 1

  // Judges' clock: cumulative judges' seconds at each beat start.
  const jStart: number[] = []
  let j = 0
  for (const b of beats) {
    jStart.push(j)
    j += b.judgesSeconds
  }

  const spanOf = (scene: SceneId): SceneSpan => {
    const list = beats.filter((b) => b.scene === scene)
    return list.length ? { start: list[0].start, end: list[list.length - 1].end } : { start: 0, end: 0 }
  }
  const scenes: Record<SceneId, SceneSpan> = { opening: spanOf('opening'), chronicle: spanOf('chronicle') }
  const byIdMap = new Map(beats.map((b) => [b.id, b]))

  function beatAt(p: number): Beat {
    if (p <= 0) return beats[0]
    if (p >= 1) return beats[beats.length - 1]
    let lo = 0
    let hi = beats.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (beats[mid].start <= p) lo = mid
      else hi = mid - 1
    }
    return beats[lo]
  }

  const local = (p: number, beat: Beat) => (beat.end > beat.start ? clamp01((p - beat.start) / (beat.end - beat.start)) : 0)

  function sceneLocal(p: number, scene: SceneId): number {
    const s = scenes[scene]
    return s.end > s.start ? clamp01((p - s.start) / (s.end - s.start)) : 0
  }

  // The opening's last chapter (window → paper) carries 1947 → first chronicle year.
  const openingEnd = beats.filter((b) => b.scene === 'opening').pop()
  const firstChronicleYear = beats.find((b) => b.kind === 'event')?.year ?? firstYear

  function yearAt(p: number): number {
    const b = beatAt(p)
    if (b.kind === 'transition' && b.fromYear !== undefined) return b.fromYear + (b.year - b.fromYear) * TRANSITION_EASE(local(p, b))
    if (b === openingEnd && openingEnd) {
      // Roll to the first chronicle year while the window becomes paper (last 45% of the chapter).
      const k = clamp01((local(p, b) - 0.55) / 0.45)
      return firstYear + (firstChronicleYear - firstYear) * ease.inOutSine(k)
    }
    return b.year
  }

  function chapterRange(id: OpeningChapter['id']): SceneSpan {
    const b = byIdMap.get(`open:${id}`)
    if (!b) return { start: 0, end: 0 }
    const s = scenes.opening
    const len = s.end - s.start || 1
    return { start: (b.start - s.start) / len, end: (b.end - s.start) / len }
  }

  const phases = (beat: Beat) => pacing.phases[beat.importance ?? 'standard']

  function restingProgress(beat: Beat): number {
    if (beat.kind !== 'event') return beat.start + (beat.end - beat.start) * 0.5
    return beat.start + (beat.end - beat.start) * phases(beat).develop
  }

  function judgesTimeAt(p: number): number {
    const b = beatAt(p)
    return jStart[b.index] + local(p, b) * b.judgesSeconds
  }

  function progressAtJudgesTime(s: number): number {
    if (s <= 0) return 0
    if (s >= judgesTotalSeconds) return 1
    let lo = 0
    let hi = beats.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (jStart[mid] <= s) lo = mid
      else hi = mid - 1
    }
    const b = beats[lo]
    const k = b.judgesSeconds > 0 ? (s - jStart[lo]) / b.judgesSeconds : 0
    return b.start + (b.end - b.start) * clamp01(k)
  }

  return {
    beats,
    eventBeats: beats.filter((b) => b.kind === 'event'),
    totalSeconds,
    judgesTotalSeconds,
    trackVh: Math.round(totalSeconds * pacing.vhPerSecond + 100),
    scenes,
    firstYear,
    lastYear,
    pacing,
    beatAt,
    local,
    sceneLocal,
    yearAt,
    byId: (id) => byIdMap.get(id),
    chapterRange,
    phases,
    restingProgress,
    judgesTimeAt,
    progressAtJudgesTime,
  }
}

/**
 * Odometer: the four wheel positions for a continuous year value. The units wheel turns
 * continuously; each higher wheel turns only while the one below passes 9 → 0, exactly like a
 * mechanical counter, so intermediate years read cleanly as the film travels through them.
 */
export function odometer(value: number): number[] {
  const v = Math.max(0, value)
  const out = [0, 0, 0, 0]
  let carry = v % 10
  out[3] = carry
  let place = 10
  for (let i = 2; i >= 0; i--) {
    const whole = Math.floor(v / place) % 10
    // Fraction of the lower wheel's final tenth (9 → 10) drives this wheel's roll.
    const lowerFrac = carry - 9
    const roll = lowerFrac > 0 ? lowerFrac : 0
    out[i] = whole + roll
    carry = whole + roll
    place *= 10
  }
  return out
}
