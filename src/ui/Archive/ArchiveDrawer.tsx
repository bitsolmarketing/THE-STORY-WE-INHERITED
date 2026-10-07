import { useEffect, useMemo, useState } from 'react'
import { cinematic, useCinematicStore, type ArchiveCategory } from '@/engine/store/cinematicStore'
import { travelTo } from '@/engine/navigation'
import { CATEGORY_TYPES, categoryForType, useArchiveRepository } from '@/data/archive/repository'
import type { ArchiveAsset, RightsStatus, SourceRecord } from '@/data/archive/types'
import { staticStoryProvider } from '@/data/story/provider'
import { Overlay } from '@/ui/Overlay/Overlay'
import './ArchiveDrawer.css'

const CATEGORIES: { id: ArchiveCategory; label: string }[] = [
  { id: 'photographs', label: 'Photographs' },
  { id: 'newspapers', label: 'Newspapers' },
  { id: 'documents', label: 'Documents' },
  { id: 'maps', label: 'Maps' },
  { id: 'sources', label: 'Sources' },
]

export const RIGHTS_LABEL: Record<RightsStatus, string> = {
  clear: 'Clear',
  'likely-clear': 'Likely clear',
  verify: 'Verify before public use',
  'owner-supplied': 'Owner supplied',
}

export const MATERIAL_LABEL: Record<ArchiveAsset['materialClass'], string> = {
  historical: 'Historical material',
  contextual: 'Contextual (modern)',
  'stand-in': 'Stand-in · not the event',
  reconstruction: 'Reconstruction · not an original',
}

/**
 * LAYER 03 — the archive behind the film (spec §18, brief §16): entering an archive, not opening
 * a modal. Every record keeps its source, licence, rights status and authenticity class exactly
 * as catalogued; records whose files are not held are shown as typographic sleeves with links.
 */
