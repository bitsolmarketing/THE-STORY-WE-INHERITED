import { useEffect, useRef } from 'react'
import { cinematic, frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { startJudgesCut } from '@/engine/judgesCut'
import { travelTo } from '@/engine/navigation'
import { MOVEMENTS } from '@/data/story/movements'
import './Intro.css'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The entry state (brief §23). Within seconds a visitor knows what this is and how to begin:
 * the two ways in (the curated two-minute Judges' Cut, or the full journey by scrolling) and the
 * deeper layers (timeline, archive, about). The film's dark prologue breathes behind it.
 */
export function Intro() {
  const entered = useCinematicStore((s) => s.entered)
  const ready = useCinematicStore((s) => s.ready)
  const timeline = useCinematicStore((s) => s.timeline)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (ready && !entered) primary.current?.focus({ preventScroll: true })
  }, [ready, entered])

  // Entering by simply scrolling also works: the first scroll is the journey beginning.
  useEffect(() => {
    if (entered) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0 && cinematic.get().ready && !cinematic.get().overlay) enterFull()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [entered])

  const resumeYear = timeline.beatAt(frame.progress).year
  const canResume = frame.progress > 0.03

  function enterFull() {
    const s = cinematic.get()
    s.setAudioUnlocked()
    s.enter()
    s.setMode('free')
  }

  return (
    <section className={`intro${entered ? ' is-gone' : ''}${ready ? ' is-ready' : ''}`} aria-hidden={entered} aria-label="Inherited — entry">
      <p className="intro__presents t-ui">Vactra Tech presents</p>

      <div className="intro__title">
        <h1 className="intro__name">Inherited</h1>
        <p className="intro__sub">A Visual History of Pakistan</p>
        <p className="intro__meta t-ui">
          1947 — 2026 · {timeline.eventBeats.length + 2} chapters · {Object.keys(MOVEMENTS).length} movements · an interactive cinematic journey
        </p>
      </div>

      <div className="intro__actions">
        <button ref={primary} type="button" className="intro__primary" tabIndex={entered ? -1 : 0} onClick={() => startJudgesCut(true)}>
          <span className="intro__play" aria-hidden="true" />
          <span>
            <span className="intro__btn-title">Play the Judges’ Cut</span>
            <span className="intro__btn-sub t-ui">The curated film · {clock(timeline.judgesTotalSeconds)}</span>
          </span>
        </button>
        <button type="button" className="intro__secondary" tabIndex={entered ? -1 : 0} onClick={enterFull}>
          <span className="intro__arrow" aria-hidden="true" />
          <span>
            <span className="intro__btn-title">{canResume ? `Continue the journey · ${resumeYear}` : 'Enter the full experience'}</span>
            <span className="intro__btn-sub t-ui">Scroll to travel through time</span>
          </span>
        </button>
      </div>

      <nav className="intro__links t-ui" aria-label="More">
        <button type="button" tabIndex={entered ? -1 : 0} onClick={() => (enterFull(), cinematic.get().openOverlay('timeline'))}>
          Timeline
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" tabIndex={entered ? -1 : 0} onClick={() => (enterFull(), cinematic.get().openArchive({ eventId: null }))}>
          Archive
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" tabIndex={entered ? -1 : 0} onClick={() => (enterFull(), cinematic.get().openOverlay('about'))}>
          About the experience
        </button>
        {canResume && (
          <>
            <span aria-hidden="true">·</span>
            <button type="button" tabIndex={entered ? -1 : 0} onClick={() => (enterFull(), travelTo(0))}>
              Start from 1947
            </button>
          </>
        )}
      </nav>

      <p className="intro__foot t-ui">
        <span>A Vactra Tech interactive experience</span>
        <span>Sound recommended · Scroll, trackpad or arrow keys</span>
      </p>
    </section>
  )
}
