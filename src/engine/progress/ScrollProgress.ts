import { useEffect } from 'react'
import { frame, cinematic } from '@/engine/store/cinematicStore'
import { clamp01 } from '@/engine/progress/ranges'

/**
 * The only scroll listener in the application.
 * Converts document scroll into `frame.target` (0..1). Damping happens in CinematicLoop.
 *
 * Native document scrolling is used deliberately: wheel, trackpad, touch, keyboard,
 * scrollbar drag and assistive tech all work without any hijacking.
 */
function maxScroll(): number {
  const doc = document.documentElement
  return Math.max(0, doc.scrollHeight - window.innerHeight)
}

function readTarget(): number {
  const max = maxScroll()
  return max > 0 ? clamp01(window.scrollY / max) : 0
}

let listenersAttached = false
let initialised = false

export function useScrollProgress(): void {
  useEffect(() => {
    if (listenersAttached) return
    listenersAttached = true

    const params = new URLSearchParams(window.location.search)
    if (params.has('restart')) {
      history.scrollRestoration = 'manual'
      window.scrollTo(0, 0)
    }

    const sync = () => {
      frame.target = readTarget()
      if (!initialised) {
        // Start exactly where the browser restored us; no swoosh on reload.
        frame.progress = frame.target
        initialised = true
      }
      if (frame.target > 0.004) cinematic.get().setHasScrolled()
    }

    // The track may not have its final height on the very first frame (fonts, layout).
    sync()
    const raf = requestAnimationFrame(sync)

    const onScroll = () => {
      frame.target = readTarget()
      if (frame.target > 0.004) cinematic.get().setHasScrolled()
    }
    const onResize = () => {
      frame.target = readTarget()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      listenersAttached = false
    }
  }, [])
}

/** Programmatic navigation (timeline rail, continue hint, verification harness). */
export function scrollToProgress(p: number, behavior: ScrollBehavior = 'smooth'): void {
  const max = maxScroll()
  window.scrollTo({ top: clamp01(p) * max, behavior })
}
