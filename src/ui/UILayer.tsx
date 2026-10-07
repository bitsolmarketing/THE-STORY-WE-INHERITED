import { useEffect, useRef } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic, useCinematicStore, type OverlayId } from '@/engine/store/cinematicStore'
import { bell } from '@/engine/progress/ranges'
import { openingState } from '@/scenes/openingCurves'
import { YearIndicator } from './YearIndicator/YearIndicator'
import { Captions } from './Captions/Captions'
import { TimelineRail } from './TimelineRail/TimelineRail'
import { PaperVeil } from './PaperVeil/PaperVeil'
import { EpilogueCard } from './Epilogue/EpilogueCard'
import { TopBar } from './Shell/TopBar'
import { BottomBar } from './Shell/BottomBar'
import { Intro } from './Intro/Intro'
import { Menu } from './Menu/Menu'
import { TimelineExplorer } from './Timeline/TimelineExplorer'
import { ArchiveDrawer } from './Archive/ArchiveDrawer'
import { AboutPage, SourcesPage } from './Pages/Pages'
import './ui.css'

const OVERLAYS: OverlayId[] = ['menu', 'timeline', 'archive', 'sources', 'about']

/**
 * The experience shell over the stage:
 *   top     — identity (INHERITED) · VACTRA TECH · MENU
 *   right   — the timeline rail
 *   bottom  — caption (left) · year stamp (right) · scroll cue / Judges' Cut player · ARCHIVE · SOUND
 *   layers  — entry, menu, timeline, archive, sources, about (each addressable by URL hash)
 *
 * `--tone` follows the prologue's darkness (type stays legible on dark paper); `--chrome` lowers
 * the shell during the settled moments of major chapters so the film stays dominant.
 */
export function UILayer() {
  const root = useRef<HTMLDivElement>(null)
  const last = useRef({ tone: -1, chrome: -1 })
  const overlay = useCinematicStore((s) => s.overlay)

  useTick((f) => {
    const { timeline } = cinematic.get()
    const p = f.progress
    const tone = p < timeline.scenes.opening.end ? openingState(timeline, p).dark : 0
    const b = timeline.beatAt(p)
    let chrome = 1
    if (b.kind === 'event' && b.importance === 'major') chrome = 1 - 0.7 * bell(timeline.local(p, b), timeline.phases(b).arrive, 0.98, 0.12, 0.08)
    else if (b.kind === 'opening' && b.chapter?.id !== 'prologue') chrome = 0.55
    if (Math.abs(tone - last.current.tone) > 0.004) {
      last.current.tone = tone
      root.current?.style.setProperty('--tone', tone.toFixed(3))
    }
    if (Math.abs(chrome - last.current.chrome) > 0.01) {
      last.current.chrome = chrome
      root.current?.style.setProperty('--chrome', chrome.toFixed(2))
    }
  })

  useHashRouting()

  return (
    <>
      <PaperVeil />
      <div className="ui-layer" ref={root}>
        <TopBar />
        <TimelineRail />
        <Captions />
        <YearIndicator />
        <EpilogueCard />
        <BottomBar />
      </div>
      <Intro />
      {overlay === 'menu' && <Menu />}
      {overlay === 'timeline' && <TimelineExplorer />}
      {overlay === 'archive' && <ArchiveDrawer />}
      {overlay === 'sources' && <SourcesPage />}
      {overlay === 'about' && <AboutPage />}
    </>
  )
}

/** #timeline, #archive, #sources, #about, #menu ↔ overlay. Back closes the layer. */
function useHashRouting() {
  const overlay = useCinematicStore((s) => s.overlay)
  const fromHash = useRef(false)

  useEffect(() => {
    const apply = () => {
      const id = window.location.hash.replace('#', '') as OverlayId
      fromHash.current = true
      const s = cinematic.get()
      if (OVERLAYS.includes(id)) {
        if (!s.entered) s.enter()
        if (s.overlay !== id) s.openOverlay(id)
      } else if (s.overlay) s.closeOverlay()
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  useEffect(() => {
    if (fromHash.current) {
      fromHash.current = false
      return
    }
    const want = overlay ? `#${overlay}` : ''
    if (window.location.hash === want) return
    if (overlay) history.pushState(null, '', want)
    else history.pushState(null, '', window.location.pathname + window.location.search)
  }, [overlay])
}
