/**
 * Placement corrections for the film layer (the photographs laid on the table beside each frame).
 *
 * The research manifest catalogues every image under the beat it was collected for, and the film
 * fills a frame from that list. Some of those images are good archive records but do not show the
 * frame's subject; laid beside the caption they would read as an illustration of it. They stay in
 * the archive (catalogued, with their full description) and are only kept off the table here.
 *
 * Positive placements (which image leads a frame, and images moved from another beat) live in each
 * event's `visualTreatment.prints` in `src/data/story/events.ts`.
 */
export interface FilmExclusion {
  id: string
  reason: string
}

export const FILM_EXCLUDE: Record<string, FilmExclusion[]> = {
  E04: [
    { id: '1949-inter-dominion-conference-karachi-25jun1949', reason: 'Inter-Dominion Conference, 25 June 1949: a separate event, not the Objectives Resolution (12 March 1949).' },
    { id: '1949-rijksmuseum-attlee-liaquat-1949', reason: 'Commonwealth prime ministers in London, 21 April 1949: not the Objectives Resolution.' },
  ],
  E11: [
    { id: '1962-ayub-jacqueline-kennedy-lahore-mar1962', reason: "Jacqueline Kennedy's motorcade in Lahore, 21 March 1962: context for the year, not the 1962 Constitution." },
  ],
  E12: [{ id: '1965-usaid-mangla-plaque-2012', reason: 'A 2012 USAID plaque: does not show the construction of Mangla Dam.' }],
  E15: [{ id: '1968-tarbela-usaid-overview', reason: 'A 2011 view of the finished dam: does not show construction (1968). Tarbela photographs lead the 1974 frame.' }],
  E20: [{ id: '1973-bhutto-schiphol-1973', reason: 'Bhutto at Schiphol airport, September 1973: not connected to the Constitution.' }],
  E32: [{ id: '1990-nawaz-sharif-cohen-1998', reason: 'Sharif with US Defense Secretary Cohen, December 1998: his second government, not the first (1990).' }],
  E40: [{ id: '2010-pm-gilani-white-house-jul2008', reason: 'PM Gilani at the White House, July 2008: does not show the 18th Amendment.' }],
}

/**
 * Records withdrawn from the site entirely (film and archive) until they can be verified. They
 * stay in the research manifest; they are only filtered when the archive loads, so a re-import
 * never brings them back.
 */
export const ARCHIVE_WITHDRAWN: FilmExclusion[] = [
  {
    id: '1947-independence-midnight-celebration',
    reason: 'Year not stated on the source page and the photograph appears modern; unverified as 1947 (withdrawn on the data owner\'s instruction, 4 Oct 2026).',
  },
]

export function isWithdrawn(assetId: string): boolean {
  return ARCHIVE_WITHDRAWN.some((x) => x.id === assetId)
}

export function isExcludedFromFilm(eventId: string, assetId: string): boolean {
  return isWithdrawn(assetId) || (FILM_EXCLUDE[eventId] ?? []).some((x) => x.id === assetId)
}
