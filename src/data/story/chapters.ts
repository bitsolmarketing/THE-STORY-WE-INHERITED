/**
 * The 1947 opening (storyboard E01–E02), told as one continuous sequence:
 *
 *   DARKNESS / DUST → LAND OUTLINE → 1947 → PAKISTAN IS BORN → PARTITION → MIGRATION
 *   → HUMAN EXPERIENCE (platform, traveller, train) → HISTORICAL JOURNEY (window → paper → time)
 *
 * Durations are in judges'-cut seconds (see PACING); the timeline turns them into progress.
 * Copy follows SPEC_PHASE01 §04: label / title / one short line. Detail lives in the archive.
 */

export type ChapterId =
  | 'prologue'
  | 'land'
  | 'born'
  | 'partition'
  | 'migration'
  | 'protagonist'
  | 'train'
  | 'departure'
  | 'journey'

export interface OpeningChapter {
  id: ChapterId
  /** Seconds in the judges' cut. */
  seconds: number
  /** Storyboard beat this chapter tells (archive filtering, IN POWER). */
  eventId: 'E01' | 'E02'
  /** Short mono label shown above the title, e.g. a date. Empty string hides it. */
  label: string
  /** Display title (Cormorant Garamond). Empty string hides it. */
  title: string
  /** One short contextual line (Inter). Empty string hides it. */
  line: string
  /** Whether the persistent year indicator is visible (it is born out of the paper in 'land'). */
  showYear: boolean
  /** Show the event's IN POWER layer under the caption. */
  showInPower?: boolean
  /** Caption layout: the prologue uses a centred film title. */
  layout?: 'title' | 'caption'
  /** The picture is the film's illustrated diorama, not archival material: the caption says so. */
  illustration?: boolean
  /** Note for historian / editorial review. Not rendered. */
  review?: string
}

export const OPENING_CHAPTERS: readonly OpeningChapter[] = [
  {
    id: 'prologue',
    seconds: 3.5,
    eventId: 'E01',
    label: 'A VACTRA TECH INTERACTIVE EXPERIENCE',
    title: 'Inherited',
    line: 'A Visual History of Pakistan',
    showYear: false,
    layout: 'title',
  },
  {
    id: 'land',
    seconds: 3,
    eventId: 'E01',
    label: 'SPRING 1947',
    title: 'British India',
    line: 'One subcontinent. Four hundred million people. The last months of an empire.',
    // The year is pressed into the paper here; the indicator takes over as it lifts off in 'born'.
    showYear: false,
    review: 'Population figure is a rounded 1941-census-era estimate; confirm preferred wording.',
  },
  {
    id: 'born',
    seconds: 3.5,
    eventId: 'E01',
    label: '14 AUGUST 1947',
    title: 'Pakistan is born',
    line: 'Independence, Partition and the beginning of a new state.',
    showYear: true,
    showInPower: true,
    review: 'Pakistan: 14 August 1947. India: midnight, 15 August 1947.',
  },
  {
    id: 'partition',
    seconds: 3,
    eventId: 'E01',
    label: '17 AUGUST 1947',
    title: 'Partition',
    line: 'The boundary awards are published. The Punjab and Bengal are divided on paper.',
    showYear: true,
    review: 'The 3 June Plan was announced on 3 June 1947; the Radcliffe awards were published on 17 August 1947.',
  },
  {
    id: 'migration',
    seconds: 3,
    eventId: 'E02',
    label: '1947 – 1948',
    title: 'Migration & state-building',
    line: 'Mass migration, refugee settlement and the rapid creation of institutions and services.',
    showYear: true,
    review: 'Displacement estimates range widely (c. 10–20 million); the copy deliberately avoids a figure.',
  },
  {
    id: 'protagonist',
    seconds: 2.75,
    eventId: 'E02',
    label: 'A PLATFORM, 1947',
    title: 'One of the millions',
    line: 'A single traveller. A suitcase. Everything else stays behind.',
    showYear: true,
    illustration: true,
    review: 'Composite, fictional civilian. Not a documented person. No name is given by design.',
  },
  {
    id: 'train',
    seconds: 2.75,
    eventId: 'E02',
    label: 'THE TRAIN',
    title: 'Refugee special',
    line: 'Trains ran in both directions, carrying far more than they were built for.',
    showYear: true,
    illustration: true,
    review: '"Refugee special" was the contemporary term for these services; confirm usage.',
  },
  {
    id: 'departure',
    seconds: 2.75,
    eventId: 'E02',
    label: 'DEPARTURE',
    title: 'The train moves',
    line: 'Behind the window, a home. Ahead, a new country.',
    showYear: true,
    illustration: true,
  },
  {
    id: 'journey',
    seconds: 1.75,
    eventId: 'E02',
    label: '',
    title: '',
    line: '',
    showYear: true,
  },
] as const

export function openingChapterById(id: ChapterId): OpeningChapter {
  const c = OPENING_CHAPTERS.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown opening chapter: ${id}`)
  return c
}
