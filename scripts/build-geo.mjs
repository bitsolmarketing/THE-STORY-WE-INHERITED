/**
 * Builds src/data/geo/subcontinent.json from Natural Earth (public domain) via world-atlas.
 *
 * Output coordinates are WORLD UNITS on the ground plane (x east, z south), using a conic
 * conformal projection centred between Lahore and Amritsar so the Punjab boundary lands near the
 * world origin (see src/scenes/world/layout.ts → MAP).
 *
 * Boundary policy (documented in docs/ARCHITECTURE.md §5 and the SOURCES archive entry):
 *  - West: the India–Pakistan boundary from the Arabian Sea north to ~32.55°N (the end of the
 *    Punjab award at the former princely state of Jammu & Kashmir). No line through Kashmir.
 *  - East: the India–Bangladesh boundary (the Bengal award and the Sylhet/Assam adjustments).
 *  - Modern Natural Earth lines approximate the 1947 awards at this scale.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoConicConformal, geoDistance } from 'd3-geo'
import * as topojson from 'topojson-client'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const countriesTopo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'))
const landTopo = JSON.parse(readFileSync(require.resolve('world-atlas/land-50m.json'), 'utf8'))

const CENTER = [74.2, 31.5]
const UNITS_PER_DEGREE = 3.2
const KASHMIR_CUT_LAT = 32.55
const BBOX = { lonMin: 58, lonMax: 100, latMin: 2, latMax: 40 }

// ISO 3166-1 numeric ids used by world-atlas.
const ID = { IND: '356', PAK: '586', BGD: '050', AFG: '004', NPL: '524', BTN: '064', LKA: '144', MMR: '104', CHN: '156', IRN: '364', TKM: '795', UZB: '860', TJK: '762' }

const projection = geoConicConformal().parallels([20, 36]).rotate([-CENTER[0], 0]).center([0, CENTER[1]]).translate([0, 0])
// Calibrate scale so that one degree of latitude at the centre equals UNITS_PER_DEGREE world units.
projection.scale(1)
const a = projection([CENTER[0], CENTER[1] - 0.5])
const b = projection([CENTER[0], CENTER[1] + 0.5])
const perDegreeAtScale1 = Math.hypot(b[0] - a[0], b[1] - a[1])
projection.scale(UNITS_PER_DEGREE / perDegreeAtScale1)

const toWorld = ([lon, lat]) => {
  const p = projection([lon, lat])
  return [round(p[0]), round(p[1])] // x east, z south (d3 y grows downward = south)
}
const round = (v) => Math.round(v * 100) / 100
const inBox = ([lon, lat]) => lon >= BBOX.lonMin && lon <= BBOX.lonMax && lat >= BBOX.latMin && lat <= BBOX.latMax

/** Convert a GeoJSON MultiLineString/LineString into world polylines, splitting where it leaves the bbox. */
function linesToWorld(geom, filterLonLat = () => true) {
  const coordsList = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : []
  const out = []
  for (const line of coordsList) {
    let current = []
    for (const c of line) {
      if (inBox(c) && filterLonLat(c)) {
        current.push(toWorld(c))
      } else if (current.length > 1) {
        out.push(current)
        current = []
      } else {
        current = []
      }
    }
    if (current.length > 1) out.push(current)
  }
  return out
}

/** Polygon rings → world polylines (for coastlines of specific countries, clipped to bbox). */
function polygonsToWorld(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  const out = []
  for (const poly of polys) {
    for (const ring of poly) {
      const w = linesToWorld({ type: 'LineString', coordinates: ring })
      out.push(...w)
    }
  }
  return out
}

const countries = countriesTopo.objects.countries
const land = landTopo.objects.land

// Coastline: land mesh clipped to the bbox.
const coastMesh = topojson.mesh(landTopo, land)
const coast = linesToWorld(coastMesh)

