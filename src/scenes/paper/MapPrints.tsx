import { useMemo } from 'react'
import { cinematic } from '@/engine/store/cinematicStore'
import { bell } from '@/engine/progress/ranges'
import { staticStoryProvider } from '@/data/story/provider'
import { Print, type PrintReveal } from '@/scenes/shared/Print'
import { filmPrintsFor, type FilmPrint } from '@/scenes/chronicle/filmPrints'
import type { ChapterId } from '@/data/story/chapters'

/**
 * Authentic archival prints laid on the 1947 map while their moment is told (spec §09):
 * the birth of the state (E01) across Born and Partition, then Migration (E02) as the camera
 * descends into the Punjab. Only film-usable images (clear rights, real material, held locally).
 */
interface Placement {
  chapter: ChapterId
  from: number
  to: number
  position: [number, number, number]
  yaw: number
  width: number
  reveal: PrintReveal
}

const PLACES: Record<'E01' | 'E02', Placement[]> = {
  E01: [
    // East of Tibet, in the empty top-right of the frame (clear of the labels, caption and year).
    // The original is only 420 px wide: at this size it renders at or below its native resolution,
    // large enough to read without being upscaled into blur.
    { chapter: 'born', from: 0.2, to: 1.9, position: [50, 0.05, -9], yaw: 0.04, width: 22, reveal: 'develop' },
    // The 3 June broadcast and the notional boundary map: documents of the plan, opened.
    { chapter: 'partition', from: 0.05, to: 1.25, position: [-12.5, 0.06, 6.5], yaw: 0.06, width: 8, reveal: 'shutter' },
    { chapter: 'partition', from: 0.35, to: 1.3, position: [15.5, 0.07, -3.5], yaw: -0.07, width: 6.5, reveal: 'unfold' },
  ],
  E02: [
    // The refugee trains of 1947, passed one after another onto the Punjab.
    { chapter: 'migration', from: -0.05, to: 0.55, position: [12, 0.08, -4.5], yaw: -0.05, width: 7, reveal: 'slide' },
    { chapter: 'migration', from: 0.08, to: 0.6, position: [-9.5, 0.09, -5.5], yaw: 0.08, width: 5.5, reveal: 'drop' },
    { chapter: 'migration', from: 0.18, to: 0.62, position: [5.5, 0.1, 9.5], yaw: -0.04, width: 5, reveal: 'develop' },
  ],
}

export function MapPrints() {
  const items = useMemo(() => {
    const out: { asset: FilmPrint; place: Placement }[] = []
    for (const id of ['E01', 'E02'] as const) {
      const ev = staticStoryProvider.event(id)
      if (!ev) continue
      filmPrintsFor(ev, PLACES[id].length).forEach((asset, i) => out.push({ asset, place: PLACES[id][i] }))
    }
    return out
  }, [])

  const visibility = (pl: Placement) => (p: number) => {
    const { timeline } = cinematic.get()
    const r = timeline.chapterRange(pl.chapter)
    const len = r.end - r.start
    const u = timeline.sceneLocal(p, 'opening')
    return bell(u, r.start + len * pl.from, r.start + len * pl.to, len * 0.25, len * 0.2)
  }

  return (
    <>
      {items.map(({ asset, place }, i) => (
        <Print key={asset.id} asset={asset} position={place.position} yaw={place.yaw} width={place.width} visibility={visibility(place)} renderOrder={6 + i} reveal={place.reveal} />
      ))}
    </>
  )
}
