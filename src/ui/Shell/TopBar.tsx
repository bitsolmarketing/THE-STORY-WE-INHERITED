import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { travelTo } from '@/engine/navigation'
import './Shell.css'

/**
 * Identity and the one menu. Not a navbar: the wordmark returns to 1947, the menu opens the
 * editorial index of the experience (journey, judges' cut, timeline, archive, sources, about).
 */
export function TopBar() {
  const entered = useCinematicStore((s) => s.entered)
  const overlay = useCinematicStore((s) => s.overlay)
  return (
    <header className={`topbar${entered ? ' is-in' : ''}`}>
      <button type="button" className="wordmark" onClick={() => travelTo(0)} aria-label="Inherited — return to 1947">
        <span className="wordmark__name">Inherited</span>
        <span className="wordmark__sub t-ui">A Visual History of Pakistan</span>
      </button>
      <div className="topbar__right">
        <span className="studio t-ui">Vactra Tech</span>
        <button
          type="button"
          className="menu-button t-ui"
          aria-haspopup="dialog"
          aria-expanded={overlay === 'menu'}
          onClick={() => (overlay === 'menu' ? cinematic.get().closeOverlay() : cinematic.get().openOverlay('menu'))}
        >
          <span className="menu-button__lines" aria-hidden="true">
            <i />
            <i />
          </span>
          {overlay === 'menu' ? 'Close' : 'Menu'}
        </button>
      </div>
    </header>
  )
}
