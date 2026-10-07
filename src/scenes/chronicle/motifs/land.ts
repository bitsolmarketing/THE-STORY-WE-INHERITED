import type { MotifGenerator, MotifStroke, MotifLabel, MotifFill, MotifDots, UV } from './types'
import { BRASS, INK, OLIVE, PARCH, SAGE, SAND, TAUPE, closed, ellipse, fill, fitMap, label, mapLines, neighbourLabels, PAKISTAN_BOX, pakistanOutline, placeUV, rect, resample, stroke, wobble, type MapFit } from './kit'
import { GEO } from '@/data/geo/geo'
import { rng, sampleLines } from '@/scenes/shared/sampleLines'

/**
 * The land: rivers divided into light, canals, floods, dams rising, roads and corridors drawn
 * across the map, the map splitting, a front line and a ceasefire, contour lines, a seismograph.
 * All river and route courses are schematic (see SOURCES); no boundary is ever drawn in Kashmir.
 */
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

const RIVER_BOX = { x0: -24, x1: 24, z0: -18, z1: 27 }
const riverLine = (name: keyof typeof GEO.rivers, fit: MapFit): UV[] => GEO.rivers[name].line.map(([x, z]) => fit(x, z))

/** Smooth offset polygon around a polyline (for floods), width growing along it. */
function ribbon(line: UV[], w0: number, w1: number): UV[] {
  const left: UV[] = []
  const right: UV[] = []
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)]
    const b = line[Math.min(line.length - 1, i + 1)]
    let tu = b[0] - a[0]
    let tv = b[1] - a[1]
    const l = Math.hypot(tu, tv) || 1
    tu /= l
    tv /= l
    const w = w0 + (w1 - w0) * (i / (line.length - 1)) * (0.85 + 0.3 * Math.sin(i * 1.7))
    left.push([line[i][0] - tv * w, line[i][1] + tu * w])
    right.push([line[i][0] + tv * w, line[i][1] - tu * w])
  }
  return [...left, ...right.reverse()]
}

function house(cu: number, cv: number, s: number): UV[] {
  return [
    [cu - s, cv - s * 0.8],
    [cu + s, cv - s * 0.8],
    [cu + s, cv + s * 0.4],
    [cu, cv + s * 1.1],
    [cu - s, cv + s * 0.4],
    [cu - s, cv - s * 0.8],
  ]
}

