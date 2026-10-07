import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { frame, cinematic } from '@/engine/store/cinematicStore'
import { damp } from '@/engine/progress/ranges'
import { createPose } from '@/engine/camera/CameraController'
import type { CameraDirector } from '@/engine/camera/CameraDirector'
import { runTicks } from './ticker'
import { glide, travel } from '@/engine/navigation'

/** Exponential approach rate of the film toward the scroll position (lower = heavier). */
const HEAVY_LAMBDA = 3.2
/** Fastest the film may run under free scrolling, in film seconds per real second. */
const MAX_FILM_SPEED = 7
/** Film speed for deliberate glides (timeline clicks, ← → chapter keys). */
const GLIDE_FILM_SPEED = 13
/** How far (film seconds) the scroll position may run ahead of the film before it is drawn back. */
const LEASH_SECONDS = 8

/**
 * The centralized animation step. Runs first every frame (negative priority):
 *   1. damp progress toward the scroll target (frame-rate independent)
 *   2. drive the camera from progress (the director picks the rig for this moment)
 *   3. publish coarse beat changes to the reactive store (only when they change)
 *   4. run DOM ticks (year wheel, captions, veils) from the same frame
 *
 * Every scene reads `frame.progress` in its own useFrame afterwards. No React state per frame.
 */
export function CinematicLoop({ director }: { director: CameraDirector }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const pose = useMemo(() => createPose(), [])
  const lastBeat = useRef<string | null>(null)

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0), 1 / 20)
    frame.dt = dt
    frame.time += dt

    const prev = frame.progress
    const { reducedMotion, timeline, mode, playing } = cinematic.get()
    // Heavy, controlled glide for free scrolling; tighter when the Judges' Cut drives the scroll;
    // reduced motion follows the scrollbar more directly (less floating).
    const autoplay = mode === 'judges' && playing
    const lambda = reducedMotion ? 12 : autoplay ? 9 : glide.active ? 4.5 : HEAVY_LAMBDA
    let next = damp(prev, frame.target, lambda, dt)
    // A deliberate jump (timeline, chapter keys) may travel faster than a careless flick.
    const maxSpeed = glide.active ? GLIDE_FILM_SPEED : MAX_FILM_SPEED
    // Speed cap (film seconds per real second): a careless flick plays the film through quickly,
    // it never skips decades in a frame. Travel cuts place progress directly under the veil; the
    // Judges' Cut is paced by its own clock.
    if (!travel.active && !autoplay) {
      const maxStep = (maxSpeed / timeline.totalSeconds) * dt
      next = prev + Math.max(-maxStep, Math.min(maxStep, next - prev))
    }
    if (Math.abs(next - frame.target) < 1e-5) next = frame.target
    // Leash: a flick may run the page at most ~one chapter ahead of the film. The scroll position is
    // drawn back so the film never keeps travelling for seconds after the hand has stopped.
    if (!travel.active && !autoplay && !glide.active) {
      const leash = LEASH_SECONDS / timeline.totalSeconds
      const ahead = frame.target - next
      if (Math.abs(ahead) > leash) {
        const p = next + Math.sign(ahead) * leash
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        window.scrollTo({ top: p * max, behavior: 'auto' })
        frame.target = p
      }
    }
    frame.progress = next
    frame.velocity = dt > 0 ? (next - prev) / dt : 0

    director.applyTo(camera, next, pose)

    const beat = timeline.beatAt(next)
    if (beat.id !== lastBeat.current) {
      lastBeat.current = beat.id
      cinematic.get().setBeat(beat)
    }

    runTicks(frame)
  }, -1000)

  return null
}
