import { useRef } from 'react'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { useTick } from '@/engine/loop/ticker'
import { exitJudgesCut, judges, pauseJudgesCut, resumeJudgesCut, startJudgesCut } from '@/engine/judgesCut'
import { useActiveBeat, eventIdOf, useRecordCount } from '@/ui/useBeat'
import './Shell.css'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The bottom rail of the shell: how to move (scroll cue), the Judges' Cut player when it is
 * running, and the two persistent doors — the archive behind this moment, and sound.
 */
export function BottomBar() {
  const entered = useCinematicStore((s) => s.entered)
  const mode = useCinematicStore((s) => s.mode)
  const playing = useCinematicStore((s) => s.playing)
  const hasScrolled = useCinematicStore((s) => s.hasScrolled)
  const soundEnabled = useCinematicStore((s) => s.soundEnabled)
  const overlay = useCinematicStore((s) => s.overlay)
  const total = useCinematicStore((s) => s.timeline.judgesTotalSeconds)
  const beat = useActiveBeat()
  const eventId = eventIdOf(beat)
  const count = useRecordCount(eventId)
  // Re-evaluated whenever playback stops (this component re-renders on `playing`).
  const finished = !playing && judges.time >= total - 0.05
  const elapsed = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const lastShown = useRef(-1)

  useTick((f) => {
    if (cinematic.get().mode !== 'judges') return
    const t = playing ? judges.time : cinematic.get().timeline.judgesTimeAt(f.progress)
    const sec = Math.floor(t)
    if (bar.current) bar.current.style.transform = `scaleX(${(t / total).toFixed(4)})`
    if (sec !== lastShown.current && elapsed.current) {
      lastShown.current = sec
      elapsed.current.textContent = clock(t)
    }
  })

  return (
    <footer className={`bottombar${entered ? ' is-in' : ''}`}>
      <div className="bottombar__left">
        {mode === 'free' && (
          <span className={`scroll-cue t-ui${hasScrolled ? ' is-quiet' : ''}`}>
            <span className="scroll-cue__line" aria-hidden="true" />
            Scroll to travel through time · ← → chapter by chapter
          </span>
        )}
      </div>

      <div className="bottombar__center">
        {mode === 'judges' ? (
          <div className="player" role="group" aria-label="Judges’ Cut playback">
            <button
              type="button"
              className="player__toggle t-ui"
              onClick={() => (playing ? pauseJudgesCut() : finished ? startJudgesCut(true) : resumeJudgesCut())}
            >
              {playing ? 'Pause' : finished ? 'Replay' : 'Resume'}
            </button>
            <span className="player__label t-ui">Judges’ cut</span>
            <span className="player__track" aria-hidden="true">
              <span className="player__fill" ref={bar} />
            </span>
            <span className="player__time t-ui">
              <span ref={elapsed}>0:00</span> / {clock(total)}
            </span>
            <button type="button" className="player__exit t-ui" onClick={exitJudgesCut}>
              Explore freely
            </button>
          </div>
        ) : (
          entered && (
            <button type="button" className="judges-link t-ui" onClick={() => startJudgesCut(true)}>
              ▸ <span className="judges-link__long">Play the judges’ cut · {clock(total)}</span>
              <span className="judges-link__short">Judges’ cut</span>
            </button>
          )
        )}
      </div>

      <div className="bottombar__right">
        <button
          type="button"
          className="bar-button t-ui"
          aria-expanded={overlay === 'archive'}
          onClick={() => cinematic.get().openArchive({ eventId })}
        >
          Archive
          {count !== null && count > 0 && <span className="bar-button__count">{count}</span>}
        </button>
        <button
          type="button"
          className="bar-button t-ui"
          aria-pressed={soundEnabled}
          onClick={() => {
            cinematic.get().setAudioUnlocked()
            cinematic.get().toggleSound()
          }}
        >
          <span className={`sound-bars${soundEnabled ? ' is-on' : ''}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="bar-button__label">Sound {soundEnabled ? 'on' : 'off'}</span>
          <span className="sr-only bar-button__sr">Sound {soundEnabled ? 'on' : 'off'}</span>
        </button>
      </div>
    </footer>
  )
}