/** RIVERS — divide (Indus Waters Treaty), canals (1960s development), flood (2010, 2022). */
export const rivers: MotifGenerator = (e) => {
  const mode = str(e.visualTreatment.params?.mode, 'divide')
  const fit = fitMap(RIVER_BOX, 2.6, 0.2, 8.2)
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = []
  const names = Object.keys(GEO.rivers) as (keyof typeof GEO.rivers)[]

  if (mode === 'divide') {
    names.forEach((n, i) => {
      const west = GEO.rivers[n].side === 'west'
      const win: [number, number] = west ? [0.0 + i * 0.06, 0.42 + i * 0.06] : [0.12 + i * 0.05, 0.55 + i * 0.05]
      // Light: the western rivers in brass, the eastern in sage; each with a soft under-glow.
      strokes.push(stroke(riverLine(n, fit), west ? 0.26 : 0.2, west ? BRASS : SAGE, win, { alpha: 0.22 }))
      strokes.push(stroke(riverLine(n, fit), west ? 0.085 : 0.07, west ? BRASS : OLIVE, win))
    })
    labels.push(label('WESTERN RIVERS · INDUS · JHELUM · CHENAB', [-0.9, 4.0], 0.16, [0.45, 0.65], { font: 'mono', color: BRASS }))
    labels.push(label('EASTERN RIVERS · RAVI · BEAS · SUTLEJ', [6.6, -3.9], 0.16, [0.55, 0.75], { font: 'mono', color: OLIVE, align: 'right' }))
    labels.push(label('SCHEMATIC COURSES', [6.6, -4.35], 0.11, [0.6, 0.8], { font: 'mono', color: TAUPE, align: 'right' }))
  } else {
    for (const n of names) strokes.push(stroke(riverLine(n, fit), 0.06, mode === 'flood' ? OLIVE : SAGE, [0.0, 0.3], { alpha: 0.75 }))
  }

  if (mode === 'canals') {
    // Irrigation: short canals branching from the rivers of the plains.
    const r = rng(9)
    const plains = names.flatMap((n) => riverLine(n, fit).filter(([, v]) => v < 1.2))
    for (let i = 0; i < 34; i++) {
      const [u, v] = plains[Math.floor(r() * plains.length)]
      const a = r() * Math.PI * 2
      const len = 0.5 + r() * 0.9
      const pts = resample([[u, v], [u + Math.cos(a) * len, v + Math.sin(a) * len]], 0.15)
      strokes.push(stroke(pts, 0.035, OLIVE, [0.3 + (i / 34) * 0.4, 0.42 + (i / 34) * 0.4], { alpha: 0.8 }))
    }
    const warsak = placeUV('Warsak', fit)
    strokes.push(stroke([[warsak[0] - 0.25, warsak[1]], [warsak[0] + 0.25, warsak[1]]], 0.12, INK, [0.6, 0.7]))
    labels.push(label('WARSAK', [warsak[0] - 0.35, warsak[1] + 0.3], 0.15, [0.62, 0.78], { font: 'mono', align: 'right' }))
    labels.push(label('INDUS BASIN', [6.4, -3.9], 0.16, [0.5, 0.7], { font: 'mono', color: OLIVE, align: 'right' }))
  }

  if (mode === 'flood') {
    // Water spreads down the Indus from the north, then (2022) homes are drawn again.
    const lower = riverLine('indus', fit).filter(([, v]) => v < 2.4)
    fills.push(fill(ribbon(lower, 0.12, 0.85), SAGE, [0.2, 0.62], { alpha: 0.5, rise: [0, -1] }))
    fills.push(fill(ribbon(lower, 0.05, 0.4), OLIVE, [0.3, 0.7], { alpha: 0.35, rise: [0, -1] }))
    if (e.visualTreatment.params?.rebuild) {
      const r = rng(22)
      for (let i = 0; i < 14; i++) {
        const [u, v] = lower[Math.floor(r() * lower.length)]
        const side = r() < 0.5 ? -1 : 1
        strokes.push(stroke(house(u + side * (0.9 + r() * 0.7), v + (r() - 0.5) * 0.4, 0.16), 0.035, INK, [0.7 + i * 0.018, 0.78 + i * 0.018]))
      }
      labels.push(label('REBUILDING', [6.4, -3.9], 0.16, [0.75, 0.92], { font: 'mono', color: BRASS, align: 'right' }))
    }
    labels.push(label('INDUS', [lower[Math.floor(lower.length * 0.4)][0] + 1.0, lower[Math.floor(lower.length * 0.4)][1]], 0.18, [0.35, 0.55], { font: 'italic', color: OLIVE }))
  }
  return { strokes, fills, labels }
}

