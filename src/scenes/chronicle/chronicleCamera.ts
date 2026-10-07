import type { CameraRig } from '@/engine/camera/CameraDirector'
import type { CameraPose } from '@/engine/camera/CameraController'
import { bell, ease, mix, seg } from '@/engine/progress/ranges'
import type { Timeline } from '@/engine/timeline/timeline'
import { CHRONICLE, focusAt, spineFrame, spinePoint, type ChronicleLayout } from './layout'
import { heroSlotWorld } from './plateFrame'
import { hasHero } from './filmPrints'

/**
 * Procedural rostrum camera for the chronicle: it looks down at the table at ~40°, focused on the
 * spine, and yaws gently with it. No noise, no shake, no idle rotation.
 *
 * Frames with a photograph: during the HOLD the camera leans down over the hero print (fully for
 * major frames, partly for featured and standard ones), then rises back before the transition.
 * Epilogue: the camera rises straight up off the table.
 */
export function createChronicleRig(timeline: Timeline, layout: ChronicleLayout): CameraRig {
  const pt = { x: 0, z: 0 }
  const fr = { tx: 1, tz: 0, nx: 0, nz: 1 }
  const c = CHRONICLE.camera
  const epilogue = timeline.byId('epilogue')

  return {
    evaluate(p: number, out: CameraPose): CameraPose {
      const q = Math.max(p, timeline.scenes.chronicle.start)
      const s = focusAt(timeline, layout, q)
      spinePoint(s, pt)
      spineFrame(s, fr)

      const rise = epilogue ? ease.inOutCubic(seg(p, epilogue.start + (epilogue.end - epilogue.start) * 0.08, epilogue.end - (epilogue.end - epilogue.start) * 0.12)) : 0
      const height = mix(c.height, 150, rise)
      const back = mix(c.back, 2, rise)

      let lx = pt.x + fr.nx * c.lookLateral
      let lz = pt.z + fr.nz * c.lookLateral
      let px = lx - fr.tx * back
      let pz = lz - fr.tz * back
      let py = height
      let fov = mix(c.fov, 40, rise)

      // Cutaway to the hero photograph during the hold of major / featured frames.
      const beat = timeline.beatAt(q)
      if (beat.kind === 'event' && beat.event && hasHero(beat.event)) {
        const slot = layout.slotFor(beat)
        if (slot) {
          const ph = timeline.phases(beat)
          const t = timeline.local(q, beat)
          // Standard frames lean in a little too, so their photographs are never just set dressing.
          const strength = beat.event.visualTreatment.cutaway ?? (beat.importance === 'major' ? 1 : beat.importance === 'featured' ? 0.55 : 0.32)
          const push = strength * ease.inOutSine(bell(t, ph.arrive + 0.08, 0.97, 0.22, 0.2))
          if (push > 0) {
            const hero = heroSlotWorld(slot, beat.event)
            // Over the print, looking almost straight down; image top toward the screen top.
            // Aim a little to its left so the photograph sits right of centre, clear of the caption.
            const hx = hero.x - fr.nx * 1.5
            const hz = hero.z - fr.nz * 1.5
            lx = mix(lx, hx, push)
            lz = mix(lz, hz, push)
            px = mix(px, hx - fr.tx * 1.2, push)
            pz = mix(pz, hz - fr.tz * 1.2, push)
            py = mix(py, hero.height, push)
            fov = mix(fov, 34, push)
          }
        }
      }

      out.lookAt.set(lx, 0, lz)
      out.position.set(px, py, pz)
      out.fov = fov
      out.roll = 0
      return out
    },
  }
}
