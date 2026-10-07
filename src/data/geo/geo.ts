import raw from './subcontinent.json'

/** Typed view of subcontinent.json (built by scripts/build-geo.mjs; world units, x east, z south). */
export type Pt = [number, number]
export type Line = Pt[]

export interface GeoData {
  meta: { kmPerUnit: number; note: string }
  coast: Line[]
  borderWest: Line[]
  borderEast: Line[]
  contextSafe: Line[]
  /** Frontiers between the neighbours themselves that were settled in 1947 (Afghanistan, Iran, USSR). */
  neighbourBorders: Line[]
  /** Neighbouring countries lettered on the chronicle's maps of Pakistan (modern names). */
  neighbourLabels: { name: string; x: number; z: number }[]
  landRings: Line[]
  regionRings: { pakistan: Line[]; india: Line[]; bangladesh: Line[] }
  graticule: Line[]
  cities: { name: string; x: number; z: number; size: 1 | 2 | 3 }[]
  labels: { name: string; x: number; z: number; kind: 'sea' | 'region' | 'country' | 'note' }[]
  kashmirMask: Line
  pakistanWing: { coast: Line[]; iran: Line[]; afghanistan: Line[]; india: Line[] }
  wings: { west: Line[]; east: Line[] }
  rivers: Record<'indus' | 'jhelum' | 'chenab' | 'ravi' | 'beas' | 'sutlej', { side: 'west' | 'east'; line: Line }>
  /** The same rivers, plains only, for the 1947 map. */
  plainsRivers: Line[]
  places: { name: string; x: number; z: number }[]
  /** Schematic alignments (world units): kkh, m2, m4, cpec, fiber. */
  routes: Record<'kkh' | 'm2' | 'm4' | 'cpec' | 'fiber', Line>
}

export const GEO = raw as unknown as GeoData

export function place(name: string): Pt {
  const p = GEO.places.find((x) => x.name === name)
  if (!p) throw new Error(`Unknown place: ${name}`)
  return [p.x, p.z]
}
