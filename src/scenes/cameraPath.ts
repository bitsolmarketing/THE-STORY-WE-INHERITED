import { CameraController, type CameraKeyframe } from '@/engine/camera/CameraController'
import { CameraDirector } from '@/engine/camera/CameraDirector'
import { ease } from '@/engine/progress/ranges'
import type { Timeline } from '@/engine/timeline/timeline'
import type { ChapterId } from '@/data/story/chapters'
import { INTERIOR, TRAIN, MAP_FRAMES } from '@/scenes/world/layout'
import { createChronicleRig } from '@/scenes/chronicle/chronicleCamera'
import { buildChronicleLayout } from '@/scenes/chronicle/layout'

/**
 * The camera for the whole film. Narrative beats for the opening are documented in
 * docs/ARCHITECTURE.md §4. Keyframes are authored RELATIVE TO CHAPTERS (`at('partition', 0.5)`)
 * so re-pacing the story in data never breaks the camera. Tune numbers here, nowhere else.
 */
export function openingKeyframes(timeline: Timeline): CameraKeyframe[] {
  const at = (id: ChapterId, f: number) => {
    const r = timeline.chapterRange(id)
    return r.start + (r.end - r.start) * f
  }
  const seat = INTERIOR.seat
  const look = INTERIOR.lookTarget
  const door = TRAIN.door
  const wide = MAP_FRAMES.subcontinent
  const wings = MAP_FRAMES.wings
  const punjab = MAP_FRAMES.punjab

  return [
    // PROLOGUE — darkness and dust, high above the subcontinent. Almost no movement: the dust moves.
    { at: 0, position: [wide.x - 2, wide.height + 24, wide.z + 34], lookAt: [wide.x, 0, wide.z], fov: 38 },
    { at: at('prologue', 1), position: [wide.x - 1, wide.height + 8, wide.z + 30], lookAt: [wide.x, 0, wide.z], fov: 38 },

    // LAND — the outline is inked; the map soaks into the paper; 1947 is pressed into it.
    { at: at('land', 1), position: [wide.x, wide.height, wide.z + 28], lookAt: [wide.x, 0, wide.z - 1], fov: 38 },

    // BORN — reframe on the two wings of the new state, west and east.
    { at: at('born', 0.85), position: [wings.x, wings.height, wings.z + 26], lookAt: [wings.x, 0, wings.z], fov: 38, ease: ease.inOutSine },

    // PARTITION — the ink runs; the camera leans toward the Punjab, where the line will be crossed.
    { at: at('partition', 1), position: [punjab.x + 4, punjab.height, punjab.z + 26], lookAt: [punjab.x + 1, 0, punjab.z + 2], fov: 38 },

    // MIGRATION — down into the Punjab; mapToWorld: the camera tilts to the horizon as the world rises.
    { at: at('migration', 0.45), position: [3, 24, 22], lookAt: [3, 0, 3], fov: 39 },
    { at: at('migration', 0.8), position: [-10, 9, 21], lookAt: [6, 1.2, 2.5], fov: 40 },
    { at: at('migration', 1), position: [-6, 2.6, 7.6], lookAt: [8, 1.8, 3.4], fov: 42, ease: ease.inOutSine },

    // PROTAGONIST — over-the-shoulder, trailing them along the platform toward the door.
    { at: at('protagonist', 0.5), position: [6.6, 2.55, 5.6], lookAt: [11, 1.8, 3.6], fov: 42 },
    { at: at('protagonist', 1), position: [15, 2.5, 4.7], lookAt: [door.x, 2.1, door.z], fov: 42 },

    // TRAIN — cameraPush through the door, into the compartment, down onto the seat.
    { at: at('train', 0.4), position: [door.x - 0.2, 2.6, 2.5], lookAt: [door.x + 1.5, 2.4, -0.5], fov: 44 },
    { at: at('train', 0.75), position: [door.x + 1.6, 2.55, 0.2], lookAt: [seat.x + 0.4, 2.4, -1.6], fov: 44 },
    { at: at('train', 1), position: [seat.x, seat.y, seat.z], lookAt: [look.x, look.y, look.z], fov: 46, ease: ease.inOutSine },

    // DEPARTURE — the camera holds. The world moves.
    { at: at('departure', 1), position: [seat.x, seat.y, seat.z], lookAt: [look.x, look.y, look.z], fov: 46 },

    // JOURNEY — a slow push toward the open window until it fills the frame and becomes paper.
    { at: at('journey', 0.6), position: [seat.x, seat.y + 0.02, seat.z - 0.55], lookAt: [seat.x + 0.6, look.y + 0.05, look.z], fov: 42 },
    { at: 1, position: [seat.x, INTERIOR.window.y, INTERIOR.window.z + 0.55], lookAt: [seat.x, INTERIOR.window.y, look.z], fov: 38, ease: ease.inOutSine },
  ]
}

export function createCameraDirector(timeline: Timeline): CameraDirector {
  const opening = new CameraController(openingKeyframes(timeline))
  const chronicle = createChronicleRig(timeline, buildChronicleLayout(timeline))
  return new CameraDirector([
    { start: timeline.scenes.opening.start, end: timeline.scenes.opening.end, rig: opening, localize: true },
    { start: timeline.scenes.chronicle.start, end: timeline.scenes.chronicle.end, rig: chronicle, localize: false },
  ])
}
