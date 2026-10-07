import { useEffect, useMemo, useState } from 'react'
import { cinematic, useCinematicStore } from '@/engine/store/cinematicStore'
import { startJudgesCut } from '@/engine/judgesCut'
import { useArchiveRepository } from '@/data/archive/repository'
import type { ArchiveAsset, SourceRecord } from '@/data/archive/types'
import institutions from '@/data/archive/institutions.json'
import { staticStoryProvider } from '@/data/story/provider'
import { filmPrintCount } from '@/scenes/chronicle/filmPrints'
import { Overlay } from '@/ui/Overlay/Overlay'
import { RIGHTS_LABEL, RightsBadge } from '@/ui/Archive/ArchiveDrawer'
import './Pages.css'

function useArchiveStats() {
  const repo = useArchiveRepository()
  const [assets, setAssets] = useState<ArchiveAsset[] | null>(null)
  const [sources, setSources] = useState<SourceRecord[]>([])
  useEffect(() => {
    let alive = true
    Promise.all([repo.list(), repo.sources()]).then(([a, s]) => alive && (setAssets(a), setSources(s)))
    return () => {
      alive = false
    }
  }, [repo])
  const stats = useMemo(() => {
    const list = assets ?? []
    const by = (f: (a: ArchiveAsset) => boolean) => list.filter(f).length
    return {
      total: list.length,
      held: by((a) => Boolean(a.localPath)),
      clear: by((a) => a.rights.status === 'clear'),
      likely: by((a) => a.rights.status === 'likely-clear'),
      verify: by((a) => a.rights.status === 'verify'),
      owner: by((a) => a.rights.status === 'owner-supplied'),
      reconstruction: by((a) => a.materialClass === 'reconstruction' || a.materialClass === 'stand-in'),
      perEvent: (id: string) => list.filter((a) => a.eventIds.includes(id)).length,
    }
  }, [assets])
  return { assets, sources, stats }
}

