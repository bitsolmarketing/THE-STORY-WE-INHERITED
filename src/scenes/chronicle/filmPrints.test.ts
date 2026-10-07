import { describe, expect, it } from 'vitest'
import filmIndex from '@/data/archive/filmIndex.json'
import { STORY_EVENTS } from '@/data/story/events'
import { FILM_EXCLUDE, isWithdrawn } from '@/data/archive/placement'
import { defaultArchiveRepository } from '@/data/archive/repository'
import { PRINT_CAPTIONS } from '@/data/archive/captions'
import { filmPrintsFor } from './filmPrints'

const KNOWN = new Set(Object.values(filmIndex as Record<string, { id: string }[]>).flatMap((l) => l.map((p) => p.id)))

describe('film placement', () => {
  it('every explicitly placed print exists in the film index', () => {
    const missing = STORY_EVENTS.flatMap((e) => (e.visualTreatment.prints ?? []).filter((id) => !KNOWN.has(id)).map((id) => `${e.id}: ${id}`))
    expect(missing).toEqual([])
  })

  it('images kept off a frame never reach its table', () => {
    for (const e of STORY_EVENTS) {
      const shown = filmPrintsFor(e).map((p) => p.id)
      for (const x of FILM_EXCLUDE[e.id] ?? []) expect(shown).not.toContain(x.id)
    }
  })

  it('no photograph appears on two tables', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const e of STORY_EVENTS) {
      for (const p of filmPrintsFor(e)) {
        if (seen.has(p.id)) dupes.push(`${p.id} (${seen.get(p.id)} & ${e.id})`)
        seen.set(p.id, e.id)
      }
    }
    expect(dupes).toEqual([])
  })

  it('withdrawn records appear nowhere in the film or the archive', async () => {
    for (const e of STORY_EVENTS) for (const p of filmPrintsFor(e, 99)) expect(isWithdrawn(p.id)).toBe(false)
    const all = await defaultArchiveRepository.list()
    expect(all.filter((a) => isWithdrawn(a.id))).toEqual([])
  })

  it('caption lines only describe prints the film can show', () => {
    expect(Object.keys(PRINT_CAPTIONS).filter((id) => !KNOWN.has(id))).toEqual([])
  })
})