/** DAM — an embankment rising across a valley; water gathers behind it once complete. */
export const dam: MotifGenerator = (e) => {
  const name = str(e.visualTreatment.params?.name, 'DAM')
  const complete = e.visualTreatment.params?.stage === 'complete'
  const cu = 2.6
  const base = -1.6
  const H = complete ? 3.2 : 1.8
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  // The valley in section.
  const valley = wobble(resample([[-1.0, 1.8], [0.4, 0.6], [1.6, base], [3.6, base], [4.8, 0.6], [6.4, 1.9]], 0.2), 0.04, 3)
  strokes.push(stroke(valley, 0.05, INK, [0.0, 0.2]))
  // Embankment (trapezoid) rising.
  const crest = 0.9
  const toe = 3.0
  const body: UV[] = [
    [cu - toe, base],
    [cu + toe, base],
    [cu + crest, base + H],
    [cu - crest, base + H],
  ]
  fills.push(fill(body, SAND, [0.15, complete ? 0.55 : 0.75], { alpha: 0.95 }))
  strokes.push(stroke(closed(body), 0.04, TAUPE, [0.2, complete ? 0.6 : 0.8]))
  // Courses of fill, like the layered build of an earth dam.
  for (let i = 1; i < 6; i++) {
    const y = base + (H * i) / 6
    const half = toe - (toe - crest) * (i / 6)
    strokes.push(stroke([[cu - half, y], [cu + half, y]], 0.02, TAUPE, [0.2 + i * 0.07, 0.3 + i * 0.07], { alpha: 0.7 }))
  }
  const labels: MotifLabel[] = [label(name, [cu, base - 0.6], 0.3, [0.35, 0.55], { font: 'display', align: 'center', tracking: 0.2 })]
  if (complete) {
    // Water behind the dam (upstream side, left in section) and power lines leaving it.
    fills.push(fill([[-0.4, 1.4], [cu - crest - 0.05, base + H - 0.25], [cu - toe + 0.05, base + 0.05], [1.7, base + 0.05], [0.5, 0.6]], SAGE, [0.55, 0.85], { alpha: 0.55 }))
    for (let k = 0; k < 3; k++) {
      const y = base + H + 0.6 + k * 0.25
      const pts = resample([[cu + crest, base + H - 0.2], [cu + 2, y], [6.4, y + 0.2]], 0.2)
      strokes.push(stroke(pts, 0.025, INK, [0.65 + k * 0.06, 0.85 + k * 0.05], { alpha: 0.7 }))
    }
    labels.push(label('WATER · POWER', [6.4, base + H + 1.45], 0.14, [0.75, 0.92], { font: 'mono', color: BRASS, align: 'right' }))
  } else {
    // Construction: a crane and scaffold lines above the unfinished crest.
    strokes.push(stroke([[cu + 1.8, base], [cu + 1.8, base + 3.6], [cu - 0.8, base + 3.6]], 0.04, INK, [0.45, 0.65]))
    strokes.push(stroke([[cu - 0.6, base + 3.6], [cu - 0.6, base + 2.6]], 0.02, INK, [0.62, 0.7], { alpha: 0.7 }))
    for (let k = 0; k < 4; k++) strokes.push(stroke([[cu - crest - 0.6 + k * 0.7, base + H], [cu - crest - 0.6 + k * 0.7, base + H + 0.9]], 0.02, INK, [0.5 + k * 0.04, 0.62 + k * 0.04], { alpha: 0.55 }))
    labels.push(label('UNDER CONSTRUCTION', [6.4, base + 3.9], 0.14, [0.6, 0.8], { font: 'mono', color: BRASS, align: 'right' }))
  }
  return { strokes, fills, labels }
}

/** Faint mountain hachures around the Karakoram (shape only, no boundary). */
function hachures(fit: MapFit, win: [number, number]): MotifStroke[] {
  const r = rng(36)
  const out: MotifStroke[] = []
  const anchors: [number, number][] = [
    [74.5, 36.2], [75.2, 36.6], [74.0, 35.9], [75.8, 36.0], [73.6, 36.3], [76.2, 35.6], [74.9, 35.3], [73.3, 35.6],
  ]
  // Anchor lon/lat → nearest place on the KKH route (avoids runtime projection): sample the route.
  const route = GEO.routes.kkh
  anchors.forEach((_, i) => {
    const [x, z] = route[Math.min(route.length - 1, Math.floor((i / anchors.length) * route.length))]
    const [u, v] = fit(x + (r() - 0.5) * 3, z + (r() - 0.5) * 2)
    out.push(stroke([[u - 0.18, v - 0.08], [u, v + 0.12], [u + 0.18, v - 0.08]], 0.025, TAUPE, win, { alpha: 0.7 }))
  })
  return out
}

