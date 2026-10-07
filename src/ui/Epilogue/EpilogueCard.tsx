import { useRef, useState } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic } from '@/engine/store/cinematicStore'
import { ease, seg } from '@/engine/progress/ranges'
import { travelTo } from '@/engine/navigation'
import { EPILOGUE_LINES } from '@/data/story/movements'
import './EpilogueCard.css'

/**
 * EPILOGUE — THE STORY WE INHERITED. The camera has risen off the table; the paper veil settles;
 * the storyboard's closing statement is set line by line, then a quiet way back into the archive
 * or to 1947.
 */
export function EpilogueCard() {
  const root = useRef<HTMLDivElement>(null)
  const lines = useRef<(HTMLParagraphElement | null)[]>([])
  const actions = useRef<HTMLDivElement>(null)
  const [interactive, setInteractive] = useState(false)
  const last = useRef('')

  useTick((f) => {
    const { timeline } = cinematic.get()
    const epi = timeline.byId('epilogue')
    if (!epi) return
    const t = f.progress <= epi.start ? 0 : timeline.local(f.progress, epi)
    const a = ease.outCubic(seg(t, 0.46, 0.62))
    const b = ease.outCubic(seg(t, 0.58, 0.74))
    const c = ease.outCubic(seg(t, 0.78, 0.92))
    const key = `${a.toFixed(3)}|${b.toFixed(3)}|${c.toFixed(3)}`
    if (key === last.current) return
    last.current = key
    if (root.current) root.current.style.visibility = a > 0.001 ? 'visible' : 'hidden'
    const set = (el: HTMLElement | null, v: number) => {
      if (!el) return
      el.style.opacity = v.toFixed(3)
      el.style.transform = `translate3d(0, ${((1 - v) * 10).toFixed(2)}px, 0)`
    }
    set(lines.current[0], a)
    set(lines.current[1], b)
    set(actions.current, c)
    const on = c > 0.5
    setInteractive((prev) => (prev === on ? prev : on))
  })

  return (
    <div className="epilogue" ref={root} aria-live="polite">
      <p className="epilogue__label t-label">Epilogue · The story we inherited</p>
      {EPILOGUE_LINES.map((line, i) => (
        <p key={line} className="epilogue__line" ref={(el) => void (lines.current[i] = el)}>
          {line}
        </p>
      ))}
      <div className="epilogue__actions" ref={actions} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
        <button type="button" className="t-ui" onClick={() => cinematic.get().openArchive({ eventId: null })} tabIndex={interactive ? 0 : -1}>
          Explore the archive
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="t-ui" onClick={() => cinematic.get().openOverlay('timeline')} tabIndex={interactive ? 0 : -1}>
          Revisit a chapter
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="t-ui" onClick={() => cinematic.get().openOverlay('about')} tabIndex={interactive ? 0 : -1}>
          About the experience
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="t-ui"
          onClick={() => {
            cinematic.get().setMode('free')
            travelTo(0)
          }}
          tabIndex={interactive ? 0 : -1}
        >
          Return to 1947
        </button>
      </div>
      <p className="epilogue__credit t-ui" style={{ opacity: interactive ? 1 : 0 }}>
        Inherited · A Visual History of Pakistan · A Vactra Tech interactive experience
      </p>
    </div>
  )
}