export function ArchiveDrawer() {
  const repo = useArchiveRepository()
  const category = useCinematicStore((s) => s.archiveCategory)
  const eventId = useCinematicStore((s) => s.archiveEventId)
  const focusId = useCinematicStore((s) => s.archiveFocusId)
  const [all, setAll] = useState<ArchiveAsset[] | null>(null)
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [rights, setRights] = useState<RightsStatus | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(focusId)

  useEffect(() => {
    let alive = true
    Promise.all([repo.list(), repo.sources()]).then(([a, s]) => {
      if (!alive) return
      setAll(a)
      setSources(s)
    })
    return () => {
      alive = false
    }
  }, [repo])

  // Arriving from a print in the film: open on that record and its category.
  useEffect(() => {
    if (!focusId || !all) return
    const a = all.find((x) => x.id === focusId)
    if (a) {
      cinematic.get().setArchiveCategory(categoryForType(a.type))
      setSelectedId(a.id)
    }
  }, [focusId, all])

  const events = staticStoryProvider.events()
  const event = eventId ? staticStoryProvider.event(eventId) : undefined

  const scoped = useMemo(() => (all ?? []).filter((a) => !eventId || a.eventIds.includes(eventId)), [all, eventId])
  const counts = useMemo(() => {
    const c: Record<ArchiveCategory, number> = { photographs: 0, newspapers: 0, documents: 0, maps: 0, sources: 0 }
    for (const a of scoped) c[categoryForType(a.type)]++
    c.sources = sources.filter((s) => !eventId || !s.eventIds || s.eventIds.includes(eventId)).length
    return c
  }, [scoped, sources, eventId])

  const items = useMemo(() => {
    if (category === 'sources') return []
    const types = CATEGORY_TYPES[category]
    return scoped.filter((a) => types.includes(a.type) && (rights === 'all' || a.rights.status === rights)).sort((x, y) => Number(Boolean(y.thumbPath)) - Number(Boolean(x.thumbPath)) || x.year - y.year)
  }, [scoped, category, rights])

  const selected = selectedId ? (all ?? []).find((a) => a.id === selectedId) ?? null : null

  const goToMoment = (id: string) => {
    const { timeline } = cinematic.get()
    const beat = timeline.eventBeats.find((b) => b.event?.id === id) ?? timeline.beats.find((b) => b.event?.id === id)
    cinematic.get().closeOverlay()
    cinematic.get().setMode('free')
    if (beat) travelTo(beat.kind === 'event' ? timeline.restingProgress(beat) : beat.start + (beat.end - beat.start) * 0.4)
  }

  return (
    <Overlay id="archive" label="Archive" kicker="Archive" wide>
      <div className="ar">
        <header className="ar-head">
          <div>
            <p className="t-label page-kicker">The archive behind the film · {all ? all.length : '…'} catalogued records</p>
            <h1 className="page-title">
              {event ? (
                <>
                  <span className="ar-head__year">{event.yearLabel ?? event.year}</span> {event.title}
                </>
              ) : (
                <>
                  The <em>archive</em>
                </>
              )}
            </h1>
            {event && <p className="page-lede">{event.detail ?? event.description}</p>}
          </div>
          <div className="ar-scope">
            <label className="t-ui" htmlFor="ar-moment">
              Moment
            </label>
            <select
              id="ar-moment"
              value={eventId ?? ''}
              onChange={(e) => {
                cinematic.get().setArchiveEvent(e.target.value || null)
                setSelectedId(null)
              }}
            >
              <option value="">All years · 1947 – 2026</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {(ev.yearLabel ?? ev.year) + ' · ' + ev.title}
                </option>
              ))}
            </select>
            {event && (
              <button type="button" className="ar-scope__go t-ui" onClick={() => goToMoment(event.id)}>
                See this moment in the film →
              </button>
            )}
            {event?.peopleInPower && event.peopleInPower.length > 0 && (
              <dl className="ar-power">
                <dt className="t-ui">In power</dt>
                {event.peopleInPower.map((p) => (
                  <dd key={p.office + p.name}>
                    <span>{p.office}</span> {p.name}
                    {p.note ? <em> · {p.note}</em> : null}
                  </dd>
                ))}
              </dl>
            )}
          </div>
        </header>

        <nav className="ar-tabs" aria-label="Archive categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ar-tab${c.id === category ? ' is-on' : ''}`}
              aria-pressed={c.id === category}
              onClick={() => {
                cinematic.get().setArchiveCategory(c.id)
                setSelectedId(null)
              }}
            >
              {c.label} <span className="t-ui">{counts[c.id]}</span>
            </button>
          ))}
          {category !== 'sources' && (
            <span className="ar-rights" role="group" aria-label="Rights status">
              {(['all', 'clear', 'likely-clear', 'owner-supplied', 'verify'] as const).map((r) => (
                <button key={r} type="button" className={`t-ui${rights === r ? ' is-on' : ''}`} onClick={() => setRights(r)} aria-pressed={rights === r}>
                  {r === 'all' ? 'All rights' : RIGHTS_LABEL[r]}
                </button>
              ))}
            </span>
          )}
        </nav>

        {category === 'sources' ? (
          <SourcesList sources={sources.filter((s) => !eventId || !s.eventIds || s.eventIds.includes(eventId))} />
        ) : (
          <div className={`ar-body${selected ? ' has-detail' : ''}`}>
            {all === null ? (
              <p className="mono-meta">Opening the archive…</p>
            ) : items.length === 0 ? (
              <p className="ar-empty">No {category} are catalogued for this moment yet. Try “All years”, or another category.</p>
            ) : (
              <ul className="ar-grid">
                {items.map((a) => (
                  <li key={a.id}>
                    <button type="button" className={`sleeve${a.id === selectedId ? ' is-on' : ''}`} onClick={() => setSelectedId(a.id)}>
                      <span className="sleeve__image">
                        {a.thumbPath ? (
                          <img src={a.thumbPath} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="sleeve__typo">
                            <span className="t-ui">{a.type}</span>
                            <span className="sleeve__typo-title">{a.title}</span>
                            <span className="t-ui">Image held at source</span>
                          </span>
                        )}
                      </span>
                      <span className="sleeve__title">{a.title}</span>
                      <span className="sleeve__meta t-ui">
                        {a.date ?? a.year} · <RightsBadge status={a.rights.status} small />
                        {a.materialClass !== 'historical' && <span className="sleeve__class"> · {MATERIAL_LABEL[a.materialClass]}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && <Detail asset={selected} onClose={() => setSelectedId(null)} onGo={goToMoment} />}
          </div>
        )}
      </div>
    </Overlay>
  )
}

export function RightsBadge({ status, small = false }: { status: RightsStatus; small?: boolean }) {
  return <span className={`rights rights--${status}${small ? ' is-small' : ''}`}>{RIGHTS_LABEL[status]}</span>
}

function Detail({ asset, onClose, onGo }: { asset: ArchiveAsset; onClose: () => void; onGo: (eventId: string) => void }) {
  const ev = staticStoryProvider.event(asset.eventIds[0])
  const rows: [string, string | undefined][] = [
    ['Date', asset.date ?? String(asset.year)],
    ['Type', asset.type],
    ['Authenticity', asset.authenticity],
    ['Material', MATERIAL_LABEL[asset.materialClass]],
    ['Creator / credit', asset.credit],
    ['Source', asset.source],
    ['Reference', asset.sourceRef],
    ['Licence', asset.license],
    ['Rights statement', asset.rights.statement],
    ['Attribution', asset.attribution],
    ['Quality', asset.quality],
    ['Notes', asset.notes],
    ['Provenance', asset.provenance?.note],
  ]
  return (
    <aside className="ar-detail" aria-label={`Record: ${asset.title}`}>
      <button type="button" className="ar-detail__close t-ui" onClick={onClose}>
        Close record ✕
      </button>
      <figure className="ar-detail__figure">
        {asset.localPath ? (
          <picture>
            {asset.webp && asset.webp.length > 0 && (
              <source type="image/webp" srcSet={asset.webp.map((v) => `${v.path} ${v.w}w`).join(', ')} sizes="(max-width: 720px) 100vw, 46vw" />
            )}
            <img src={asset.localPath} alt={asset.description} decoding="async" />
          </picture>
        ) : (
          <div className="ar-detail__typo">
            <span className="t-ui">The full-resolution file is not held in this build.</span>
            <span>View it at its source, with its licence.</span>
          </div>
        )}
        <figcaption className="mono-meta">{asset.description}</figcaption>
      </figure>
      <h2 className="ar-detail__title">{asset.title}</h2>
      <p className="ar-detail__badges">
        <RightsBadge status={asset.rights.status} />
        {asset.materialClass !== 'historical' && <span className="ar-class">{MATERIAL_LABEL[asset.materialClass]}</span>}
      </p>
      <dl className="ar-meta">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="t-ui">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        {ev && (
          <div>
            <dt className="t-ui">Chapter</dt>
            <dd>
              {(ev.yearLabel ?? ev.year) + ' · ' + ev.title}{' '}
              <button type="button" className="ar-inline t-ui" onClick={() => onGo(ev.id)}>
                See in the film →
              </button>
            </dd>
          </div>
        )}
      </dl>
      <p className="ar-detail__links">
        {asset.url && (
          <a className="t-ui" href={asset.url} target="_blank" rel="noreferrer noopener">
            Source page ↗
          </a>
        )}
        {!asset.localPath && asset.downloadUrl && (
          <a className="t-ui" href={asset.downloadUrl} target="_blank" rel="noreferrer noopener">
            Original file ↗
          </a>
        )}
      </p>
    </aside>
  )
}

function SourcesList({ sources }: { sources: SourceRecord[] }) {
  return (
    <ol className="ar-sources">
      {sources.map((s) => (
        <li key={s.id}>
          <p className="ar-sources__title">{s.title}</p>
          <p className="mono-meta">
            {[s.author, s.publisher, s.year].filter(Boolean).join(' · ')}
            {s.url && (
              <>
                {' · '}
                <a href={s.url} target="_blank" rel="noreferrer noopener">
                  {new URL(s.url).hostname} ↗
                </a>
              </>
            )}
          </p>
          {s.note && <p className="ar-sources__note">{s.note}</p>}
        </li>
      ))}
    </ol>
  )
}
