/**
 * Archival asset contract (spec §17, brief STEP 08). The backend developer owns the data; this is
 * the frontend's view of it. Keep it serialisable (plain JSON), so API responses map 1:1.
 * assets.json is generated from docs/archive/MASTER_IMAGE_MANIFEST.csv by `npm run import:archive`.
 */
export type ArchiveAssetType = 'photograph' | 'newspaper' | 'document' | 'map' | 'letter' | 'ticket' | 'stamp'

export type ProvenanceStatus = 'verified' | 'unverified'

/**
 * Rights, verbatim from the research archive:
 *  clear         — CC0 / public domain / open licence whose terms are met by the credit line
 *  likely-clear  — stated public domain by age; confirm before wider publication
 *  verify        — VERIFY BEFORE PUBLIC USE: never shown in the film, kept in the archive and marked
 *  owner-supplied — supplied by the project owner, who holds the licence question (agency photographs);
 *                   shown in the film, marked in the archive, credit "not recorded" until confirmed
 */
export type RightsStatus = 'clear' | 'likely-clear' | 'verify' | 'owner-supplied'

/**
 * What the material IS (brief's three categories):
 *  historical      — real historical material (photograph, document, newspaper, map of the period)
 *  contextual      — real but modern (photograph of a site today, video frame, data visualisation)
 *  stand-in        — related subject, NOT the event itself (e.g. the same rocket type)
 *  reconstruction  — diorama, artwork, illustration: NOT an original historical image
 * Rights requiring verification are expressed by `rights.status === 'verify'`, independently.
 */
export type MaterialClass = 'historical' | 'contextual' | 'stand-in' | 'reconstruction'

export interface ArchiveAsset {
  id: string
  type: ArchiveAssetType
  title: string
  year: number
  /** Date as given by the source (ISO where known, else free text such as "1947 (spring)"). */
  date?: string
  /** Holding institution / origin of the item. */
  source: string
  /** Canonical page for the item at the source (licence and provenance live there). */
  url?: string
  /** Non-URL source reference, e.g. "Internet Archive — PROPIX item 26898826823". */
  sourceRef?: string
  /** Direct link to a web-size original (for the data owner to fetch missing files). */
  downloadUrl?: string
  /** Licence as recorded from the source. */
  license?: string
  /** Author / photographer / credit line. */
  credit?: string
  /** Whether attribution is required, as recorded by the researcher. */
  attribution?: string
  description: string
  /** Optimised local image (archive detail size). Absent = no image held yet. */
  localPath?: string
  /** In-film texture size. */
  filmPath?: string
  /** High-density in-film texture (2048 px), used on the high quality tier. */
  filmHiPath?: string
  /** Grid thumbnail. */
  thumbPath?: string
  /** Responsive WebP widths for the archive detail and full-screen use. */
  webp?: { w: number; path: string }[]
  /** Built from a restored master (scripts/enhance-archive.mjs) rather than the raw original. */
  enhanced?: boolean
  /** The original source file's own dimensions. */
  width?: number
  height?: number
  /** Storyboard beats (E01…E56) this record belongs to. */
  eventIds: string[]
  rights: { status: RightsStatus; statement: string; publicDomain?: string }
  /** Authenticity class verbatim from the research archive (e.g. "ORIGINAL HISTORICAL PHOTOGRAPH"). */
  authenticity: string
  materialClass: MaterialClass
  /** Researcher's image class (A — HERO … F — MAP). */
  imageClass?: string
  quality?: string
  recommendedUse?: string
  notes?: string
  originalFilename?: string
  tags?: string[]
  provenance?: {
    status: ProvenanceStatus
    /** Why it is (or is not) verified; what a historian should check. */
    note?: string
    /** When the metadata was captured from the source (ISO date). */
    capturedAt?: string
  }
}

/** Bibliographic entry for the SOURCES category. */
export interface SourceRecord {
  id: string
  title: string
  author?: string
  publisher?: string
  year?: number
  url?: string
  note?: string
  eventIds?: string[]
}

/**
 * May this asset appear in the cinematic layer? Only real images we hold locally whose rights are
 * clear or likely clear. Reconstructions and stand-ins never appear as if they were the event.
 */
export function isFilmUsable(a: ArchiveAsset): boolean {
  return (
    Boolean(a.filmPath) &&
    a.rights.status !== 'verify' &&
    a.materialClass !== 'reconstruction' &&
    a.materialClass !== 'stand-in'
  )
}