const ROUTE_BOXES: Record<string, { box: { x0: number; x1: number; z0: number; z1: number }; h: number }> = {
  kkh: { box: { x0: -12, x1: 9, z0: -21, z1: -3 }, h: 7.6 },
  fiber: { box: { x0: -12, x1: 9, z0: -21, z1: -3 }, h: 7.6 },
  m2: { box: { x0: -8, x1: 4, z0: -10, z1: 3 }, h: 7.6 },
  m4: { box: { x0: -11, x1: 1, z0: -3, z1: 8 }, h: 7.2 },
  cpec: { box: PAKISTAN_BOX, h: 8.6 },
}

const ROUTE_ENDS: Record<string, [string, string]> = {
  kkh: ['Hasan Abdal', 'Khunjerab Pass'],
  fiber: ['Rawalpindi', 'Khunjerab Pass'],
  m2: ['Lahore', 'Islamabad'],
  m4: ['Faisalabad', 'Khanewal'],
  cpec: ['Kashgar', 'Gwadar'],
}

/** ROUTE — a road, a corridor or a cable drawn across the map; or a metro line. */
export const route: MotifGenerator = (e) => {
  const which = str(e.visualTreatment.params?.route, 'm2')
  if (which === 'orange-line') return orangeLine()
  const spec = ROUTE_BOXES[which] ?? ROUTE_BOXES.cpec
  const fit = fitMap(spec.box, 2.6, 0.0, spec.h)
  const line = (GEO.routes[which as keyof typeof GEO.routes] ?? GEO.routes.m2).map(([x, z]) => fit(x, z))
  const strokes: MotifStroke[] = [...pakistanOutline(fit, [0.0, 0.25], 0.4)]
  // Neighbouring roads (faint context): the M-2 on Punjab maps.
  if (which === 'm4') strokes.push(stroke(GEO.routes.m2.map(([x, z]) => fit(x, z)), 0.035, TAUPE, [0.1, 0.3], { alpha: 0.6 }))
  if (which === 'kkh' || which === 'fiber') strokes.push(...hachures(fit, [0.05, 0.3]))
  const fiber = which === 'fiber'
  strokes.push(stroke(line, fiber ? 0.06 : 0.12, fiber ? OLIVE : BRASS, [0.2, 0.62], { taper: false }))
  const [a, b] = ROUTE_ENDS[which] ?? ROUTE_ENDS.m2
  const pa = placeUV(a, fit)
  const pb = placeUV(b, fit)
  const fills: MotifFill[] = [
    fill(ellipse(pa[0], pa[1], 0.14, 0.14, 20), INK, [0.15, 0.25]),
    fill(ellipse(pb[0], pb[1], 0.14, 0.14, 20), INK, [0.6, 0.7]),
  ]
  const labels: MotifLabel[] = [
    label(a.toUpperCase(), [pa[0] + 0.3, pa[1] - 0.05], 0.17, [0.15, 0.35], { font: 'mono' }),
    label(b.toUpperCase(), [pb[0] + 0.3, pb[1] + 0.05], 0.17, [0.6, 0.78], { font: 'mono' }),
    ...neighbourLabels(fit, [0.05, 0.3]),
  ]
  if (which === 'cpec') {
    const isl = placeUV('Islamabad', fit)
    fills.push(fill(ellipse(isl[0], isl[1], 0.11, 0.11, 16), INK, [0.4, 0.5]))
    labels.push(label('ISLAMABAD', [isl[0] + 0.25, isl[1]], 0.15, [0.42, 0.6], { font: 'mono' }))
    labels.push(label('ROUTE SCHEMATIC', [6.4, -4.3], 0.11, [0.6, 0.8], { font: 'mono', color: TAUPE, align: 'right' }))
  }
  const out = { strokes, fills, labels, dots: [] as MotifDots[] }
  if (fiber) {
    // Light travelling along the cable: points along the line lit in sequence, south → north.
    const along = resample(line, 0.12).filter((_, i) => i % 3 === 0)
    out.dots.push({ from: along, to: along, delay: along.map((_, i) => i / along.length), window: [0.4, 0.95], size: 6, color: BRASS, glow: true })
  }
  return out
}

