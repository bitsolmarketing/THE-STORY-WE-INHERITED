import { createContext, useContext } from 'react'
import type { ArchiveCategory } from '@/engine/store/cinematicStore'
import type { ArchiveAsset, ArchiveAssetType, SourceRecord } from './types'
import { isWithdrawn } from './placement'

/**
 * The seam between the cinematic engine and the data layer.
 * The engine and UI only ever talk to an ArchiveRepository; today it is backed by local JSON
 * (lazy-loaded, so ~340 KB of metadata never blocks first paint), later by the backend API
 * (set VITE_ARCHIVE_API_URL).
 */
export interface ArchiveQuery {
  type?: ArchiveAssetType | ArchiveAssetType[]
  /** Storyboard beat id (E01…E56). */
  eventId?: string
  year?: number
  hasImage?: boolean
}

export interface ArchiveRepository {
  list(query?: ArchiveQuery): Promise<ArchiveAsset[]>
  get(id: string): Promise<ArchiveAsset | null>
  sources(): Promise<SourceRecord[]>
}

export const CATEGORY_TYPES: Record<Exclude<ArchiveCategory, 'sources'>, ArchiveAssetType[]> = {
  photographs: ['photograph'],
  newspapers: ['newspaper'],
  documents: ['document', 'letter', 'ticket', 'stamp'],
  maps: ['map'],
}

export function categoryForType(type: ArchiveAssetType): ArchiveCategory {
  for (const [cat, types] of Object.entries(CATEGORY_TYPES) as [ArchiveCategory, ArchiveAssetType[]][]) {
    if (types.includes(type)) return cat
  }
  return 'documents'
}

function matches(a: ArchiveAsset, q: ArchiveQuery | undefined): boolean {
  if (!q) return true
  if (q.type) {
    const types = Array.isArray(q.type) ? q.type : [q.type]
    if (!types.includes(a.type)) return false
  }
  if (q.eventId && !a.eventIds.includes(q.eventId)) return false
  if (q.year !== undefined && a.year !== q.year) return false
  if (q.hasImage !== undefined && Boolean(a.localPath) !== q.hasImage) return false
  return true
}

interface ArchiveData {
  assets: ArchiveAsset[]
  sources: SourceRecord[]
}

export class MockArchiveRepository implements ArchiveRepository {
  private data: Promise<ArchiveData> | null = null

  /** `load` resolves the local JSON on first use (dynamic import → separate chunk). */
  constructor(private readonly load: () => Promise<ArchiveData>) {}

  private ensure(): Promise<ArchiveData> {
    this.data ??= this.load()
    return this.data
  }

  async list(query?: ArchiveQuery): Promise<ArchiveAsset[]> {
    const { assets } = await this.ensure()
    return assets.filter((a) => matches(a, query))
  }

  async get(id: string): Promise<ArchiveAsset | null> {
    const { assets } = await this.ensure()
    return assets.find((a) => a.id === id) ?? null
  }

  async sources(): Promise<SourceRecord[]> {
    return (await this.ensure()).sources
  }
}

/**
 * Thin HTTP adapter for the future backend. Endpoint shape is a proposal for the backend
 * developer; adjust once the real API exists. Falls back to empty results on error so the
 * cinematic layer never breaks because of the network.
 */
export class HttpArchiveRepository implements ArchiveRepository {
  constructor(private readonly baseUrl: string) {}

  private async fetchJson<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      return (await res.json()) as T
    } catch {
      return null
    }
  }

  async list(query?: ArchiveQuery): Promise<ArchiveAsset[]> {
    const params = new URLSearchParams()
    if (query?.type) params.set('type', Array.isArray(query.type) ? query.type.join(',') : query.type)
    if (query?.eventId) params.set('event', query.eventId)
    if (query?.year !== undefined) params.set('year', String(query.year))
    if (query?.hasImage !== undefined) params.set('hasImage', String(query.hasImage))
    const qs = params.toString()
    const data = await this.fetchJson<ArchiveAsset[]>(`/assets${qs ? `?${qs}` : ''}`)
    return data ?? []
  }

  async get(id: string): Promise<ArchiveAsset | null> {
    return this.fetchJson<ArchiveAsset>(`/assets/${encodeURIComponent(id)}`)
  }

  async sources(): Promise<SourceRecord[]> {
    return (await this.fetchJson<SourceRecord[]>('/sources')) ?? []
  }
}

async function loadLocalArchive(): Promise<ArchiveData> {
  const [assets, editorial, sources] = await Promise.all([
    import('./assets.json').then((m) => m.default as unknown as ArchiveAsset[]),
    import('./editorial.json').then((m) => m.default as unknown as ArchiveAsset[]),
    import('./sources.json').then((m) => m.default as unknown as SourceRecord[]),
  ])
  // Withdrawn records (unverified material) never reach the archive (data/archive/placement).
  return { assets: [...editorial, ...assets].filter((a) => !isWithdrawn(a.id)), sources }
}

export function createArchiveRepository(): ArchiveRepository {
  const api = import.meta.env.VITE_ARCHIVE_API_URL
  if (api) return new HttpArchiveRepository(api)
  return new MockArchiveRepository(loadLocalArchive)
}

export const defaultArchiveRepository: ArchiveRepository = createArchiveRepository()

export const ArchiveRepositoryContext = createContext<ArchiveRepository>(defaultArchiveRepository)

export function useArchiveRepository(): ArchiveRepository {
  return useContext(ArchiveRepositoryContext)
}
