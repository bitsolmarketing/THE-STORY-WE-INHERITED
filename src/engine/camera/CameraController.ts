import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three'
import { clamp01, ease, type Easing } from '@/engine/progress/ranges'

/**
 * Reusable keyframed camera path driven purely by cinematic progress.
 *
 * - position and lookAt are interpolated along centripetal Catmull-Rom splines through all
 *   keyframes (C1 continuous, no kinks), parameterised by progress so pacing is authored by `at`.
 * - fov is interpolated per segment.
 * - `ease` on a keyframe shapes the local time of the segment that *ends* at it
 *   (default linear, so the spline alone governs motion; use inOutSine where the camera should come to rest).
 * - Holding: repeat a keyframe with the same position/lookAt at a later `at` to keep the camera still.
 * - Reverse scrolling works by construction: evaluation is a pure function of progress.
 *
 * No noise, no shake, no idle rotation (spec §20).
 */
export interface CameraKeyframe {
  at: number
  position: [number, number, number]
  lookAt: [number, number, number]
  fov?: number
  ease?: Easing
  /** Optional roll in radians around the view axis (default 0). Use sparingly. */
  roll?: number
}

export interface CameraPose {
  position: Vector3
  lookAt: Vector3
  fov: number
  roll: number
}

const DEFAULT_FOV = 38

export class CameraController {
  private keys: CameraKeyframe[]
  private posCurve: CatmullRomCurve3
  private lookCurve: CatmullRomCurve3
  private tmpUp = new Vector3()
  private tmpDir = new Vector3()
  private tmpRight = new Vector3()

  constructor(keys: CameraKeyframe[]) {
    if (keys.length < 2) throw new Error('CameraController needs at least two keyframes')
    this.keys = [...keys].sort((a, b) => a.at - b.at)
    this.posCurve = new CatmullRomCurve3(
      this.keys.map((k) => new Vector3(...k.position)),
      false,
      'centripetal',
      0.5,
    )
    this.lookCurve = new CatmullRomCurve3(
      this.keys.map((k) => new Vector3(...k.lookAt)),
      false,
      'centripetal',
      0.5,
    )
  }

  get keyframes(): readonly CameraKeyframe[] {
    return this.keys
  }

  /** Index of the segment containing p and the eased local t inside it. */
  private locate(p: number): { i: number; t: number } {
    const keys = this.keys
    const n = keys.length
    if (p <= keys[0].at) return { i: 0, t: 0 }
    if (p >= keys[n - 1].at) return { i: n - 2, t: 1 }
    let i = 0
    while (i < n - 2 && p >= keys[i + 1].at) i++
    const a = keys[i].at
    const b = keys[i + 1].at
    const raw = b > a ? (p - a) / (b - a) : 1
    const fn = keys[i + 1].ease ?? ease.linear
    return { i, t: clamp01(fn(clamp01(raw))) }
  }

  evaluate(p: number, out: CameraPose): CameraPose {
    const { i, t } = this.locate(p)
    const n = this.keys.length
    // Curve parameter: keyframe i sits at u = i / (n - 1).
    const u = (i + t) / (n - 1)
    this.posCurve.getPoint(u, out.position)
    this.lookCurve.getPoint(u, out.lookAt)
    const fa = this.keys[i].fov ?? DEFAULT_FOV
    const fb = this.keys[i + 1].fov ?? DEFAULT_FOV
    out.fov = fa + (fb - fa) * ease.smoothstep(t)
    const ra = this.keys[i].roll ?? 0
    const rb = this.keys[i + 1].roll ?? 0
    out.roll = ra + (rb - ra) * ease.smoothstep(t)
    return out
  }

  /** Writes the pose for progress p straight onto a camera. */
  applyTo(camera: PerspectiveCamera, p: number, pose: CameraPose): void {
    this.evaluate(p, pose)
    camera.position.copy(pose.position)
    // Guard against a degenerate up vector when looking almost straight down.
    this.tmpDir.subVectors(pose.lookAt, pose.position).normalize()
    if (Math.abs(this.tmpDir.y) > 0.999) {
      camera.up.set(0, 0, -1)
    } else {
      camera.up.set(0, 1, 0)
    }
    camera.lookAt(pose.lookAt)
    if (pose.roll !== 0) {
      camera.rotateZ(pose.roll)
    }
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
    // Keep temporaries warm for GC-free frames.
    this.tmpUp.copy(camera.up)
    this.tmpRight.crossVectors(this.tmpDir, this.tmpUp)
  }
}

export function createPose(): CameraPose {
  return { position: new Vector3(), lookAt: new Vector3(0, 0, -1), fov: DEFAULT_FOV, roll: 0 }
}
