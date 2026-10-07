import { useCinematicStore } from '@/engine/store/cinematicStore'

/**
 * The invisible element that gives the page its length. Nothing is rendered inside it.
 * Its height comes from the paced timeline (judges'-cut seconds × vh per second), so pacing is
 * authored once, in data, and scrolling distance follows it.
 */
export function ScrollTrack() {
  const trackVh = useCinematicStore((s) => s.timeline.trackVh)
  return <div id="scroll-track" aria-hidden="true" style={{ height: `${trackVh}vh` }} />
}
