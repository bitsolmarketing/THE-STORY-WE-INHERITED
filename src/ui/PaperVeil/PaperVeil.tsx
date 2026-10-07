import { useRef } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic } from '@/engine/store/cinematicStore'
import { ease, seg } from '@/engine/progress/ranges'
import { travel } from '@/engine/navigation'
import { openingState } from '@/scenes/openingCurves'

/**
 * fadeToPaper at film scale: the frame becomes parchment and comes back as another place.
 * Used where the film changes worlds (train window → chronicle table), for the closing statement,
 * and for every long navigation (the camera is never seen teleporting).
 */
export function PaperVeil() {
  const el = useRef<HTMLDivElement>(null)
  const last = useRef(-1)

  useTick((f) => {
    const { timeline } = cinematic.get()
    const p = f.progress
    const chron = timeline.scenes.chronicle
    let v = 0
    if (p < timeline.scenes.opening.end) v = openingState(timeline, p).veil
    else {
      // Hold briefly on paper while the wheel settles on 1948, then lift onto the table.
      const lift = 1.4 / timeline.totalSeconds
      v = 1 - ease.inOutSine(seg(p, chron.start + lift * 0.2, chron.start + lift))
      const epi = timeline.byId('epilogue')
      if (epi && p > epi.start) v = Math.max(v, 0.94 * ease.inOutSine(seg(timeline.local(p, epi), 0.3, 0.52)))
    }
    v = Math.max(v, travel.veil)
    if (Math.abs(v - last.current) < 0.002) return
    last.current = v
    if (el.current) {
      el.current.style.opacity = v.toFixed(3)
      el.current.style.visibility = v < 0.005 ? 'hidden' : 'visible'
    }
  })

  return <div ref={el} className="paper-veil" aria-hidden="true" />
}