function orangeLine() {
  // Schematic: Lahore's Orange Line — 26 stations from Ali Town to Dera Gujran.
  const pts = resample(wobble(resample([[-0.4, -2.6], [1.2, -1.2], [2.4, -0.2], [3.4, 1.0], [4.6, 1.9], [6.2, 2.9]], 0.4), 0.06, 4), 0.1)
  const strokes: MotifStroke[] = [stroke(pts, 0.14, BRASS, [0.05, 0.55])]
  const fills: MotifFill[] = []
  const n = 26
  for (let i = 0; i < n; i++) {
    const p = pts[Math.round((i / (n - 1)) * (pts.length - 1))]
    fills.push(fill(ellipse(p[0], p[1], 0.09, 0.09, 12), i === 0 || i === n - 1 ? INK : PARCH, [0.1 + (i / n) * 0.5, 0.14 + (i / n) * 0.5]))
    strokes.push(stroke(ellipse(p[0], p[1], 0.09, 0.09, 12), 0.025, INK, [0.1 + (i / n) * 0.5, 0.14 + (i / n) * 0.5]))
  }
  return {
    strokes,
    fills,
    labels: [
      label('ALI TOWN', [pts[0][0] + 0.25, pts[0][1] - 0.2], 0.16, [0.1, 0.3], { font: 'mono' }),
      label('DERA GUJRAN', [pts[pts.length - 1][0] - 0.2, pts[pts.length - 1][1] + 0.35], 0.16, [0.6, 0.8], { font: 'mono', align: 'right' }),
      label('26 STATIONS', [6.4, -3.9], 0.16, [0.65, 0.85], { font: 'mono', color: BRASS, align: 'right' }),
      label('LAHORE', [-0.4, 3.0], 0.34, [0.0, 0.2], { font: 'display', tracking: 0.2 }),
    ],
  }
}

/** NETWORK — the corridor as a system: roads, power, fibre, the port at Gwadar. */
export const network: MotifGenerator = (e) => {
  const complete = e.visualTreatment.params?.mode === 'complete'
  const fit = fitMap(PAKISTAN_BOX, 2.6, 0.0, 8.6)
  const strokes: MotifStroke[] = [...pakistanOutline(fit, [0.0, 0.2], 0.4)]
  strokes.push(stroke(GEO.routes.cpec.map(([x, z]) => fit(x, z)), 0.1, BRASS, [0.1, 0.4]))
  strokes.push(stroke(GEO.routes.m2.map(([x, z]) => fit(x, z)), 0.07, BRASS, [0.3, 0.45], { alpha: 0.8 }))
  const east = ['Lahore', 'Multan', 'Sukkur', 'Hyderabad', 'Karachi'].map((n) => placeUV(n, fit))
  strokes.push(stroke(resample(east, 0.2), 0.07, BRASS, [0.35, 0.6], { alpha: 0.8 }))
  strokes.push(stroke(GEO.routes.fiber.map(([x, z]) => fit(x, z)), 0.035, OLIVE, [0.45, 0.62]))
  const gw = placeUV('Gwadar', fit)
  strokes.push(stroke(ellipse(gw[0], gw[1] - 0.05, 0.42, 0.42, 24, Math.PI, Math.PI * 2), 0.06, INK, [0.55, 0.68]))
  const fills: MotifFill[] = []
  const power: UV[] = [placeUV('Karachi', fit), placeUV('Sukkur', fit), [placeUV('Multan', fit)[0] + 0.5, placeUV('Multan', fit)[1] + 0.3], placeUV('Faisalabad', fit)]
  power.forEach(([u, v], i) => fills.push(fill(rect(u + 0.28, v + 0.22, 0.2, 0.2), INK, [0.5 + i * 0.05, 0.58 + i * 0.05])))
  const labels: MotifLabel[] = [
    label('GWADAR', [gw[0] + 0.45, gw[1] - 0.45], 0.16, [0.58, 0.75], { font: 'mono' }),
    label('ROADS · POWER · FIBRE · PORT', [6.4, -4.2], 0.15, [0.6, 0.8], { font: 'mono', color: BRASS, align: 'right' }),
    ...neighbourLabels(fit, [0.05, 0.25]),
  ]
  const out: { strokes: MotifStroke[]; fills: MotifFill[]; labels: MotifLabel[]; dots?: MotifDots[] } = { strokes, fills, labels }
  if (complete) {
    const nodes: UV[] = [...east, gw, placeUV('Islamabad', fit), placeUV('Khunjerab Pass', fit), placeUV('Quetta', fit)]
    out.dots = [{ from: nodes, to: nodes, delay: nodes.map((_, i) => i / nodes.length), window: [0.55, 0.95], size: 9, color: BRASS, glow: true }]
    labels.push(label('THE FIRST DECADE', [-0.6, 4.1], 0.2, [0.65, 0.85], { font: 'display', tracking: 0.12 }))
  }
  return out
}

