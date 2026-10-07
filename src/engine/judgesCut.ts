import { cinematic, frame } from '@/engine/store/cinematicStore'
import { onTick } from '@/engine/loop/ticker'
import { placeAt, travelTo } from '@/engine/navigation'

/**
 * JUDGES' CUT — the ~2-minute curated playback of the same film. It is not a video: it drives the
 * film's progress at the authored judges' pace (fast through standard beats, generous on major
 * events), so every visual, the year and the captions behave exactly as when scrolling.
 *
 * While it plays, the page does not scroll (per-frame programmatic scrolling makes fixed layers
 * jitter); the native scroll position is synchronised whenever playback stops, so the visitor
 * continues exactly from there. Any scroll, swipe or key press hands control back (paused).
 */
export const judges = { time: 0 }

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
}

/** Put the native scroll position where the film is (after playback stops). */
function syncScroll(p: number): void {
  window.scrollTo({ top: p * maxScroll(), behavior: 'auto' })
  frame.target = p
}

export function startJudgesCut(fromStart = true): void {
  const s = cinematic.get()
  s.enter()
  s.closeOverlay()
  s.setMode('judges')
  if (fromStart) {
    judges.time = 0
    if (frame.progress > 0.002) travelTo(0)
    else placeAt(0)
  } else {
    judges.time = s.timeline.judgesTimeAt(frame.progress)
  }
  s.setPlaying(true)
}

export function pauseJudgesCut(): void {
  cinematic.get().setPlaying(false)
}

export function resumeJudgesCut(): void {
  const s = cinematic.get()
  // Resume from wherever the visitor left the film.
  judges.time = s.timeline.judgesTimeAt(frame.progress)
  s.setMode('judges')
  s.setPlaying(true)
}

export function exitJudgesCut(): void {
  const s = cinematic.get()
  s.setPlaying(false)
  s.setMode('free')
}

// Whenever playback stops (pause, end, interrupt, opening a layer), hand the page back in place.
cinematic.subscribe((s, prev) => {
  if (prev.playing && !s.playing) syncScroll(judges.time >= s.timeline.judgesTotalSeconds ? 1 : frame.progress)
})

let lastWall = 0

onTick(() => {
  const s = cinematic.get()
  const now = performance.now()
  // Wall-clock time, not frame time: the cut lasts its two minutes on any machine, even one that
  // renders slowly (frame dt is clamped for animation stability; this clock must not be).
  const wall = lastWall ? Math.min(0.25, (now - lastWall) / 1000) : 0
  lastWall = now
  if (s.mode !== 'judges' || !s.playing) return
  // Wait while a travel cut (to 1947) is in progress.
  if (frame.progress > 0.002 && judges.time === 0) return
  judges.time += wall
  if (judges.time >= s.timeline.judgesTotalSeconds) {
    judges.time = s.timeline.judgesTotalSeconds
    frame.target = 1
    // Stop only once the film has arrived on the closing statement.
    if (frame.progress > 0.9995) s.setPlaying(false)
    return
  }
  frame.target = s.timeline.progressAtJudgesTime(judges.time)
})

/** Hand control back on any deliberate input. Installed once by the app shell. */
export function installJudgesInterrupts(): () => void {
  const interrupt = () => {
    const s = cinematic.get()
    if (s.mode === 'judges' && s.playing) s.setPlaying(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) interrupt()
  }
  window.addEventListener('wheel', interrupt, { passive: true })
  window.addEventListener('touchstart', interrupt, { passive: true })
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('wheel', interrupt)
    window.removeEventListener('touchstart', interrupt)
    window.removeEventListener('keydown', onKey)
  }
}
