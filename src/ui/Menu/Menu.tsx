import { useMemo } from 'react'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { travelTo } from '@/engine/navigation'
import { startJudgesCut } from '@/engine/judgesCut'
import { MOVEMENTS } from '@/data/story/movements'
import type { MovementId } from '@/data/story/types'
import { Overlay } from '@/ui/Overlay/Overlay'
import './Menu.css'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The editorial index of the experience: the ways to see it on the left, the film's eleven
 * movements on the right (each a door into its first chapter).
 */
export function Menu() {
  const timeline = useCinematicStore((s) => s.timeline)
  const currentMovement = useCinematicStore((s) => s.timeline.beats[s.beatIndex]?.movement)

  const movements = useMemo(() => {
    const out: { id: MovementId; from: number; to: number; first: number }[] = []
    for (const b of timeline.beats) {
      if (b.kind === 'transition') continue
      const m = out[out.length - 1]
      if (!m || m.id !== b.movement) out.push({ id: b.movement, from: b.year, to: b.year, first: b.kind === 'event' ? timeline.restingProgress(b) : b.start + 0.0005 })
      else m.to = b.year
    }
    return out
  }, [timeline])

  const go = (p: number) => {
    cinematic.get().closeOverlay()
    cinematic.get().setMode('free')
    travelTo(p)
  }

  const entries: { n: string; title: string; sub: string; action: () => void }[] = [
    { n: '01', title: 'The Journey', sub: 'Scroll through 1947 – 2026, chapter by chapter', action: () => cinematic.get().closeOverlay() },
    { n: '02', title: 'Judges’ Cut', sub: `The curated film · ${clock(timeline.judgesTotalSeconds)}`, action: () => startJudgesCut(true) },
    { n: '03', title: 'Timeline', sub: 'Every chapter, year by year', action: () => cinematic.get().openOverlay('timeline') },
    { n: '04', title: 'Archive', sub: 'Photographs, newspapers, documents, maps', action: () => cinematic.get().openArchive({ eventId: null }) },
    { n: '05', title: 'Sources & Research', sub: 'What this experience is built on', action: () => cinematic.get().openOverlay('sources') },
    { n: '06', title: 'About the Experience', sub: 'Concept, method, technology, credits', action: () => cinematic.get().openOverlay('about') },
  ]

  return (
    <Overlay id="menu" label="Menu" kicker="Contents">
      <div className="menu">
        <nav className="menu__primary" aria-label="Experience">
          {entries.map((e) => (
            <button type="button" key={e.n} className="menu__entry" onClick={e.action}>
              <span className="menu__n t-ui">{e.n}</span>
              <span className="menu__title">{e.title}</span>
              <span className="menu__sub">{e.sub}</span>
            </button>
          ))}
        </nav>
        <aside className="menu__movements" aria-label="Movements of the film">
          <p className="t-label">The film in eleven movements</p>
          <ol>
            {movements.map((m) => (
              <li key={m.id} className={m.id === currentMovement ? 'is-current' : ''}>
                <button type="button" onClick={() => go(m.first)}>
                  <span className="menu__numeral">{MOVEMENTS[m.id].numeral}</span>
                  <span className="menu__mname">{MOVEMENTS[m.id].name}</span>
                  <span className="menu__years t-ui">{m.from === m.to ? m.from : `${m.from} – ${m.to}`}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <p className="menu__foot t-ui">Inherited · A Visual History of Pakistan · A Vactra Tech interactive experience</p>
    </Overlay>
  )
}
