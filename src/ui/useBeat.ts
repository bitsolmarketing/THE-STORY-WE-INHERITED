import { useEffect, useState } from 'react'
import { useCinematicStore } from '@/engine/store/cinematicStore'
import type { Beat } from '@/engine/timeline/timeline'
import { useArchiveRepository } from '@/data/archive/repository'
import { isFilmUsable, type ArchiveAsset } from '@/data/archive/types'

/** The active beat (re-renders only when the beat changes, never per frame). */
export function useActiveBeat(): Beat {
  const timeline = useCinematicStore((s) => s.timeline)
  const index = useCinematicStore((s) => s.beatIndex)
  return timeline.beats[Math.min(index, timeline.beats.length - 1)]
}

/** Storyboard event id a beat belongs to (opening chapters tell E01/E02). */
export function eventIdOf(beat: Beat): string | null {
  return beat.event?.id ?? null
}

/** Film-usable archive prints for an event's visual treatment (clear rights + local image only). */
export function useFilmPrints(ids: readonly string[] | undefined): ArchiveAsset[] {
  const repo = useArchiveRepository()
  const key = (ids ?? []).join('|')
  const [assets, setAssets] = useState<ArchiveAsset[]>([])
  useEffect(() => {
    let cancelled = false
    if (!key) {
      setAssets([])
      return
    }
    Promise.all(key.split('|').map((id) => repo.get(id))).then((list) => {
      if (!cancelled) setAssets(list.filter((a): a is ArchiveAsset => a !== null && isFilmUsable(a)))
    })
    return () => {
      cancelled = true
    }
  }, [key, repo])
  return assets
}

/** Number of archive records behind an event (for the archive trigger). */
export function useRecordCount(eventId: string | null): number | null {
  const repo = useArchiveRepository()
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!eventId) {
      setCount(null)
      return
    }
    repo.list({ eventId }).then((l) => !cancelled && setCount(l.length))
    return () => {
      cancelled = true
    }
  }, [eventId, repo])
  return count
}
