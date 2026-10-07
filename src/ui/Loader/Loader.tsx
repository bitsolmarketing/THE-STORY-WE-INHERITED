import { useEffect, useState } from 'react'
import { useCinematicStore } from '@/engine/store/cinematicStore'
import { fontsReady, waitForScene } from '@/engine/assets/boot'
import './Loader.css'

/**
 * Boot: paper with a brass hairline. Waits for the fonts (the map is lettered with them) and for
 * the first scene's generated textures, then lifts. Sets window.__CINEMA_READY__ for verification.
 */
export function Loader() {
  const setReady = useCinematicStore((s) => s.setReady)
  const ready = useCinematicStore((s) => s.ready)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await fontsReady()
      await waitForScene()
      if (cancelled) return
      setReady(true)
      window.__CINEMA_READY__ = true
    })()
    return () => {
      cancelled = true
    }
  }, [setReady])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setGone(true), 1400)
    return () => clearTimeout(t)
  }, [ready])

  if (gone) return null
  return (
    <div className={`loader${ready ? ' is-done' : ''}`} role="status" aria-live="polite">
      <p className="loader__label t-label">Pakistan · 1947 – 2026</p>
      <span className="loader__line" aria-hidden="true" />
      <span className="sr-only">{ready ? 'Ready' : 'Preparing the film'}</span>
    </div>
  )
}
