import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { frame, useCinematicStore } from '@/engine/store/cinematicStore'
import type { Timeline } from '@/engine/timeline/timeline'
import { PaperScene } from '@/scenes/paper/PaperScene'

/**
 * Mounts scene modules by proximity to the current progress (spec §22: only load what is needed).
 *
 * - PaperScene (paper, dust, map, partition): the ground of the whole opening.
 * - WorldScene (station, crowd, train, landscape): lazy chunk, mounted from late Partition to the
 *   end of the opening.
 * - ChronicleScene (1948 → 2026 table): lazy chunk, preloaded during the opening, mounted around
 *   the train-window → paper handoff.
 *
 * Each window has hysteresis so scrolling back and forth around a threshold never thrashes.
 */
const WorldScene = lazy(() => import('@/scenes/world/WorldScene').then((m) => ({ default: m.WorldScene })))
const ChronicleScene = lazy(() => import('@/scenes/chronicle/ChronicleScene').then((m) => ({ default: m.ChronicleScene })))

interface Windows {
  paper: [number, number]
  world: [number, number]
  chronicle: [number, number]
  preloadWorld: number
  preloadChronicle: number
}

function windowsFor(t: Timeline): Windows {
  const end = t.scenes.opening.end
  const toGlobal = (u: number) => t.scenes.opening.start + u * (end - t.scenes.opening.start)
  return {
    paper: [-1, end + 0.004],
    world: [toGlobal(t.chapterRange('partition').end - 0.02), end + 0.004],
    chronicle: [end - 0.006, 2],
    preloadWorld: toGlobal(t.chapterRange('land').start),
    preloadChronicle: toGlobal(t.chapterRange('protagonist').start),
  }
}

const MARGIN = 0.004

function inWindow(current: boolean, p: number, [a, b]: [number, number]): boolean {
  return current ? p >= a - MARGIN && p <= b + MARGIN : p >= a && p <= b
}

export function SceneManager() {
  const timeline = useCinematicStore((s) => s.timeline)
  const w = useMemo(() => windowsFor(timeline), [timeline])
  const initial = frame.progress
  const [mounted, setMounted] = useState(() => ({
    paper: inWindow(false, initial, w.paper),
    world: inWindow(false, initial, w.world),
    chronicle: inWindow(false, initial, w.chronicle),
  }))
  const preloaded = useRef({ world: false, chronicle: false })

  useFrame(() => {
    const p = frame.progress
    const next = {
      paper: inWindow(mounted.paper, p, w.paper),
      world: inWindow(mounted.world, p, w.world),
      chronicle: inWindow(mounted.chronicle, p, w.chronicle),
    }
    if (next.paper !== mounted.paper || next.world !== mounted.world || next.chronicle !== mounted.chronicle) setMounted(next)
    if (!preloaded.current.world && p >= w.preloadWorld) {
      preloaded.current.world = true
      void import('@/scenes/world/WorldScene')
    }
    if (!preloaded.current.chronicle && p >= w.preloadChronicle) {
      preloaded.current.chronicle = true
      void import('@/scenes/chronicle/ChronicleScene')
    }
  })

  useEffect(() => {
    // A reload deep in the film should not wait for the chunk it is already in.
    if (mounted.world) preloaded.current.world = true
    if (mounted.chronicle) preloaded.current.chronicle = true
  }, [mounted])

  return (
    <>
      {mounted.paper && <PaperScene />}
      {mounted.world && (
        <Suspense fallback={null}>
          <WorldScene />
        </Suspense>
      )}
      {mounted.chronicle && (
        <Suspense fallback={null}>
          <ChronicleScene />
        </Suspense>
      )}
    </>
  )
}