/** LAYER 04 — what this experience is built on (brief §01, §16). Nothing here is invented. */
export function SourcesPage() {
  const { assets, sources, stats } = useArchiveStats()
  const events = staticStoryProvider.events()
  return (
    <Overlay id="sources" label="Sources and research" kicker="Sources & Research">
      <article className="pg">
        <p className="t-label page-kicker">Research · Rights · Method</p>
        <h1 className="page-title">
          What this experience <em>is built on</em>
        </h1>
        <p className="page-lede">
          Every chapter follows the project storyboard (56 beats, 1947 – 2026), with four 2025 chapters added from the project owner's brief. Every photograph, newspaper, document and map in the film and
          the archive comes from a catalogued source with its creator, date, licence, rights status and authenticity class recorded. Nothing is
          generated to look historical.
        </p>

        <dl className="pg-figures">
          <div>
            <dt className="t-ui">Storyboard chapters</dt>
            <dd>{events.length}</dd>
          </div>
          <div>
            <dt className="t-ui">Catalogued records</dt>
            <dd>{assets ? stats.total : '…'}</dd>
          </div>
          <div>
            <dt className="t-ui">Held at full resolution</dt>
            <dd>{assets ? stats.held : '…'}</dd>
          </div>
          <div>
            <dt className="t-ui">Shown in the film</dt>
            <dd>{filmPrintCount()}</dd>
          </div>
        </dl>

        <hr className="rule" />

        <section className="pg-cols">
          <div>
            <h2 className="pg-h2">Rights status</h2>
            <ul className="pg-legend">
              <li>
                <RightsBadge status="clear" /> <span>{assets ? stats.clear : '…'} records.</span> CC0, public domain, US federal government work, expired Crown copyright, or an open licence whose terms are met by the credit line.
              </li>
              <li>
                <RightsBadge status="likely-clear" /> <span>{assets ? stats.likely : '…'} records.</span> Stated public domain by age on the source page (for example Pakistani photographs more than 50 years old). Reasonable for this competition; to be confirmed before wider publication.
              </li>
              <li>
                <RightsBadge status="owner-supplied" /> <span>{assets ? stats.owner : '…'} records.</span> Photographs supplied by the project owner, each checked against what it shows. Photographer and licence are not recorded yet; they are to be confirmed, and the licensed full-resolution files swapped in, before wider publication.
              </li>
              <li>
                <RightsBadge status="verify" /> <span>{assets ? stats.verify : '…'} records.</span> Provenance or licence is weak or conflicting. These are kept in the archive and clearly marked, and are <strong>never shown in the film</strong>.
              </li>
            </ul>
          </div>
          <div>
            <h2 className="pg-h2">Archive and reconstruction</h2>
            <ul className="pg-legend">
              <li>
                <strong>Archive.</strong> Real, sourced material: original photographs, documents, newspapers, maps, satellite imagery and documentary photographs, each captioned with what it actually shows and when.
              </li>
              <li>
                <strong>Reconstruction.</strong> The paper station, the train and the traveller of 1947 are a stylised reconstruction. The traveller is a composite civilian, not a real person.
              </li>
              <li>
                <strong>Editorial reconstruction.</strong> Drawn motifs that depict documents or objects (constitution pages, signatures, nameplates) carry this mark on screen. Signatures are abstract strokes, never a real hand.
              </li>
              <li>
                <strong>Schematic maps.</strong> Coastlines and borders come from Natural Earth (public domain). River courses and road alignments are schematic. No boundary is drawn through Jammu &amp; Kashmir.
              </li>
              <li>
                {assets ? stats.reconstruction : '…'} archive records are museum dioramas, artworks or stand-ins. They are labelled as such and never presented as the event.
              </li>
            </ul>
          </div>
        </section>

        <hr className="rule" />

        <section className="pg-cols">
          <div>
            <h2 className="pg-h2">Where the images come from</h2>
            <ol className="pg-inst">
              {institutions.map((i) => (
                <li key={i.name}>
                  <span>{i.name}</span>
                  <span className="t-ui">{i.files}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="pg-h2">Documents and references</h2>
            <ol className="pg-refs">
              {sources.map((s) => (
                <li key={s.id}>
                  <p className="pg-refs__title">{s.title}</p>
                  <p className="mono-meta">
                    {[s.publisher, s.year].filter(Boolean).join(' · ')}
                    {s.url && (
                      <>
                        {' · '}
                        <a href={s.url} target="_blank" rel="noreferrer noopener">
                          {new URL(s.url).hostname} ↗
                        </a>
                      </>
                    )}
                  </p>
                  {s.note && <p className="pg-refs__note">{s.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <hr className="rule" />

        <h2 className="pg-h2">The source trail, chapter by chapter</h2>
        <ol className="pg-trail">
          {events.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => cinematic.get().openArchive({ eventId: e.id, category: 'photographs' })}>
                <span className="t-ui pg-trail__id">{e.id}</span>
                <span className="pg-trail__year">{e.yearLabel ?? e.year}</span>
                <span className="pg-trail__title">{e.title}</span>
                <span className="t-ui pg-trail__n">{assets ? `${stats.perEvent(e.id)} records` : ''}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="pg-note mono-meta">Rights vocabulary: {Object.values(RIGHTS_LABEL).join(' · ')}. Records and statuses are reproduced exactly as catalogued by the research archive (3 October 2026).</p>
      </article>
    </Overlay>
  )
}

/** LAYER 05 — the project, its method and its makers. */
export function AboutPage() {
  const timeline = useCinematicStore((s) => s.timeline)
  const mins = `${Math.floor(timeline.judgesTotalSeconds / 60)}:${String(Math.floor(timeline.judgesTotalSeconds % 60)).padStart(2, '0')}`
  return (
    <Overlay id="about" label="About the experience" kicker="About the Experience">
      <article className="pg">
        <p className="t-label page-kicker">A Vactra Tech interactive experience</p>
        <h1 className="page-title">
          Inherited <em>— A Visual History of Pakistan</em>
        </h1>
        <p className="page-lede">
          A country is inherited the way a family story is: in fragments, photographs, documents and the places people passed through.
          <em> Inherited</em> lets you travel through that story — from 1947 to 2026 — as a film you move with your own hand, with the research
          behind every moment one step away.
        </p>
        <p className="pg-cta">
          <button type="button" className="pg-button" onClick={() => startJudgesCut(true)}>
            ▸ Play the Judges’ Cut · {mins}
          </button>
          <button type="button" className="pg-link t-ui" onClick={() => cinematic.get().closeOverlay()}>
            Return to the journey
          </button>
        </p>

        <hr className="rule" />

        <section className="pg-grid">
          <div>
            <p className="t-label">01 · The story</p>
            <h2 className="pg-h2">Scroll is time</h2>
            <p>
              The journey follows the project storyboard in order: the birth of Pakistan and Partition, then every chapter to the diplomacy of
              2026 and the next chapter. Each chapter arrives, develops and settles before the year turns. Major turning points are given room;
              shorter chapters are brief beats. Nothing advances faster than the story can be seen.
            </p>
          </div>
          <div>
            <p className="t-label">02 · Two ways in</p>
            <h2 className="pg-h2">The Judges’ Cut and the full journey</h2>
            <p>
              The Judges’ Cut plays the whole chronology in about two minutes ({mins}), pausing the moment you take control. The full journey is the
              same film at your own pace: scroll, use the timeline to travel, and open the archive behind any moment.
            </p>
          </div>
          <div>
            <p className="t-label">03 · The archive</p>
            <h2 className="pg-h2">Real material, honestly labelled</h2>
            <p>
              Photographs, newspapers, documents and maps were catalogued per chapter with source, creator, date, licence and authenticity. Only
              material with clear, likely-clear or owner-supplied rights appears in the film; items needing verification stay in the archive, marked. The research
              thumbnails (~190 px) are never published; the owner-supplied photographs are preview size for now and marked as such.
            </p>
          </div>
          <div>
            <p className="t-label">04 · Reconstruction</p>
            <h2 className="pg-h2">Paper, not pretence</h2>
            <p>
              The 1947 station, train and traveller are built as paper cut-outs so they can never be mistaken for photographs. The traveller is a
              composite: one of the millions, not a historical figure. Illustrative documents carry an “Editorial reconstruction” mark.
            </p>
          </div>
          <div>
            <p className="t-label">05 · Technology</p>
            <h2 className="pg-h2">One engine, one timeline</h2>
            <p>
              Built with React and Three.js (React Three Fiber). A single normalised progress value drives the camera, scenes, typography, year
              and sound from one animation loop. Paper, maps and ink are custom GLSL shaders; cut-outs are instanced; sound is synthesised live
              with the Web Audio API. Scenes, images and textures load only when needed and are released afterwards; quality adapts to the device.
            </p>
          </div>
          <div>
            <p className="t-label">06 · Data</p>
            <h2 className="pg-h2">Ready for a backend</h2>
            <p>
              Chapters, events, people in power, archive records and sources are typed data behind repository interfaces. A future content service
              can replace the local data without changing the film: pacing re-derives itself from the events it receives.
            </p>
          </div>
        </section>

        <hr className="rule" />

        <section className="pg-credits">
          <h2 className="pg-h2">Credits</h2>
          <dl>
            <div>
              <dt className="t-ui">Studio</dt>
              <dd>Vactra Tech</dd>
            </div>
            <div>
              <dt className="t-ui">Story</dt>
              <dd>Project storyboard, “The Story We Inherited” (final revised chronological storyboard, 1947 – 2026)</dd>
            </div>
            <div>
              <dt className="t-ui">Research archive</dt>
              <dd>Pakistan Visual Archive — 267 catalogued images across 56 beats, with per-image attribution</dd>
            </div>
            <div>
              <dt className="t-ui">Maps</dt>
              <dd>Natural Earth (public domain), via world-atlas</dd>
            </div>
            <div>
              <dt className="t-ui">Type</dt>
              <dd>Cormorant Garamond, Inter, JetBrains Mono (SIL Open Font License)</dd>
            </div>
            <div>
              <dt className="t-ui">Image credits</dt>
              <dd>
                Every image is credited in the archive with its creator and licence.{' '}
                <button type="button" className="pg-link t-ui" onClick={() => cinematic.get().openOverlay('sources')}>
                  Sources & research →
                </button>
              </dd>
            </div>
          </dl>
        </section>
      </article>
    </Overlay>
  )
}
