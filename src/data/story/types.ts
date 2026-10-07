/**
 * Story content contract (brief STEP 09). This is what the backend developer will eventually
 * supply. The cinematic engine reads these records through the StoryProvider and never assumes
 * where they came from. Keep it plain JSON-serialisable.
 */

/** How much screen time a frame earns in the judges' cut (storyboard pacing). */
export type Importance = 'major' | 'featured' | 'standard'

/** Editorial category of an event. Drives nothing visual on its own; useful for the archive and the backend. */
export type EventType =
  | 'founding'
  | 'migration'
  | 'politics'
  | 'constitution'
  | 'conflict'
  | 'loss'
  | 'infrastructure'
  | 'science'
  | 'sport'
  | 'disaster'
  | 'diplomacy'
  | 'future'

/** The storyboard's 2-minute flow: PROLOGUE → BIRTH → … → NEXT CHAPTER. */
export type MovementId =
  | 'prologue'
  | 'birth'
  | 'survival'
  | 'building'
  | 'conflict'
  | 'loss'
  | 'rebuilding'
  | 'achievement'
  | 'modern'
  | 'diplomacy'
  | 'next'

/** Visual metaphors available to chronicle frames (brief STEP 11). Each maps to one generator in scenes/chronicle/motifs. */
export type MotifId =
  | 'portrait'
  | 'document'
  | 'constitution'
  | 'nameplate'
  | 'rivers'
  | 'dam'
  | 'route'
  | 'crowd'
  | 'trajectory'
  | 'aircraft'
  | 'rocket'
  | 'split'
  | 'contours'
  | 'seismic'
  | 'frontline'
  | 'memorial'
  | 'industry'
  | 'ballot'
  | 'unification'
  | 'dialogue'
  | 'horizon'
  | 'network'
  | 'council'
  | 'constellation'
  | 'ledger'
  | 'pact'

export interface VisualTreatment {
  motif: MotifId
  /** Motif-specific parameters (documented next to each generator). Unknown keys are ignored. */
  params?: Record<string, string | number | boolean | string[]>
  /**
   * Archive asset ids laid on the table as physical prints. Only assets with a local image AND
   * rights status clear / likely-clear / owner-supplied are ever shown in the film; others are silently skipped
   * here and stay available in the archive with their status.
   */
  prints?: string[]
  /**
   * True when the motif depicts a document or object in illustrative form (pages, signatures,
   * nameplates). The film then shows an EDITORIAL RECONSTRUCTION mark while it is on screen.
   */
  reconstruction?: boolean
  /**
   * Strength (0..1) of the camera's lean over the hero photograph, overriding the importance
   * default — lower it for frames whose drawing carries the information (a chart, a council).
   */
  cutaway?: number
}

export interface PersonInPower {
  office: string
  name: string
  /** Optional qualifier such as "from 14 September 1948". */
  note?: string
}

/** Ambient sound hint for the AudioController (brief STEP 16). */
export type SoundCue = 'room' | 'wind' | 'crowd' | 'train' | 'water' | 'paper' | 'silence'

export type RightsStatus = 'clear' | 'likely-clear' | 'verify' | 'owner-supplied'

export interface KeyFigure {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  label: string
  /** An identifier rather than a quantity (a resolution number): shown as is, never counted. */
  fixed?: boolean
}

export interface StoryEvent {
  /** Storyboard id, E01 … E56. Also the key archive records use in `eventIds`. */
  id: string
  /** The year the year indicator holds during this frame. */
  year: number
  /** The storyboard's year text where it is a range or decade ("1947–48", "1960s"). */
  yearLabel?: string
  /** ISO date (or partial) where known. */
  date?: string
  /** Mono label above the title, e.g. "14 AUGUST 1947". */
  dateLabel: string
  title: string
  /** ONE short contextual line for the cinematic layer (storyboard text). */
  description: string
  /** Longer storyboard text, shown in the archive layer only. */
  detail?: string
  /** Key figures under the caption line, counted up as the frame develops (e.g. Rs 4.224 trillion). */
  figures?: KeyFigure[]
  /** A short dated sequence or list under the caption line (e.g. "7 May · Operation Sindoor"). */
  keyline?: { when: string; what: string }[]
  /** Short topic chips (e.g. areas of cooperation). */
  tags?: string[]
  /** A qualifying note set beneath the caption (balance, competing claims). */
  note?: string
  type: EventType
  importance: Importance
  movement: MovementId
  /** Seconds in the judges' cut. Defaults from `importance` (see PACING). */
  duration?: number
  visualTreatment: VisualTreatment
  /** Extra archive ids to surface with this event (the archive also matches records by `eventIds`). */
  archivalAssets?: string[]
  /** Source record ids (SOURCES category). */
  sources?: string[]
  /** Rights summary of the on-screen material, if the data owner supplies one. */
  rightsStatus?: RightsStatus
  /** Restrained IN POWER layer (brief STEP 10). */
  peopleInPower?: PersonInPower[]
  sound?: SoundCue
  /**
   * 'opening' events are told by the 1947 opening sequence (paper, map, train), not by a
   * chronicle frame. Everything else is a chronicle frame.
   */
  presentation?: 'opening' | 'chronicle'
  /** Editorial note for historian review. Never rendered. */
  review?: string
}
