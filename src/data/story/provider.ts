import { createContext, useContext } from 'react'
import { OPENING_CHAPTERS, type OpeningChapter } from './chapters'
import { STORY_EVENTS } from './events'
import type { StoryEvent } from './types'
import { buildTimeline, type Timeline } from '@/engine/timeline/timeline'

/**
 * Story content seam. Pacing (seconds per beat) is cinematic direction and stays in the frontend;
 * chapter copy, events and IN POWER data are content the backend will later supply.
 *
 * To connect the backend: implement StoryProvider over the API (same StoryEvent shape), build the
 * timeline from its events, and call `cinematic.get().setTimeline(provider.timeline())` once loaded.
 * The engine re-paces itself; nothing in the scenes changes.
 */
export interface StoryProvider {
  opening: readonly OpeningChapter[]
  events(): readonly StoryEvent[]
  event(id: string): StoryEvent | undefined
  timeline(): Timeline
}

function createStaticProvider(opening: readonly OpeningChapter[], events: readonly StoryEvent[]): StoryProvider {
  let cached: Timeline | null = null
  const byId = new Map(events.map((e) => [e.id, e]))
  return {
    opening,
    events: () => events,
    event: (id) => byId.get(id),
    timeline() {
      cached ??= buildTimeline({ opening, events })
      return cached
    },
  }
}

export const staticStoryProvider: StoryProvider = createStaticProvider(OPENING_CHAPTERS, STORY_EVENTS)

export const StoryContext = createContext<StoryProvider>(staticStoryProvider)

export function useStory(): StoryProvider {
  return useContext(StoryContext)
}
