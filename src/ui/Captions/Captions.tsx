import { useRef } from 'react'
import { useTick } from '@/engine/loop/ticker'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { bell, clamp, ease, seg } from '@/engine/progress/ranges'
import type { Beat } from '@/engine/timeline/timeline'
import type { KeyFigure, PersonInPower } from '@/data/story/types'
import { useActiveBeat } from '@/ui/useBeat'
import { filmPrintsFor } from '@/scenes/chronicle/filmPrints'
import { PRINT_CAPTIONS } from '@/data/archive/captions'
import './Captions.css'

interface CaptionContent {
  label: string
  title: string
  line: string
  figures?: KeyFigure[]
  keyline?: { when: string; what: string }[]
  tags?: string[]
  note?: string
  inPower: PersonInPower[]
  layout: 'title' | 'caption'
  prints?: string[]
  reconstruction: boolean
  illustration: boolean
}

function contentFor(beat: Beat): CaptionContent | null {
  if (beat.kind === 'opening' && beat.chapter) {
    const c = beat.chapter
    if (!c.title && !c.line && !c.label) return null
    return {
      label: c.label,
      title: c.title,
      line: c.line,
      inPower: c.showInPower ? (beat.event?.peopleInPower ?? []) : [],
      layout: c.layout ?? 'caption',
      reconstruction: false,
      illustration: Boolean(c.illustration),
    }
  }
  if (beat.kind === 'event' && beat.event) {
    const e = beat.event
    return {
      label: e.dateLabel,
      title: e.title,
      line: e.description,
      figures: e.figures,
      keyline: e.keyline,
      tags: e.tags,
      note: e.note,
      inPower: e.peopleInPower ?? [],
      layout: 'caption',
      prints: e.visualTreatment.prints,
      reconstruction: Boolean(e.visualTreatment.reconstruction),
      illustration: false,
    }
  }
  return null
}

function formatFigure(f: KeyFigure, k: number): string {
  const v = f.value * k
  const digits = f.decimals ?? 0
  const n = digits ? v.toFixed(digits) : Math.round(v).toLocaleString('en-GB', { useGrouping: !f.fixed })
  return `${f.prefix ?? ''}${n}${f.suffix ?? ''}`
}

/**
 * YEAR / EVENT TITLE / ONE SHORT CONTEXTUAL LINE, then a visually subordinate IN POWER layer
 * (brief STEP 10). Content changes when the beat changes; opacity follows beat-local progress
 * every frame, so captions fade with the scroll (and back), never on timers.
 */
