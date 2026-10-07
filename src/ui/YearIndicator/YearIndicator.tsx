import { useRef } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { odometer } from '@/engine/timeline/timeline'
import { seg } from '@/engine/progress/ranges'
import { travel, travelYear } from '@/engine/navigation'
import { openingState } from '@/scenes/openingCurves'
import { MOVEMENTS } from '@/data/story/movements'
import { useActiveBeat } from '@/ui/useBeat'
import './YearIndicator.css'

const STRIP = ['9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/**
 * The persistent year (spec §15, brief §13): four mechanical wheels set like a date stamp in the
 * lower right. EVENT-LOCKED: it holds while a chapter unfolds and turns only in the transition
 * to the next year, reading every year it passes, like an odometer. Pure function of progress.
 */
export function YearIndicator() {
  const root = useRef<HTMLDivElement>(null)
  const cols = useRef<(HTMLSpanElement | null)[]>([])
  const last = useRef({ digits: [-9, -9, -9, -9], opacity: -1 })
  const year = useCinematicStore((s) => s.year)
  const entered = useCinematicStore((s) => s.entered)
  const beat = useActiveBeat()
  const movement = MOVEMENTS[beat.movement]

  useTick((f) => {
    const { timeline } = cinematic.get()
    const p = f.progress
    const value = travel.active ? travelYear() : timeline.yearAt(p)
    const digits = odometer(value)
    for (let i = 0; i < 4; i++) {
      const v = digits[i]
      if (Math.abs(v - last.current.digits[i]) < 1e-4) continue
      last.current.digits[i] = v
      const el = cols.current[i]
      if (el) el.style.transform = `translate3d(0, ${-(v + 1)}em, 0)`
    }

    let opacity = 1
    if (p < timeline.scenes.opening.end) opacity = openingState(timeline, p).yearVisible
    const epi = timeline.byId('epilogue')
    if (epi && p > epi.start) opacity *= 1 - seg(timeline.local(p, epi), 0.34, 0.5)
    if (travel.active) opacity = Math.max(opacity, 1)
    if (Math.abs(opacity - last.current.opacity) > 0.002) {
      last.current.opacity = opacity
      if (root.current) {
        root.current.style.opacity = opacity.toFixed(3)
        root.current.style.visibility = opacity < 0.01 ? 'hidden' : 'visible'
      }
    }
  })

  return (
    <div className={`year-stamp${entered ? '' : ' is-waiting'}`} ref={root}>
      <p className="year-stamp__movement t-ui" aria-hidden="true">
        <span className="year-stamp__numeral">{movement.numeral}</span>
        {movement.name}
      </p>
      <div className="year-stamp__wheels" role="img" aria-label={`Year ${year}`}>
        {[0, 1, 2, 3].map((i) => (
          <span className="year-stamp__window" key={i} aria-hidden="true">
            <span className="year-stamp__strip" ref={(el) => void (cols.current[i] = el)}>
              {STRIP.map((d, k) => (
                <span className="year-stamp__digit" key={k}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