// Shared boundaries.
const westMesh = topojson.mesh(countriesTopo, countries, (x, y) => (x.id === ID.IND && y.id === ID.PAK) || (x.id === ID.PAK && y.id === ID.IND))
const borderWest = linesToWorld(westMesh, ([, lat]) => lat <= KASHMIR_CUT_LAT)

const eastMesh = topojson.mesh(countriesTopo, countries, (x, y) => (x.id === ID.IND && y.id === ID.BGD) || (x.id === ID.BGD && y.id === ID.IND))
const borderEast = linesToWorld(eastMesh)

// Faint context: other international boundaries in the region (Afghanistan, Iran, Nepal, Bhutan, Burma, China).
const contextIds = new Set([ID.AFG, ID.IRN, ID.NPL, ID.BTN, ID.MMR, ID.CHN])
const subIds = new Set([ID.IND, ID.PAK, ID.BGD])
const contextMesh = topojson.mesh(countriesTopo, countries, (x, y) => x !== y && ((subIds.has(x.id) && contextIds.has(y.id)) || (subIds.has(y.id) && contextIds.has(x.id))))
const contextBorders = linesToWorld(contextMesh, ([, lat]) => lat <= 37.5)

// Region fills (for the ink "fragment shift" mask): India, Pakistan, Bangladesh polygons in world space.
function featureById(id) {
  return topojson.feature(countriesTopo, countries).features.find((f) => f.id === id)
}
const regions = {
  pakistan: polygonsToWorld(featureById(ID.PAK).geometry),
  india: polygonsToWorld(featureById(ID.IND).geometry),
  bangladesh: polygonsToWorld(featureById(ID.BGD).geometry),
  ceylon: polygonsToWorld(featureById(ID.LKA).geometry),
}
// Also provide polygon rings (closed, unclipped where possible) for canvas fill operations.
function polygonRingsWorld(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  return polys.map((poly) => poly[0].filter(inBox).map(toWorld)).filter((r) => r.length > 3)
}
const regionRings = {
  pakistan: polygonRingsWorld(featureById(ID.PAK).geometry),
  india: polygonRingsWorld(featureById(ID.IND).geometry),
  bangladesh: polygonRingsWorld(featureById(ID.BGD).geometry),
}

// 1947 place names (contemporary spellings). size: 3 = capital/major, 2 = major, 1 = minor.
const CITIES = [
  ['Karachi', 67.01, 24.86, 3],
  ['Lahore', 74.35, 31.55, 3],
  ['Amritsar', 74.87, 31.63, 2],
  ['Delhi', 77.21, 28.61, 3],
  ['Bombay', 72.88, 19.08, 3],
  ['Calcutta', 88.36, 22.57, 3],
  ['Dacca', 90.41, 23.81, 2],
  ['Peshawar', 71.58, 34.01, 2],
  ['Quetta', 67.0, 30.18, 1],
  ['Rawalpindi', 73.07, 33.6, 1],
  ['Multan', 71.47, 30.2, 1],
  ['Hyderabad', 68.37, 25.39, 1],
  ['Lucknow', 80.95, 26.85, 1],
  ['Madras', 80.27, 13.08, 2],
  ['Chittagong', 91.8, 22.35, 1],
  ['Colombo', 79.86, 6.93, 1],
].map(([name, lon, lat, size]) => {
  const [x, z] = toWorld([lon, lat])
  return { name, lon, lat, x, z, size }
})

/*
 * ── Chronicle (1948–2026) map material ────────────────────────────────────────────────────────
 * Same projection and units as the opening map, so plates can rescale them freely.
 * Kashmir policy for every boundary drawn after 1947: no line is drawn inside the box
 * lon > 72.8 && lat > 32.55 (Jammu & Kashmir / Gilgit-Baltistan), the same restraint the
 * opening map applies with KASHMIR_CUT_LAT.
 */
const inKashmirBox = ([lon, lat]) => lon > 72.8 && lat > 32.55
const outsideKashmir = (c) => !inKashmirBox(c)

const pakMesh = (otherId) =>
  topojson.mesh(countriesTopo, countries, (x, y) => (x.id === ID.PAK && y.id === otherId) || (x.id === otherId && y.id === ID.PAK))
