import type { PerspectiveCamera } from 'three'
import type { CameraPose } from './CameraController'

/**
 * Anything that can produce a camera pose from progress. CameraController (keyframes) is one;
 * procedural rigs (e.g. the chronicle's path camera) are another.
 */
export interface CameraRig {
  evaluate(p: number, out: CameraPose): CameraPose
}

export interface DirectedShot {
  /** Global progress range this rig owns. */
  start: number
  end: number
  rig: CameraRig
  /** Feed the rig progress local to [start, end] (true) or global progress (false). */
  localize: boolean
}

/**
 * Chooses which rig films a given moment. Shots are cut, not blended: every handoff in the film
 * happens under a full-frame transition (fadeToPaper), so a hard cut is invisible and keeps each
 * rig simple and reversible.
 */
export class CameraDirector {
  constructor(private readonly shots: DirectedShot[]) {}

  evaluate(p: number, out: CameraPose): CameraPose {
    let shot = this.shots[0]
    for (const s of this.shots) if (p >= s.start) shot = s
    const span = shot.end - shot.start
    const q = shot.localize ? (span > 0 ? Math.min(1, Math.max(0, (p - shot.start) / span)) : 0) : p
    return shot.rig.evaluate(q, out)
  }

  applyTo(camera: PerspectiveCamera, p: number, pose: CameraPose): void {
    this.evaluate(p, pose)
    applyPose(camera, pose)
  }
}

const tmpDir = { x: 0, y: 0, z: 0 }

/** Aspect every shot was composed for (desktop, 16:9). */
const COMPOSED_ASPECT = 16 / 9
const MAX_FOV = 74

/**
 * Narrower screens (a phone in portrait) would lose the sides of every composition. Keep at least
 * ~70% of the composed horizontal field by widening the vertical FOV, capped to avoid distortion.
 */
function fovFor(composed: number, aspect: number): number {
  if (aspect >= COMPOSED_ASPECT * 0.9) return composed
  const half = (composed * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(half) * COMPOSED_ASPECT) * 0.72
  const needed = (2 * Math.atan(Math.tan(hHalf) / aspect) * 180) / Math.PI
  return Math.min(MAX_FOV, Math.max(composed, needed))
}

/** Writes a pose onto a camera (shared by every rig). */
export function applyPose(camera: PerspectiveCamera, pose: CameraPose): void {
  camera.position.copy(pose.position)
  tmpDir.x = pose.lookAt.x - pose.position.x
  tmpDir.y = pose.lookAt.y - pose.position.y
  tmpDir.z = pose.lookAt.z - pose.position.z
  const len = Math.hypot(tmpDir.x, tmpDir.y, tmpDir.z) || 1
  // Guard against a degenerate up vector when looking almost straight down.
  if (Math.abs(tmpDir.y / len) > 0.999) camera.up.set(0, 0, -1)
  else camera.up.set(0, 1, 0)
  camera.lookAt(pose.lookAt)
  if (pose.roll !== 0) camera.rotateZ(pose.roll)
  const fov = fovFor(pose.fov, camera.aspect)
  if (camera.fov !== fov) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}
