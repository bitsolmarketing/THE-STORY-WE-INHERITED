import { bell, ease, seg } from '@/engine/progress/ranges'
import { inkSpread, lightSweep, mapToWorld, paperReveal } from '@/engine/transitions'
import type { Timeline } from '@/engine/timeline/timeline'
import type { ChapterId } from '@/data/story/chapters'

/**
 * Every opening curve in one place, as pure functions of global progress. The paper shader,
 * the dust, the migration flows, the world diorama, the DOM tone and the audio all read the same
 * numbers, so the sequence stays coherent and reversible.
 *
 *   DARKNESS/DUST → LAND OUTLINE → 1947 → BORN → PARTITION → MIGRATION → HUMAN → JOURNEY → TIME
 */
export interface OpeningState {
  /** Opening-local progress 0..1. */
  u: number
  /** 1 = the paper lies in darkness (prologue) … 0 = lit. */
  dark: number
  /** Dust gathering into the outline of the land. */
  dustGather: number
  dustAlpha: number
  /** Coastline ink (the outline the dust became). */
  coast: number
  /** Map detail soaking into the paper (paperReveal). */
  reveal: number
  revealEdge: number
  /** "1947" pressed into the paper. */
  emboss: number
  /** Light vector sweeping across the surface. */
  light: [number, number, number]
  /** Olive wash over the two wings of the new state. */
  wash: number
  /** Partition ink along the boundaries (inkSpread). */
  ink: number
  inkBleed: number
  /** Map fragments drifting apart along the line. */
  split: number
  /** Refugee flows across the line (both directions). */
  flows: number
  /** Map → earth ground morph. */
  ground: number
  /** The paper diorama rising (architecture, then people). */
  rise: number
  people: number
  haze: number
  /** Year indicator visibility (the embossed year lifts off the paper into it). */
  yearVisible: number
  /** Train departure: 0 at the platform … 1 far down the line. */
  travel: number
  /** Window becomes paper (fadeToPaper into the chronicle). */
  veil: number
}

const cache = { p: -1, timeline: null as Timeline | null, state: null as OpeningState | null }

export function openingState(timeline: Timeline, p: number): OpeningState {
  if (cache.p === p && cache.timeline === timeline && cache.state) return cache.state
  const u = timeline.sceneLocal(p, 'opening')
  const at = (id: ChapterId, f: number) => {
    const r = timeline.chapterRange(id)
    return r.start + (r.end - r.start) * f
  }

  const reveal = paperReveal(u, { start: at('land', 0.15), end: at('born', 0.15) })
  const ink = inkSpread(u, { start: at('partition', 0.0), end: at('partition', 0.7) })
  const world = mapToWorld(u, { start: at('migration', 0.3), end: at('protagonist', 0.25) })

  const state: OpeningState = {
    u,
    dark: 1 - ease.inOutSine(seg(u, at('prologue', 0.5), at('land', 0.4))),
    dustGather: ease.inOutCubic(seg(u, at('prologue', 0.05), at('prologue', 0.92))),
    dustAlpha: 1 - ease.inQuad(seg(u, at('land', 0.0), at('land', 0.55))),
    coast: ease.smoothstep(seg(u, at('prologue', 0.6), at('land', 0.25))),
    reveal: reveal.reveal,
    revealEdge: reveal.edge,
    emboss: bell(u, at('land', 0.2), at('born', 0.35), at('land', 0.5) - at('land', 0.2), at('born', 0.35) - at('born', 0.05)),
    light: lightSweep(u, { start: at('prologue', 0.6), end: at('born', 1) }),
    wash: ease.inOutSine(seg(u, at('born', 0.15), at('born', 0.7))) * (1 - ease.inOutSine(seg(u, at('migration', 0.2), at('migration', 0.7)))),
    ink: ink.ink,
    inkBleed: ink.bleed,
    split: ease.inOutSine(seg(u, at('partition', 0.45), at('migration', 0.25))),
    flows: bell(u, at('partition', 0.6), at('migration', 0.62), 0.03, 0.035),
    ground: world.ground,
    rise: world.rise,
    people: world.people,
    haze: world.haze,
    yearVisible: ease.inOutSine(seg(u, at('born', 0.0), at('born', 0.3))),
    travel: ease.inOutSine(seg(u, at('departure', 0.0), at('journey', 1))),
    veil: ease.inOutSine(seg(u, at('journey', 0.25), at('journey', 0.92))),
  }
  cache.p = p
  cache.timeline = timeline
  cache.state = state
  return state
}