const pakistanWing = {
  coast: linesToWorld(coastMesh, ([lon, lat]) => lon >= 61 && lon <= 68.9 && lat <= 26.2),
  iran: linesToWorld(pakMesh(ID.IRN), outsideKashmir),
  afghanistan: linesToWorld(pakMesh(ID.AFG), outsideKashmir),
  india: borderWest,
}
// The two wings of 1947–71 as open outlines (the West wing ring without its Kashmir segments).
function ringWorld(id, filter) {
  const g = featureById(id).geometry
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const out = []
  for (const poly of polys) out.push(...linesToWorld({ type: 'LineString', coordinates: poly[0] }, filter))
  return out.filter((l) => l.length > 2)
}
const wings = {
  west: ringWorld(ID.PAK, outsideKashmir),
  east: ringWorld(ID.BGD, () => true),
}

/*
 * Schematic courses of the six Indus-system rivers (approximate waypoints, west to east).
 * Used only as an illustrative motif ("rivers divided into light", Indus Waters Treaty 1960),
 * never as survey data. Western rivers went to Pakistan; eastern rivers to India.
 */
const RIVERS = {
  indus: { side: 'west', pts: [[81.0, 31.1], [79.4, 32.6], [77.58, 34.16], [75.6, 35.3], [74.6, 35.75], [73.3, 35.5], [72.9, 34.9], [72.7, 34.1], [72.25, 33.9], [71.5, 32.95], [70.9, 31.8], [70.6, 30.4], [70.4, 28.95], [69.6, 28.3], [68.85, 27.7], [68.2, 26.6], [68.35, 25.4], [67.95, 24.75], [67.4, 24.05]] },
  jhelum: { side: 'west', pts: [[75.25, 33.55], [74.8, 34.08], [74.35, 34.2], [73.47, 34.37], [73.6, 33.6], [73.65, 33.15], [73.73, 32.93], [72.35, 32.3], [72.15, 31.15]] },
  chenab: { side: 'west', pts: [[76.7, 32.9], [75.77, 33.32], [74.73, 32.9], [74.45, 32.67], [74.12, 32.45], [72.97, 31.72], [72.15, 31.15], [71.6, 30.2], [71.0, 29.35], [70.4, 28.95]] },
  ravi: { side: 'east', pts: [[76.6, 32.4], [76.13, 32.55], [75.6, 32.37], [74.9, 31.95], [74.3, 31.6], [73.4, 31.05], [72.6, 30.75], [71.95, 30.62]] },
  beas: { side: 'east', pts: [[77.2, 32.37], [77.1, 31.96], [76.93, 31.7], [76.4, 31.85], [75.95, 31.97], [75.35, 31.45], [74.95, 31.15]] },
  sutlej: { side: 'east', pts: [[78.75, 31.82], [77.63, 31.45], [76.43, 31.41], [76.53, 30.97], [75.8, 31.05], [74.95, 31.15], [74.6, 30.95], [73.9, 30.3], [72.9, 29.95], [71.7, 29.4], [71.0, 29.35]] },
}
/** Centripetal-ish Catmull-Rom subdivision so schematic waypoints read as rivers, not roads. */
function smooth(pts, steps = 6) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
const rivers = Object.fromEntries(
  Object.entries(RIVERS).map(([name, r]) => [name, { side: r.side, line: smooth(r.pts).map(toWorld) }]),
)
// The 1947 map shows the rivers of the plains only (below the hills; nothing through Kashmir).
const plainsRivers = Object.values(RIVERS)
  .map((r) => smooth(r.pts).filter(([lon, lat]) => lat < 33.2 && !inKashmirBox([lon, lat])).map(toWorld))
  .filter((l) => l.length > 2)

/*
 * Frontiers safe to draw as ink in 1947: Pakistan–Afghanistan, Pakistan–Iran, India–Nepal,
 * India–Bhutan, India/East Bengal–Burma. Dropped entirely: anything inside the Kashmir box, and
 * the China–India sectors (western/middle sector and Arunachal), which are disputed today.
 */
