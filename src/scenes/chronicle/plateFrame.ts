import { Matrix4, Quaternion, Vector3 } from 'three'
import type { StoryEvent } from '@/data/story/types'
import { CHRONICLE, spineFrame, spinePoint, type ChronicleSlot } from './layout'
import type { UV } from './motifs/types'

/**
 * Where a frame lies on the table (plate space → world), and where its photographs go.
 * Prints are laid on the left of the frame like photographs on a historian's desk: the hero
 * first, then up to three more, overlapping, each arriving a moment later.
 */
export interface PrintSlot {
  at: UV
  width: number
  angle: number
  /** Beat-local window over which it is laid down. */
  enter: number
}

/**
 * The hero sits centre-left; the others are tucked half under it, up and to the sides, like a
 * small pile on a desk — never in the lower-left (the caption) or lower-right (the year).
 */
export function printSlots(event: StoryEvent, count: number): PrintSlot[] {
  const w = event.importance === 'major' ? 4.4 : event.importance === 'featured' ? 3.9 : 3.3
  const all: PrintSlot[] = [
    { at: [-2.7, 0.8], width: w, angle: 0.0, enter: 0.04 },
    { at: [-5.1, 2.9], width: 2.3, angle: 0.09, enter: 0.3 },
    { at: [-0.3, 3.5], width: 2.1, angle: -0.07, enter: 0.42 },
    { at: [-5.7, 0.9], width: 1.9, angle: -0.05, enter: 0.52 },
  ]
  return all.slice(0, count)
}

/** Frames sit a little ahead of the focus point, so they read in the upper two-thirds of the screen. */
const PLATE_FORWARD = 1.3

export function plateTransform(slot: ChronicleSlot) {
  const p = spinePoint(slot.sMid)
  const f = spineFrame(slot.sMid)
  const position = new Vector3(
    p.x + f.nx * CHRONICLE.plateLateral + f.tx * PLATE_FORWARD,
    0,
    p.z + f.nz * CHRONICLE.plateLateral + f.tz * PLATE_FORWARD,
  )
  const basis = new Matrix4().makeBasis(new Vector3(f.nx, 0, f.nz), new Vector3(0, 1, 0), new Vector3(-f.tx, 0, -f.tz))
  const quaternion = new Quaternion().setFromRotationMatrix(basis)
  // Prints: image top must face forward along the spine.
  const printYaw = Math.atan2(-f.tx, -f.tz)
  return { position, quaternion, frame: f, printYaw }
}

export function plateToWorld(slot: ChronicleSlot, uv: UV): Vector3 {
  const xf = plateTransform(slot)
  return new Vector3(uv[0], 0, -uv[1]).applyQuaternion(xf.quaternion).add(xf.position)
}

const heroCache = new WeakMap<ChronicleSlot, { x: number; z: number; height: number }>()

/** World position of the hero print and the camera height at which it fills ~70% of the frame. */
export function heroSlotWorld(slot: ChronicleSlot, event: StoryEvent) {
  const hit = heroCache.get(slot)
  if (hit) return hit
  const s = printSlots(event, 1)[0]
  const w = plateToWorld(slot, s.at)
  // High enough that the print fills about half the frame and the table still shows around it.
  const out = { x: w.x, z: w.z, height: s.width * 2.15 }
  heroCache.set(slot, out)
  return out
}
