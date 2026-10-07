import { useMemo } from 'react'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { travelTo } from '@/engine/navigation'
import type { Beat } from '@/engine/timeline/timeline'
import { MOVEMENTS } from '@/data/story/movements'
import type { MovementId } from '@/data/story/types'
import { filmPrintsFor } from '@/scenes/chronicle/filmPrints'
import { Overlay } from '@/ui/Overlay/Overlay'
import './TimelineExplorer.css'

interface Row {
  key: string
  year: number
  yearLabel: string
  title: string
  line: string
  importance: 'major' | 'featured' | 'standard'
  thumb?: string
  p: number
  eventId: string
}

/**
 * LAYER 02 — the navigable timeline. Editorial, like the contents of a book: the movements as
 * parts, every storyboard chapter as an entry with its year, title, line and (when the archive
 * holds one) a photograph. Choosing an entry travels there through paper; the film continues.
 */
export function TimelineExplorer() {
  const timeline = useCinematicStore((s) => s.timeline)
  const currentYear = useCinematicStore((s) => s.year)

  const parts = useMemo(() => {
    const groups: { id: MovementId; rows: Row[] }[] = []
    const push = (id: MovementId, row: Row) => {
      const g = groups[groups.length - 1]
      if (!g || g.id !== id) groups.push({ id, rows: [row] })
      else g.rows.push(row)
    }
    // The opening tells E01 and E02 across several chapters: one entry each.
    const opening = timeline.beats.filter((b) => b.kind === 'opening')
    for (const evId of ['E01', 'E02'] as const) {
      const first = opening.find((b) => b.chapter?.eventId === evId && b.chapter.title)
      const ev = opening.find((b) => b.event?.id === evId)?.event
      if (!first || !ev) continue
      push(ev.movement, {
        key: evId,
        year: 1947,
        yearLabel: ev.yearLabel ?? '1947',
        title: ev.title,
        line: ev.description,
        importance: ev.importance,
        thumb: filmPrintsFor(ev, 1)[0]?.thumbPath,
        p: first.start + (first.end - first.start) * 0.4,
        eventId: evId,
      })
    }
    for (const b of timeline.eventBeats as Beat[]) {
      const ev = b.event!
      push(ev.movement, {
        key: ev.id,
        year: ev.year,
        yearLabel: ev.yearLabel ?? String(ev.year),
        title: ev.title,
        line: ev.description,
        importance: ev.importance,
        thumb: filmPrintsFor(ev, 1)[0]?.thumbPath,
        p: timeline.restingProgress(b),
        eventId: ev.id,
      })
    }
    return groups
  }, [timeline])

  const years = useMemo(() => [...new Set(parts.flatMap((g) => g.rows.map((r) => r.year)))], [parts])

  const go = (p: number) => {
    const s = cinematic.get()
    s.closeOverlay()
    s.setMode('free')
    travelTo(p)
  }

  const firstOfYear = (y: number) => parts.flatMap((g) => g.rows).find((r) => r.year === y)

  return (
    <Overlay id="timeline" label="Timeline" kicker="Timeline" wide>
      <header className="tl-head">
        <p className="t-label page-kicker">1947 — 2026 · {parts.reduce((n, g) => n + g.rows.length, 0)} chapters</p>
        <h1 className="page-title">
          The years, <em>chapter by chapter</em>
        </h1>
      </header>

      <nav className="tl-years" aria-label="Jump to a year">
        {years.map((y) => (
          <button key={y} type="button" className={`tl-year t-ui${y === currentYear ? ' is-current' : ''}`} onClick={() => go(firstOfYear(y)!.p)}>
            {y}
          </button>
        ))}
      </nav>

      <div className="tl-parts">
        {parts.map((g) => (
          <section key={`${g.id}-${g.rows[0].key}`} className="tl-part">
            <header className="tl-part__head">
              <span className="tl-part__numeral t-ui">{MOVEMENTS[g.id].numeral}</span>
              <h2 className="tl-part__name">{MOVEMENTS[g.id].name}</h2>
              <span className="tl-part__years t-ui">
                {g.rows[0].year === g.rows[g.rows.length - 1].year ? g.rows[0].year : `${g.rows[0].year} – ${g.rows[g.rows.length - 1].year}`}
              </span>
            </header>
            <ol className="tl-rows">
              {g.rows.map((r) => (
                <li key={r.key} className={`tl-row tl-row--${r.importance}${r.year === currentYear ? ' is-current' : ''}`}>
                  <button type="button" onClick={() => go(r.p)}>
                    <span className="tl-row__year">{r.yearLabel}</span>
                    <span className="tl-row__text">
                      <span className="tl-row__title">{r.title}</span>
                      <span className="tl-row__line">{r.line}</span>
                    </span>
                    <span className="tl-row__thumb" aria-hidden="true">
                      {r.thumb ? <img src={r.thumb} alt="" loading="lazy" decoding="async" /> : <span className="tl-row__nothumb">{r.eventId}</span>}
                    </span>
                    <span className="tl-row__go t-ui">Travel →</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Overlay>
  )
}