const outsideDisputed = ([lon, lat]) =>
  !inKashmirBox([lon, lat]) && !(lat > 30.2 && lon > 76.5 && lon < 81.3) && !(lat > 26.6 && lon > 91.4 && lon < 97.5)
const contextSafe = linesToWorld(contextMesh, outsideDisputed)

/*
 * The neighbours' own frontiers, so the subcontinent is not drawn as an island. Only frontiers
 * that were settled in 1947 are inked: Afghanistan–Iran, and the Soviet frontier with Afghanistan
 * and Iran (the Amu Darya and the Kopet Dag; the Soviet republics' borders with each other are
 * internal in 1947 and are not drawn). The frontier between British India / Jammu & Kashmir and
 * Sinkiang–Tibet was undefined in 1947 (and is disputed today): it is never drawn, only noted.
 * Burma–China and Bhutan–Tibet were undemarcated in 1947 and are left out for the same reason.
 */
const USSR = new Set([ID.TKM, ID.UZB, ID.TJK])
const pairIs = (x, y, a, b) => (x.id === a && y.id === b) || (x.id === b && y.id === a)
const neighbourMesh = topojson.mesh(countriesTopo, countries, (x, y) => {
  if (x === y) return false
  if (pairIs(x, y, ID.AFG, ID.IRN)) return true
  const sovietPair = (USSR.has(x.id) && (y.id === ID.AFG || y.id === ID.IRN)) || (USSR.has(y.id) && (x.id === ID.AFG || x.id === ID.IRN))
  return sovietPair
})
const neighbourBorders = linesToWorld(neighbourMesh, ([lon, lat]) => !inKashmirBox([lon, lat]) && lat <= BBOX.latMax)

/** Land polygons (outer rings) for the land/sea tint. Points are clamped into the bbox before projecting. */
const landFeature = topojson.feature(landTopo, land)
const landRings = []
for (const f of landFeature.features ?? [landFeature]) {
  const g = f.geometry ?? f
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const poly of polys) {
    const ring = poly[0]
    if (!ring.some(inBox)) continue
    const clamped = ring.map(([lon, lat]) => [
      Math.min(BBOX.lonMax + 2, Math.max(BBOX.lonMin - 2, lon)),
      Math.min(BBOX.latMax + 2, Math.max(BBOX.latMin - 2, lat)),
    ])
    const pts = clamped.map(toWorld)
    // Light simplification: drop points closer than 0.15 units to the previous kept point.
    const out = [pts[0]]
    for (const p of pts) {
      const q = out[out.length - 1]
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.15) out.push(p)
    }
    if (out.length > 3) landRings.push(out)
  }
}

/*
 * Approximate extent of the princely state of Jammu & Kashmir in 1947. Used ONLY as a soft,
 * blurred mask so the 14 August 1947 wash over the new state never covers it (J&K was part of
 * neither dominion on that date). It is never drawn as a line.
 */
const KASHMIR_1947 = [
  [73.55, 32.95], [73.65, 33.6], [73.45, 34.1], [73.35, 34.45], [73.75, 34.75], [73.65, 35.1], [73.1, 35.35],
  [72.55, 35.95], [72.6, 36.5], [73.6, 36.95], [75.0, 37.1], [76.8, 36.2], [78.2, 35.8], [80.3, 35.4],
  [79.5, 32.6], [77.9, 32.6], [76.6, 33.0], [75.75, 32.4], [75.3, 32.25], [74.6, 32.45], [74.0, 32.75],
]
const kashmirMask = KASHMIR_1947.map(toWorld)

/*
 * Schematic alignments for chronicle frames (approximate waypoints; illustrative, not survey data).
 * KKH: Hasan Abdal → Khunjerab Pass along the Indus and Hunza valleys.
 * M-2: Lahore → Islamabad. M-4: Faisalabad → Khanewal.
 * CPEC (western alignment, as drawn in the storyboard sense of "corridor"): Kashgar → Khunjerab →
 * Islamabad → D.I. Khan → Zhob → Quetta → Surab → Hoshab → Gwadar.
 */