export function Captions() {
  const beat = useActiveBeat()
  const entered = useCinematicStore((s) => s.entered)
  // The film's title card waits behind the entry screen (it would say the same thing twice).
  const content = entered || beat.kind !== 'opening' ? contentFor(beat) : null
  // Credit the photograph the film is showing (the hero), and say how many more lie on the table.
  const prints = beat.kind === 'event' && beat.event ? filmPrintsFor(beat.event) : []
  const root = useRef<HTMLDivElement>(null)
  const lastOpacity = useRef(-1)
  const lastCount = useRef(-1)

  useTick((f) => {
    const { timeline, reducedMotion } = cinematic.get()
    const b = timeline.beatAt(f.progress)
    const local = timeline.local(f.progress, b)
    // Key figures count up while the frame develops (a pure function of progress, so they count
    // back down on reverse scroll). Reduced motion shows the final figures.
    if (b.kind === 'event' && b.event?.figures && root.current) {
      const ph = timeline.phases(b)
      const k = reducedMotion ? 1 : ease.outCubic(seg(local, ph.arrive * 0.6, ph.develop))
      if (Math.abs(k - lastCount.current) > 0.002) {
        lastCount.current = k
        root.current.querySelectorAll<HTMLElement>('[data-figure]').forEach((el) => {
          const fig = b.event!.figures![Number(el.dataset.figure)]
          if (fig) el.textContent = formatFigure(fig, fig.fixed ? 1 : k)
        })
      }
    }
    // Fade over ~0.3 judges'-cut seconds at each end; the film's first frame starts visible.
    const fade = clamp(0.3 / b.seconds, 0.06, 0.3)
    const o = b.index === 0 ? 1 - seg(local, 1 - fade, 1) : bell(local, 0, 1, fade, fade)
    if (Math.abs(o - lastOpacity.current) < 0.003) return
    lastOpacity.current = o
    const el = root.current
    if (!el) return
    el.style.opacity = o.toFixed(3)
    el.style.transform = `translate3d(0, ${((1 - o) * 6).toFixed(2)}px, 0)`
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
  })

  return (
    <>
      <div
        ref={root}
        className={`caption caption--${content?.layout ?? 'caption'}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {content && (
          <>
            {content.label && <p className="caption__label t-label">{content.label}</p>}
            {content.title && <h2 className="caption__title">{content.title}</h2>}
            {content.line && <p className="caption__line">{content.line}</p>}
            {content.figures && content.figures.length > 0 && (
              <dl className="caption__figures">
                {content.figures.map((fig, i) => (
                  <div key={fig.label} className={`caption__figure${i === 0 ? ' is-lead' : ''}`}>
                    <dt className="t-ui">{fig.label}</dt>
                    <dd>
                      {/* The counting text is hidden from the live region; the final figure is read once. */}
                      <span data-figure={i} aria-hidden="true">
                        {formatFigure(fig, 1)}
                      </span>
                      <span className="sr-only">{formatFigure(fig, 1)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {content.keyline && content.keyline.length > 0 && (
              <ol className="caption__keyline">
                {content.keyline.map((k) => (
                  <li key={`${k.when}-${k.what}`}>
                    <span className="caption__when t-ui">{k.when}</span>
                    <span className="caption__what">{k.what}</span>
                  </li>
                ))}
              </ol>
            )}
            {content.tags && content.tags.length > 0 && (
              <ul className="caption__tags" aria-label="Areas">
                {content.tags.map((t) => (
                  <li key={t} className="t-ui">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {content.note && <p className="caption__note">{content.note}</p>}
            {content.inPower.length > 0 && (
              <dl className="in-power">
                <dt className="in-power__label">In power</dt>
                {content.inPower.map((person) => (
                  <dd className="in-power__person" key={`${person.office}-${person.name}`}>
                    <span className="in-power__office">{person.office}</span>
                    <span className="in-power__name">
                      {person.name}
                      {person.note && <span className="in-power__note"> · {person.note}</span>}
                    </span>
                  </dd>
                ))}
              </dl>
            )}
            {prints[0] && PRINT_CAPTIONS[prints[0].id] && <p className="caption__photo">{PRINT_CAPTIONS[prints[0].id]}</p>}
            {(prints.length > 0 || content.reconstruction || content.illustration) && (
              <div className="caption__marks">
                {content.illustration && (
                  <span className="reconstruction-mark t-ui" title="An illustrated scene built for this film. Not a photograph. The archival photographs of the 1947 trains are in the Archive.">
                    Illustration · not a photograph
                  </span>
                )}
                {prints.slice(0, 1).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="print-credit t-ui"
                    onClick={() => cinematic.get().openArchive({ focusId: a.id, eventId: beat.event?.id ?? null })}
                  >
                    {a.materialClass === 'contextual' ? 'Context' : 'Photograph'} · {a.credit ?? a.source}
                    {a.date ? `, ${a.date}` : ''} <span aria-hidden="true">↗</span>
                  </button>
                ))}
                {prints.length > 1 && (
                  <button type="button" className="print-credit t-ui" onClick={() => cinematic.get().openArchive({ eventId: beat.event?.id ?? null, category: 'photographs' })}>
                    +{prints.length - 1} more on the table
                  </button>
                )}
                {content.reconstruction && (
                  <span className="reconstruction-mark t-ui" title="Illustrative motif. Not an original historical document.">
                    Editorial reconstruction
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
