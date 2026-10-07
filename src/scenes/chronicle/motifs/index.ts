import type { MotifId, StoryEvent } from '@/data/story/types'
import type { MotifGenerator, MotifOutput } from './types'
import { ballot, constitution, council, dialogue, documentMotif, ledger, nameplate, pact, portrait } from './state'
import { constellation, contours, dam, frontline, network, rivers, route, seismic, split } from './land'
import { aircraft, crowd, horizon, industry, memorial, rocket, trajectory, unification } from './life'

/** Registry: one generator per visual metaphor (brief STEP 11). Data picks the metaphor; the engine draws it. */
const REGISTRY: Record<MotifId, MotifGenerator> = {
  portrait,
  document: documentMotif,
  constitution,
  nameplate,
  rivers,
  dam,
  route,
  crowd,
  trajectory,
  aircraft,
  rocket,
  split,
  contours,
  seismic,
  frontline,
  memorial,
  industry,
  ballot,
  unification,
  dialogue,
  horizon,
  network,
  council,
  constellation,
  ledger,
  pact,
}

const cache = new Map<string, MotifOutput>()

export function generateMotif(event: StoryEvent): MotifOutput {
  const hit = cache.get(event.id)
  if (hit) return hit
  const out = REGISTRY[event.visualTreatment.motif]?.(event) ?? { strokes: [] }
  cache.set(event.id, out)
  return out
}