const ROUTES_LONLAT = {
  kkh: [[72.69, 33.82], [73.22, 34.15], [73.2, 34.33], [72.95, 34.85], [72.88, 34.93], [73.29, 35.29], [74.1, 35.42], [74.55, 35.75], [74.31, 35.92], [74.66, 36.32], [74.82, 36.69], [75.42, 36.85]],
  m2: [[74.3, 31.6], [73.98, 31.72], [73.4, 31.9], [73.05, 32.25], [72.75, 32.7], [72.85, 33.15], [73.0, 33.55]],
  m4: [[73.08, 31.42], [72.68, 31.15], [72.3, 30.95], [72.1, 30.6], [71.93, 30.3]],
  cpec: [[75.99, 39.47], [75.6, 38.0], [75.42, 36.85], [74.82, 36.69], [74.66, 36.32], [74.31, 35.92], [74.1, 35.42], [73.29, 35.29], [72.95, 34.85], [73.2, 34.33], [73.05, 33.68], [71.9, 32.9], [70.9, 31.83], [69.45, 31.34], [67.0, 30.18], [66.26, 28.49], [63.94, 26.0], [62.33, 25.12]],
  fiber: [[75.42, 36.85], [74.82, 36.69], [74.66, 36.32], [74.31, 35.92], [74.1, 35.42], [73.29, 35.29], [72.95, 34.85], [73.2, 34.33], [73.07, 33.6]],
}
const routes = Object.fromEntries(Object.entries(ROUTES_LONLAT).map(([k, pts]) => [k, smooth(pts, 4).map(toWorld)]))

// Map lettering (contemporary 1947 names), drawn by the paper scene.
const LABELS = [
  ['ARABIAN SEA', 64.2, 17.5, 'sea'],
  ['BAY OF BENGAL', 88.6, 16.2, 'sea'],
  ['PUNJAB', 72.6, 30.9, 'region'],
  ['BENGAL', 88.3, 24.6, 'region'],
  ['SIND', 68.7, 26.6, 'region'],
  ['BALUCHISTAN', 65.6, 28.0, 'region'],
  ['N.-W. F. P.', 71.0, 34.6, 'region'],
  ['ASSAM', 92.6, 26.1, 'region'],
  // Neighbouring states in 1947 (names of the day). Tibet is lettered as a region, as on the
  // maps of the period; Sinkiang was a province of the Republic of China.
  ['AFGHANISTAN', 65.6, 33.4, 'country'],
  ['IRAN', 59.9, 30.6, 'country'],
  ['CHINA', 84.0, 38.3, 'country'],
  ['SINKIANG', 84.0, 37.3, 'region'],
  ['TIBET', 86.5, 32.2, 'region'],
  ['NEPAL', 83.6, 28.5, 'country'],
  ['BURMA', 95.6, 21.6, 'country'],
  ['frontier undefined', 79.6, 34.6, 'note'],
].map(([name, lon, lat, kind]) => {
  const [x, z] = toWorld([lon, lat])
  return { name, x, z, kind }
})