/** SPLIT — 1971: the two wings drawn as one state; the eastern wing drifts away and is named anew. */
export const split: MotifGenerator = () => {
  // Both wings, 1,600 km apart, framed together; the eastern wing then drifts away and is renamed.
  const box = { x0: -40, x1: 58, z0: -20, z1: 33 }
  const fit = fitMap(box, 2.3, 0.9, 4.1)
  const west = mapLines(GEO.wings.west, fit)
  const east = mapLines(GEO.wings.east, fit)
  const strokes: MotifStroke[] = [
    ...west.map((l) => stroke(l, 0.05, INK, [0.0, 0.3])),
    ...east.map((l) => stroke(l, 0.035, INK, [0.08, 0.35], { alpha: 0.3 })),
    // The distance between the wings, as a faint dashed measure.
    stroke(resample([fit(6, 10), fit(38, 18)], 0.2), 0.02, TAUPE, [0.2, 0.4], { dash: 0.18, alpha: 0.7 }),
  ]
  const r = rng(71)
  const pts = sampleLines(GEO.wings.east, 220, r).map((s) => fit(s.x, s.z))
  const dx = 0.7
  const dv = -0.9
  const labels: MotifLabel[] = [
    label('PAKISTAN', [fit(-17, 6)[0], fit(-17, 6)[1] - 1.9], 0.24, [0.25, 0.45], { font: 'display', align: 'center', tracking: 0.2 }),
    label('BANGLADESH', [fit(48, 22)[0] + dx, fit(48, 22)[1] + dv - 1.25], 0.24, [0.75, 0.95], { font: 'display', align: 'center', tracking: 0.2, color: OLIVE }),
  ]
  return {
    strokes,
    labels,
    dots: [{ from: pts, to: pts.map(([u, v]) => [u + dx, v + dv] as UV), delay: pts.map(() => r() * 0.2), window: [0.4, 0.95], size: 3.6, color: INK }],
  }
}

/**
 * FRONTLINE — the Punjab boundary drawn hard, a line of pressure, then a ceasefire (1965, 2025).
 * params.ceasefire replaces the 1965 date; params.steps adds a short dated sequence above the map.
 */
