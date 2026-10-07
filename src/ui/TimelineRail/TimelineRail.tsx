import { useMemo, useRef, useState } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { travelTo } from '@/engine/navigation'
import type { Beat } from '@/engine/timeline/timeline'
import './TimelineRail.css'

/**
 * A miniature railway at the right edge: the film's length, not a list of cards. Decades are marked
 * where they begin in the film; chapters are halts beside the line (major ones in brass); a small
 * train rides the line with the film.
 * Choosing a point travels there (scrolling through when near, through paper when far).
 */
export function TimelineRail() {
  const timeline = useCinematicStore((s) => s.timeline)
  const entered = useCinematicStore((s) => s.entered)
  const needle = useRef<HTMLSpanElement>(null)
  const lastP = useRef(-1)
  const [hover, setHover] = useState<{ y: number; beat: Beat } | null>(null)

  const marks = useMemo(() => {
    const decades: { year: number; p: number }[] = [{ year: timeline.firstYear, p: 0 }]
    let next = Math.ceil((timeline.firstYear + 1) / 10) * 10
    for (const b of timeline.beats) {
      if (b.kind !== 'event') continue
      while (b.year >= next && next <= timeline.lastYear) {
        decades.push({ year: next, p: b.start })
        next += 10
      }
    }
    return { decades, events: timeline.eventBeats }
  }, [timeline])

  useTick((f) => {
    if (Math.abs(f.progress - lastP.current) < 0.0004) return
    lastP.current = f.progress
    if (needle.current) needle.current.style.top = `${(f.progress * 100).toFixed(3)}%`
  })

  const pAt = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  }
  const nearestChapter = (p: number) => {
    const b = cinematic.get().timeline.beatAt(p)
    if (b.kind === 'transition' && b.nextEvent) return cinematic.get().timeline.byId(b.nextEvent.id) ?? b
    return b
  }

  return (
    <nav className={`rail${entered ? ' is-in' : ''}`} aria-label="Timeline">
      <div
        className="rail__track"
        onPointerMove={(e) => {
          const p = pAt(e)
          setHover({ y: p, beat: nearestChapter(p) })
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const b = nearestChapter(pAt(e))
          cinematic.get().setMode('free')
          travelTo(b.kind === 'event' ? cinematic.get().timeline.restingProgress(b) : b.start + (b.end - b.start) * 0.5)
        }}
      >
        <span className="rail__line" />
        {marks.events.map((b) => (
          <span key={b.id} className={`rail__dot rail__dot--${b.importance ?? 'standard'}`} style={{ top: `${((b.start + b.end) / 2) * 100}%` }} />
        ))}
        <span className="rail__needle" ref={needle} aria-hidden="true">
          <svg viewBox="0 0 13 30">
            {/* Coach (behind), then the locomotive with its chimney leading downward. */}
            <rect x="2" y="0.5" width="9" height="11" rx="1.5" fill="var(--taupe)" stroke="var(--charcoal)" strokeWidth="0.8" />
            <line x1="6.5" y1="2" x2="6.5" y2="10" stroke="var(--charcoal)" strokeWidth="0.6" strokeDasharray="1 1.4" />
            <rect x="1.5" y="13" width="10" height="16" rx="2" fill="var(--charcoal)" />
            <rect x="4" y="16.5" width="5" height="11" rx="2.5" fill="color-mix(in srgb, var(--charcoal) 70%, var(--taupe))" />
            <circle cx="6.5" cy="20" r="1.4" fill="var(--brass)" />
            <circle cx="6.5" cy="25.5" r="1.5" fill="var(--charcoal)" stroke="var(--brass)" strokeWidth="0.7" />
          </svg>
        </span>
        {hover && (
          <span className="rail__tip t-ui" style={{ top: `${hover.y * 100}%` }}>
            <span className="rail__tip-year">{hover.beat.event?.yearLabel ?? hover.beat.year}</span>
            {hover.beat.event?.title ?? hover.beat.chapter?.title ?? ''}
          </span>
        )}
      </div>
      <ol className="rail__decades">
        {marks.decades.map((d) => (
          <li key={d.year} style={{ top: `${d.p * 100}%` }}>
            <button
              type="button"
              className="rail__decade t-ui"
              onClick={() => {
                cinematic.get().setMode('free')
                travelTo(d.p + 0.0005)
              }}
            >
              {d.year}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
