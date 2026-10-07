import { useEffect, useRef } from 'react'
import { frame, type FrameState } from '@/engine/store/cinematicStore'

/**
 * DOM side of the single animation loop.
 *
 * CinematicLoop calls `runTicks()` once per frame after progress, camera and beat are updated.
 * DOM UI (year wheel, captions, veils) subscribes here and writes styles directly through refs,
 * so per-frame values never pass through React state and there is still only one RAF loop.
 */
type Tick = (f: FrameState) => void

const subscribers = new Set<Tick>()

export function onTick(fn: Tick): () => void {
  subscribers.add(fn)
  // Paint the current state immediately so newly mounted UI never flashes a default.
  fn(frame)
  return () => {
    subscribers.delete(fn)
  }
}

export function runTicks(f: FrameState): void {
  for (const fn of subscribers) fn(f)
}

/** Subscribe a component to the loop. The latest closure is always used; no re-subscription churn. */
export function useTick(fn: Tick): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => onTick((f) => ref.current(f)), [])
}