export const frontline: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const steps = Array.isArray(p.steps) ? p.steps : []
  const fit = fitMap({ x0: -9, x1: 7, z0: -9, z1: 8 }, 2.6, 0.2, 8.0)
  const border = GEO.pakistanWing.india.map((l) => l.map(([x, z]) => fit(x, z)))
  const strokes: MotifStroke[] = border.map((l) => stroke(l, 0.07, INK, [0.05, 0.45]))
  // Hatching along the line: tension on both sides, no arrows, no victors.
  for (const l of border) {
    const pts = resample(l, 0.45)
    pts.forEach(([u, v], i) => {
      if (i === 0 || i === pts.length - 1 || v < -4.2 || v > 4.4) return
      const [pu, pv] = pts[i - 1]
      const tu = u - pu
      const tv = v - pv
      const len = Math.hypot(tu, tv) || 1
      const s = i % 2 ? 1 : -1
      strokes.push(stroke([[u, v], [u - (tv / len) * 0.35 * s, v + (tu / len) * 0.35 * s]], 0.025, TAUPE, [0.35 + (i / pts.length) * 0.3, 0.45 + (i / pts.length) * 0.3]))
    })
  }
  const labels: MotifLabel[] = []
  const fills: MotifFill[] = []
  for (const n of ['Lahore', 'Sialkot']) {
    const p = placeUV(n, fit)
    fills.push(fill(ellipse(p[0], p[1], 0.13, 0.13, 16), INK, [0.2, 0.3]))
    labels.push(label(n.toUpperCase(), [p[0] - 0.3, p[1] + 0.05], 0.16, [0.2, 0.4], { font: 'mono', align: 'right' }))
  }
  labels.push(label(str(p.ceasefire, 'CEASEFIRE · 23 SEPTEMBER 1965'), [6.4, -4.0], 0.17, [0.7, 0.9], { font: 'mono', color: BRASS, align: 'right' }))
  strokes.push(stroke([[3.4, -3.6], [6.4, -3.6]], 0.03, BRASS, [0.72, 0.85]))
  if (steps.length) {
    // The days, ruled across the top of the sheet: each date ticks in as the frame develops.
    const u0 = 1.6
    const u1 = 6.4
    const v = 4.15
    strokes.push(stroke([[u0, v], [u1, v]], 0.025, TAUPE, [0.08, 0.3]))
    steps.forEach((s, i) => {
      const u = u0 + ((u1 - u0) * i) / Math.max(1, steps.length - 1)
      const last = i === steps.length - 1
      const win: [number, number] = [0.15 + i * 0.22, 0.3 + i * 0.22]
      fills.push(fill(ellipse(u, v, 0.1, 0.1, 16), last ? BRASS : INK, win))
      labels.push(label(s, [u, v - 0.4], 0.15, win, { font: 'mono', align: i === 0 ? 'left' : last ? 'right' : 'center', color: last ? BRASS : INK }))
    })
  }
  return { strokes, fills, labels }
}

/**
 * CONSTELLATION — the SCO as a schematic of its member states (not a map): Pakistan, in the chair
 * of the Regional Anti-Terrorist Structure, draws a line to each; pulses travel along them.
 */
const SCO_NODES: [string, UV][] = [
  ['BELARUS', [1.4, 3.2]],
  ['RUSSIA', [4.1, 3.5]],
  ['KAZAKHSTAN', [3.1, 2.3]],
  ['UZBEKISTAN', [1.8, 1.4]],
  ['KYRGYZSTAN', [3.9, 1.2]],
  ['TAJIKISTAN', [2.8, 0.2]],
  ['CHINA', [5.8, 0.5]],
  ['IRAN', [0.5, -0.6]],
  ['INDIA', [4.6, -2.7]],
]

export const constellation: MotifGenerator = () => {
  const pk: UV = [2.2, -1.6]
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = []
  SCO_NODES.forEach(([name, at], i) => {
    const win: [number, number] = [0.14 + i * 0.035, 0.36 + i * 0.035]
    strokes.push(stroke(resample([pk, at], 0.2), 0.03, OLIVE, win, { alpha: 0.75 }))
    fills.push(fill(ellipse(at[0], at[1], 0.11, 0.11, 16), INK, [win[0] - 0.08, win[0]]))
    labels.push(label(name, [at[0], at[1] + 0.32], 0.13, [win[0] - 0.06, win[0] + 0.1], { font: 'mono', align: at[0] > 5.4 ? 'right' : 'center' }))
  })
  // Pakistan in the chair: a filled node and a brass ring.
  fills.push(fill(ellipse(pk[0], pk[1], 0.16, 0.16, 20), BRASS, [0.04, 0.12]))
  strokes.push(stroke(ellipse(pk[0], pk[1], 0.42, 0.42, 48), 0.05, BRASS, [0.42, 0.56]))
  labels.push(label('PAKISTAN', [pk[0], pk[1] - 0.72], 0.24, [0.05, 0.2], { font: 'display', align: 'center', tracking: 0.14 }))
  labels.push(label('CHAIR · SCO-RATS · 2025–26', [pk[0], pk[1] - 1.18], 0.13, [0.45, 0.62], { font: 'mono', align: 'center', color: BRASS }))
  labels.push(label('SCHEMATIC · NOT A MAP', [0.6, 4.2], 0.11, [0.05, 0.25], { font: 'mono', color: TAUPE }))
  // Cooperation travelling out from the chair to every member, then settling.
  const to = SCO_NODES.map(([, at]) => at)
  return {
    strokes,
    fills,
    labels,
    dots: [{ from: to.map(() => pk), to, delay: to.map((_, i) => i / to.length), window: [0.45, 0.9], size: 8, color: BRASS, glow: true }],
  }
}