// Places referenced by chronicle frames (modern names; 1947 names stay in CITIES above).
const PLACES = [
  ['Islamabad', 73.05, 33.68],
  ['Rawalpindi', 73.07, 33.6],
  ['Lahore', 74.35, 31.55],
  ['Karachi', 67.01, 24.86],
  ['Peshawar', 71.58, 34.01],
  ['Quetta', 67.0, 30.18],
  ['Multan', 71.47, 30.2],
  ['Faisalabad', 73.08, 31.42],
  ['Khanewal', 71.93, 30.3],
  ['Sukkur', 68.86, 27.7],
  ['Hyderabad', 68.37, 25.39],
  ['Gwadar', 62.33, 25.12],
  ['Sonmiani', 66.6, 25.42],
  ['Mangla', 73.65, 33.14],
  ['Tarbela', 72.69, 34.09],
  ['Warsak', 71.36, 34.16],
  ['Hasan Abdal', 72.69, 33.82],
  ['Khunjerab Pass', 75.42, 36.85],
  ['Chagai Hills', 64.95, 28.8],
  ['Muzaffarabad', 73.47, 34.37],
  ['Bahawalpur', 71.68, 29.4],
  ['Sialkot', 74.53, 32.49],
  ['Kashgar', 75.99, 39.47],
  ['Dhaka', 90.41, 23.81],
  ['Delhi', 77.21, 28.61],
].map(([name, lon, lat]) => {
  const [x, z] = toWorld([lon, lat])
  return { name, lon, lat, x, z }
})

// Neighbours lettered on the chronicle's maps of Pakistan (modern names, placed well inside each
// country and clear of Jammu & Kashmir).
const NEIGHBOUR_LABELS = [
  ['AFGHANISTAN', 66.2, 33.2],
  ['IRAN', 60.4, 28.6],
  ['CHINA', 79.0, 38.4],
  ['INDIA', 75.6, 27.4],
].map(([name, lon, lat]) => {
  const [x, z] = toWorld([lon, lat])
  return { name, x, z }
})

// Graticule every 5 degrees, clipped.
const graticule = []
for (let lon = 60; lon <= 100; lon += 5) {
  const pts = []
  for (let lat = BBOX.latMin; lat <= BBOX.latMax; lat += 0.5) pts.push(toWorld([lon, lat]))
  graticule.push(pts)
}
for (let lat = 5; lat <= 40; lat += 5) {
  const pts = []
  for (let lon = BBOX.lonMin; lon <= BBOX.lonMax; lon += 0.5) pts.push(toWorld([lon, lat]))
  graticule.push(pts)
}

const allPts = [...coast, ...borderWest, ...borderEast].flat()
const xs = allPts.map((p) => p[0])
const zs = allPts.map((p) => p[1])
const bbox = { xMin: Math.min(...xs), xMax: Math.max(...xs), zMin: Math.min(...zs), zMax: Math.max(...zs) }

// Sanity: distance Lahore→Karachi in world units vs km (≈ 1,020 km great-circle).
const kmLahoreKarachi = geoDistance([74.35, 31.55], [67.01, 24.86]) * 6371
const lk = CITIES.find((c) => c.name === 'Lahore')
const kr = CITIES.find((c) => c.name === 'Karachi')
const worldLahoreKarachi = Math.hypot(lk.x - kr.x, lk.z - kr.z)

const out = {
  meta: {
    source: 'Natural Earth 1:50m via world-atlas (public domain)',
    projection: 'conic conformal, parallels 20/36, centre 74.2E 31.5N',
    unitsPerDegree: UNITS_PER_DEGREE,
    kmPerUnit: round(kmLahoreKarachi / worldLahoreKarachi),
    kashmirCutLat: KASHMIR_CUT_LAT,
    note: 'West boundary stops at the Jammu & Kashmir state line; no boundary is drawn through Kashmir.',
    bbox,
  },
  coast,
  borderWest,
  borderEast,
  contextBorders,
  regions,
  regionRings,
  graticule,
  cities: CITIES,
  pakistanWing,
  wings,
  rivers,
  plainsRivers,
  places: PLACES,
  contextSafe,
  neighbourBorders,
  neighbourLabels: NEIGHBOUR_LABELS,
  landRings,
  kashmirMask,
  labels: LABELS,
  routes,
}

const dest = resolve(__dirname, '../src/data/geo/subcontinent.json')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, JSON.stringify(out))
const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024)
console.log(`wrote ${dest} (${kb} KB)`)
console.log(`coast ${coast.length} lines, west ${borderWest.length}, east ${borderEast.length}, context ${contextBorders.length}`)
console.log(`bbox`, bbox, `km/unit ≈ ${out.meta.kmPerUnit}`)
