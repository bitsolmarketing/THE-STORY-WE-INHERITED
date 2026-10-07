import { useEffect, useRef, type ReactNode } from 'react'
import { cinematic } from '@/engine/store/cinematicStore'
import './Overlay.css'

/**
 * The frame every secondary layer opens in: a room of paper over the film (never a generic modal).
 * Dialog semantics, Esc closes, focus moves in and returns, the page behind does not scroll.
 */
export function Overlay({ id, label, kicker, children, wide = false }: { id: string; label: string; kicker?: string; children: ReactNode; wide?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    document.body.classList.add('overlay-open')
    closeBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cinematic.get().closeOverlay()
      if (e.key === 'Tab' && root.current) {
        const items = root.current.querySelectorAll<HTMLElement>('button, a[href], select, input, [tabindex]:not([tabindex="-1"])')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('overlay-open')
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className={`overlay overlay--${id}`} role="dialog" aria-modal="true" aria-label={label} ref={root}>
      <div className="overlay__bar">
        <span className="overlay__kicker t-ui">
          <span className="overlay__brand">Inherited</span>
          {kicker && <span> · {kicker}</span>}
        </span>
        <button type="button" className="overlay__close t-ui" onClick={() => cinematic.get().closeOverlay()} ref={closeBtn}>
          Return to the film <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className={`overlay__body${wide ? ' is-wide' : ''}`}>{children}</div>
    </div>
  )
}