/** CONTOURS — Chagai: the contour lines of a mountain, then one quiet ring of light. */
export const contours: MotifGenerator = () => {
  const c: UV = [2.6, 0.3]
  const r = rng(98)
  const strokes: MotifStroke[] = []
  for (let k = 0; k < 8; k++) {
    const rad = 0.45 + k * 0.42
    const pts: UV[] = []
    const ph = r() * 6
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const wob = 1 + 0.12 * Math.sin(a * 3 + ph) + 0.06 * Math.sin(a * 7 + ph * 2)
      pts.push([c[0] + Math.cos(a) * rad * wob * 1.35, c[1] + Math.sin(a) * rad * wob])
    }
    strokes.push(stroke(pts, k % 4 === 0 ? 0.04 : 0.025, INK, [0.02 + k * 0.05, 0.2 + k * 0.05], { alpha: k % 4 === 0 ? 0.8 : 0.55 }))
  }
  const ring: UV[] = []
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2
    ring.push([c[0] + Math.cos(a) * 0.3, c[1] + Math.sin(a) * 0.22])
  }
  return {
    strokes,
    labels: [
      label('RAS KOH HILLS · CHAGAI', [6.4, 3.9], 0.16, [0.3, 0.5], { font: 'mono', align: 'right' }),
      label('28 MAY 1998', [6.4, 3.35], 0.24, [0.6, 0.8], { font: 'display', align: 'right', color: OLIVE }),
    ],
    dots: [{ from: ring, to: ring.map(([u, v]) => [c[0] + (u - c[0]) * 13, c[1] + (v - c[1]) * 13] as UV), window: [0.5, 1.0], size: 4, color: BRASS }],
  }
}

/** SEISMIC — 2005: a seismograph trace, then homes drawn again, one by one. */
export const seismic: MotifGenerator = () => {
  const trace: UV[] = []
  const r = rng(2005)
  for (let i = 0; i <= 240; i++) {
    const u = -0.8 + (7.2 * i) / 240
    const k = Math.exp(-(((u - 1.6) / 0.9) ** 2)) * 1.1 + Math.exp(-(((u - 2.6) / 1.6) ** 2)) * 0.35
    trace.push([u, 2.3 + (r() - 0.5) * 0.06 + Math.sin(i * 1.9) * k + (r() - 0.5) * k * 0.6])
  }
  const strokes: MotifStroke[] = [stroke(trace, 0.035, INK, [0.0, 0.4]), stroke([[-0.8, 1.2], [6.4, 1.2]], 0.015, TAUPE, [0.0, 0.2])]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const i = row * 6 + col
      strokes.push(stroke(house(0.2 + col * 1.15, -0.4 - row * 1.15, 0.33), 0.035, INK, [0.45 + i * 0.025, 0.55 + i * 0.025]))
    }
  }
  return {
    strokes,
    labels: [
      label('8 OCTOBER 2005', [-0.8, 3.7], 0.18, [0.1, 0.3], { font: 'mono' }),
      label('RELIEF · RECONSTRUCTION', [6.4, -4.1], 0.16, [0.7, 0.9], { font: 'mono', color: BRASS, align: 'right' }),
    ],
  }
}

