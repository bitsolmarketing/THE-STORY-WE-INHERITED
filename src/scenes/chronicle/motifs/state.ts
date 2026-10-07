import type { MotifGenerator, MotifOutput, MotifStroke, MotifLabel, MotifFill, UV } from './types'
import { BRASS, INK, OLIVE, PARCH, TAUPE, closed, ellipse, fill, fitMap, flourish, label, PAKISTAN_BOX, pakistanOutline, rect, resample, stroke, textLines, wobble } from './kit'
import { filmPrintsFor } from '../filmPrints'
import { printSlots } from '../plateFrame'
import { GEO } from '@/data/geo/geo'
import { rng } from '@/scenes/shared/sampleLines'

/**
 * State and people of state: the portrait plane, documents and signatures, pages assembling into
 * a constitution, nameplates changing, a ballot, and dialogue converging on Islamabad.
 * Photographs lie on the left of every frame (plateFrame.printSlots); motifs use the centre-right.
 */
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

/** PORTRAIT PLANE — a frame on the table. A real portrait lies in it only when the archive holds one. */
export const portrait: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const oval = p.frame === 'oval'
  // When the archive holds a portrait, the frame is drawn around that photograph (the hero slot);
  // otherwise the frame stays empty on its own: an absence.
  const hero = filmPrintsFor(e, 1)[0]
  const hasPrint = Boolean(hero)
  const slot = printSlots(e, 1)[0]
  const cu = hasPrint ? slot.at[0] : 1.4
  const cv = hasPrint ? slot.at[1] : 0.6
  const w = hasPrint ? slot.width + 0.25 : 3.6
  const h = hasPrint ? slot.width * ((hero.height ?? 3) / (hero.width ?? 4)) + 0.25 : 4.6
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  if (oval) {
    fills.push(fill(ellipse(cu, cv, w / 2, h / 2, 64), PARCH, [0.0, 0.35], { alpha: 0.85 }))
    strokes.push(stroke(ellipse(cu, cv, w / 2, h / 2, 96, Math.PI / 2, Math.PI / 2 + Math.PI * 2), 0.07, BRASS, [0.02, 0.4]))
    strokes.push(stroke(ellipse(cu, cv, w / 2 + 0.22, h / 2 + 0.22, 96, Math.PI / 2, Math.PI / 2 + Math.PI * 2), 0.03, BRASS, [0.08, 0.46], { alpha: 0.7 }))
  } else {
    if (!hasPrint) fills.push(fill(rect(cu, cv, w, h), PARCH, [0.0, 0.35], { alpha: 0.85 }))
    strokes.push(stroke(closed(rect(cu, cv, w + 0.2, h + 0.2)), 0.07, BRASS, [0.02, 0.4]))
    strokes.push(stroke(closed(rect(cu, cv, w + 0.62, h + 0.62)), 0.03, BRASS, [0.08, 0.46], { alpha: 0.7 }))
  }
  if (p.mourning) {
    // A black mourning band across the frame's upper corner.
    const corner: UV = [cu + w / 2 + 0.3, cv + h / 2 + 0.3]
    strokes.push(stroke([[corner[0] - 1.5, corner[1] + 0.05], [corner[0] + 0.05, corner[1] - 1.5]], 0.32, INK, [0.42, 0.6], { alpha: 0.88 }))
  }
  // Name and dates set to the right of the frame (clear of the photographs).
  const nameAt: UV = hasPrint ? [cu + w / 2 + 1.1, cv + 0.3] : [cu, cv - h / 2 - 0.85]
  const labels: MotifLabel[] = [
    label(str(p.name), nameAt, 0.44, [0.3, 0.6], { font: 'display', align: hasPrint ? 'left' : 'center' }),
    label(str(p.dates), [nameAt[0], nameAt[1] - 0.62], 0.19, [0.4, 0.68], { font: 'mono', align: hasPrint ? 'left' : 'center', color: BRASS }),
  ]
  const out: MotifOutput = { strokes, fills, labels }
  if (p.network) {
    // Edhi's ambulance network: a small Pakistan with stations lighting up across it.
    const fit = fitMap(PAKISTAN_BOX, 4.9, -0.6, 5.4)
    out.strokes.push(...pakistanOutline(fit, [0.25, 0.55], 0.35))
    const r = rng(16)
    const from: UV[] = []
    for (let i = 0; i < 70; i++) {
      const ring = GEO.places[Math.floor(r() * 21)]
      from.push(fit(ring.x + (r() - 0.5) * 7, ring.z + (r() - 0.5) * 7))
    }
    out.dots = [{ from, to: from, delay: from.map((_, i) => i / from.length), window: [0.35, 0.95], size: 7, color: BRASS, glow: true }]
  }
  return out
}

/** DOCUMENT — a page being written: heading, ruled lines, a seal, signatures. */
export const documentMotif: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const cu = 2.4
  const cv = 0.3
  const w = 4.4
  const h = 5.8
  const sigs = typeof p.signatures === 'number' ? p.signatures : 0
  const strokes: MotifStroke[] = [stroke(closed(rect(cu, cv, w, h)), 0.04, INK, [0.0, 0.18], { alpha: 0.7 })]
  strokes.push(...textLines(cu, cv + h / 2 - 1.35, w - 0.9, sigs ? 7 : 9, 0.36, [0.16, 0.5], 4))
  if (p.seal) strokes.push(stroke(ellipse(cu + w / 2 - 0.85, cv - h / 2 + 0.85, 0.42, 0.42, 40), 0.06, OLIVE, [0.5, 0.62]), stroke(ellipse(cu + w / 2 - 0.85, cv - h / 2 + 0.85, 0.3, 0.3, 32), 0.025, OLIVE, [0.55, 0.65]))
  for (let i = 0; i < sigs; i++) {
    const su = cu - w / 4 + (i * w) / 2
    strokes.push(stroke([[su - 0.85, cv - h / 2 + 0.75], [su + 0.85, cv - h / 2 + 0.75]], 0.02, INK, [0.48, 0.52], { alpha: 0.5 }))
    strokes.push(stroke(flourish(su, cv - h / 2 + 1.05, 1.6, 30 + i), 0.04, INK, [0.52 + i * 0.12, 0.66 + i * 0.12], { taper: true }))
  }
  return {
    strokes,
    fills: [fill(rect(cu, cv, w, h), PARCH, [0.0, 0.2], { alpha: 0.75, rise: [0, -1] })],
    labels: [label(str(p.heading), [cu, cv + h / 2 - 0.7], 0.26, [0.12, 0.3], { font: 'display', align: 'center', tracking: 0.12 })],
  }
}

/** CONSTITUTION — pages assembling into a bound volume (1956, 1962, 1973; restored 1985; amended 2010). */
export const constitution: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const edition = str(p.edition, '1973')
  const hasPrint = filmPrintsFor(e, 1).length > 0
  const cu = hasPrint ? 2.0 : 1.2
  const cv = 0.2
  const w = 3.8
  const h = 5.0
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = []
  const pages = 6
  for (let i = 0; i < pages; i++) {
    const k = pages - 1 - i
    const off: UV = [k * 0.14, -k * 0.1]
    const a = 0.02 + i * 0.06
    fills.push(fill(rect(cu + off[0], cv + off[1], w, h), i === pages - 1 ? '#efe6d4' : PARCH, [a, a + 0.08], { alpha: 0.95, rise: [0, -1] }))
    strokes.push(stroke(closed(rect(cu + off[0], cv + off[1], w, h)), 0.025, INK, [a, a + 0.09], { alpha: 0.45 }))
  }
  // Cover: binding along the left edge, a frame, the title.
  strokes.push(stroke([[cu - w / 2 + 0.3, cv - h / 2], [cu - w / 2 + 0.3, cv + h / 2]], 0.09, OLIVE, [0.42, 0.62]))
  strokes.push(stroke(closed(rect(cu + 0.15, cv, w - 0.8, h - 0.8)), 0.035, BRASS, [0.46, 0.66]))
  labels.push(label('CONSTITUTION', [cu + 0.15, cv + 0.75], 0.27, [0.5, 0.68], { font: 'display', align: 'center', tracking: 0.14 }))
  labels.push(label(p.reopen ? '1973 · RESTORED' : edition, [cu + 0.15, cv + 0.05], 0.36, [0.55, 0.72], { font: 'display', align: 'center', color: OLIVE }))
  if (p.bound) strokes.push(...[-0.9, -0.55].map((dv, i) => stroke([[cu - 0.9, cv + dv], [cu + 1.2, cv + dv]], 0.025, BRASS, [0.6 + i * 0.04, 0.72 + i * 0.04])))
  if (p.reopen) {
    // The volume is opened again: a spread of two written pages beside it.
    const su = cu + w / 2 + 2.3
    fills.push(fill(rect(su - 1.05, cv - 0.3, 2.0, 2.9), PARCH, [0.55, 0.7], { alpha: 0.9, rise: [1, 0] }), fill(rect(su + 1.05, cv - 0.3, 2.0, 2.9), PARCH, [0.6, 0.75], { alpha: 0.9, rise: [-1, 0] }))
    strokes.push(stroke([[su, cv - 1.75], [su, cv + 1.15]], 0.04, INK, [0.6, 0.72]))
    strokes.push(...textLines(su - 1.05, cv + 0.8, 1.5, 6, 0.32, [0.66, 0.86], 7), ...textLines(su + 1.05, cv + 0.8, 1.5, 6, 0.32, [0.7, 0.9], 8))
  }
  if (typeof p.amendment === 'number') {
    // An inserted leaf and four lines out to the provinces (devolution).
    labels.push(label(String(p.amendment) + 'TH AMENDMENT', [cu + 0.15, cv - 0.75], 0.17, [0.58, 0.74], { font: 'mono', align: 'center', color: BRASS }))
    const provinces = ['PUNJAB', 'SINDH', 'KHYBER PAKHTUNKHWA', 'BALOCHISTAN']
    provinces.forEach((name, i) => {
      const end: UV = [cu + w / 2 + 0.9 + (i % 2) * 0.25, cv + 2.0 - i * 1.3]
      strokes.push(stroke(resample([[cu + w / 2 + 0.3, cv + 0.5 - i * 0.35], end], 0.2), 0.035, OLIVE, [0.62 + i * 0.05, 0.78 + i * 0.05]))
      labels.push(label(name, [end[0] + 0.15, end[1]], 0.15, [0.7 + i * 0.05, 0.85 + i * 0.05], { font: 'mono' }))
    })
  }
  return { strokes, fills, labels }
}

/** NAMEPLATE — a brass desk plate; the old name is struck through, the new one is set. */
export const nameplate: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const office = str(p.office)
  const from = str(p.from)
  const to = str(p.to)
  const cu = 2.6
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = [label(office, [cu, 2.7], 0.17, [0.0, 0.2], { font: 'mono', align: 'center', color: INK })]
  const plate = (cv: number, win: [number, number], tone: string) => {
    fills.push(fill(rect(cu, cv, 7.0, 1.35), tone, win, { alpha: 0.95, rise: [1, 0] }))
    strokes.push(stroke(closed(rect(cu, cv, 7.0, 1.35)), 0.03, INK, [win[0], win[1] + 0.05], { alpha: 0.6 }))
    strokes.push(stroke(closed(rect(cu, cv, 6.7, 1.08)), 0.018, INK, [win[0] + 0.03, win[1] + 0.08], { alpha: 0.4 }))
  }
  if (from) {
    // Brass-and-parchment mixes (palette only).
  plate(1.35, [0.02, 0.18], '#c8b490')
    labels.push(label(from, [cu, 1.35], 0.33, [0.1, 0.26], { font: 'display', align: 'center', tracking: 0.08 }))
    strokes.push(stroke(wobble(resample([[cu - 3.2, 1.42], [cu + 3.2, 1.28]], 0.25), 0.03, 11), 0.07, INK, [0.32, 0.44], { taper: true }))
  }
  if (to) {
    plate(-0.6, [from ? 0.44 : 0.04, from ? 0.6 : 0.24], '#cec29c')
    labels.push(label(to, [cu, -0.6], 0.35, [from ? 0.52 : 0.14, from ? 0.7 : 0.36], { font: 'display', align: 'center', tracking: 0.08 }))
  } else {
    // Resignation: the plate is left blank.
    plate(-0.6, [0.48, 0.62], '#e3d6bb')
    labels.push(label('—', [cu, -0.6], 0.36, [0.6, 0.74], { font: 'display', align: 'center', color: TAUPE }))
  }
  return { strokes, fills, labels }
}

/** BALLOT — people converge on a ballot box: the first election on adult franchise. */
export const ballot: MotifGenerator = () => {
  const box: UV = [2.6, 0.2]
  const r = rng(70)
  const from: UV[] = []
  const to: UV[] = []
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2
    const d = 3.0 + r() * 2.4
    from.push([box[0] + Math.cos(a) * d * 1.2, box[1] + Math.sin(a) * d * 0.8])
    const q = 0.95 + r() * 0.9
    to.push([box[0] + Math.cos(a) * q * 1.2, box[1] + Math.sin(a) * q * 0.9])
  }
  return {
    strokes: [
      stroke(closed(rect(box[0], box[1], 1.6, 1.3)), 0.06, INK, [0.0, 0.2]),
      stroke([[box[0] - 0.45, box[1] + 0.25], [box[0] + 0.45, box[1] + 0.25]], 0.09, INK, [0.2, 0.28]),
      stroke([[box[0] + 0.05, box[1] + 1.25], [box[0] + 0.05, box[1] + 0.35]], 0.03, BRASS, [0.45, 0.6]),
    ],
    fills: [fill(rect(box[0] + 0.05, box[1] + 1.4, 0.5, 0.36), PARCH, [0.4, 0.5], { alpha: 0.95 })],
    labels: [label('ADULT FRANCHISE', [box[0], box[1] - 1.35], 0.18, [0.3, 0.5], { font: 'mono', align: 'center', color: BRASS })],
    dots: [{ from, to, delay: from.map(() => r()), window: [0.05, 0.85], size: 5.5, color: INK }],
  }
}

/**
 * COUNCIL — the Security Council's horseshoe table: fifteen seats take their places, the
 * presiding seat is ringed, and every seat lights for a unanimous vote.
 */
export const council: MotifGenerator = () => {
  const c: UV = [2.7, 0.7]
  const arc = (r: number) => ellipse(c[0], c[1], r * 1.25, r, 72, -0.2 * Math.PI, 1.2 * Math.PI)
  const outer = arc(2.5)
  const inner = arc(1.75)
  const strokes: MotifStroke[] = [stroke(outer, 0.05, INK, [0.0, 0.3]), stroke(inner, 0.035, INK, [0.05, 0.33], { alpha: 0.7 })]
  const fills: MotifFill[] = [fill([...outer, ...[...inner].reverse()], PARCH, [0.05, 0.3], { alpha: 0.9 })]
  // Fifteen seats along the table; the presiding chair sits at the head (the top of the arc).
  const seats: UV[] = []
  for (let i = 0; i < 15; i++) {
    const a = -0.14 * Math.PI + (1.28 * Math.PI * i) / 14
    seats.push([c[0] + Math.cos(a) * 2.13 * 1.25, c[1] + Math.sin(a) * 2.13])
  }
  const head = seats[7]
  strokes.push(stroke(ellipse(head[0], head[1], 0.34, 0.3, 40), 0.05, BRASS, [0.36, 0.48]))
  return {
    strokes,
    fills,
    labels: [
      label('UNITED NATIONS SECURITY COUNCIL · EIGHTH TERM, 2025–26', [c[0], 4.05], 0.13, [0.05, 0.25], { font: 'mono', align: 'center' }),
      label('PAKISTAN · PRESIDENCY · JULY 2025', [c[0], head[1] + 0.55], 0.13, [0.4, 0.58], { font: 'mono', align: 'center', color: BRASS }),
      label('RESOLUTION 2788 (2025)', [c[0], c[1] - 0.45], 0.28, [0.55, 0.72], { font: 'display', align: 'center', tracking: 0.08 }),
      label('PEACEFUL SETTLEMENT OF DISPUTES', [c[0], c[1] - 1.05], 0.12, [0.62, 0.8], { font: 'mono', align: 'center', color: OLIVE }),
      label('ADOPTED UNANIMOUSLY · 22 JULY 2025', [c[0], c[1] - 1.45], 0.12, [0.68, 0.86], { font: 'mono', align: 'center', color: BRASS }),
    ],
    dots: [
      { from: seats, to: seats, delay: seats.map((_, i) => i / 15), window: [0.12, 0.42], size: 8, color: INK },
      // The vote: every seat lights in turn.
      { from: seats, to: seats, delay: seats.map((_, i) => Math.abs(i - 7) / 8), window: [0.55, 0.85], size: 11, color: BRASS, glow: true },
    ],
  }
}

/**
 * LEDGER — the 2025–26 development plan as three ruled columns rising on a ledger sheet:
 * federal, provincial and the national total. Heights are to scale.
 */
export const ledger: MotifGenerator = (e) => {
  const figs = e.figures ?? []
  const total = figs[0]?.value ?? 0
  const base = -2.5
  const k = 4.9 / Math.max(1, total)
  const strokes: MotifStroke[] = [stroke([[0.4, base], [6.5, base]], 0.04, INK, [0.0, 0.15])]
  // Faint ruled lines of the ledger sheet, one per trillion.
  for (let t = 1; t <= Math.floor(total); t++) {
    strokes.push(stroke([[0.4, base + t * k], [6.5, base + t * k]], 0.012, TAUPE, [0.04 + t * 0.03, 0.16 + t * 0.03], { alpha: 0.6, dash: 0.12 }))
  }
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = [label('URAAN PAKISTAN', [0.4, 4.0], 0.26, [0.05, 0.22], { font: 'display', tracking: 0.14 })]
  // Columns: federal, provincial, then the national outlay in brass.
  const cols = [
    { f: figs[1], name: 'FEDERAL', u: 1.3, w: 1.1, color: SAND_COL, win: [0.2, 0.42] as [number, number] },
    { f: figs[2], name: 'PROVINCIAL', u: 2.9, w: 1.1, color: SAND_COL, win: [0.3, 0.52] as [number, number] },
    { f: figs[0], name: 'NATIONAL', u: 4.9, w: 1.6, color: BRASS, win: [0.42, 0.66] as [number, number] },
  ]
  for (const col of cols) {
    if (!col.f) continue
    const top = base + col.f.value * k
    fills.push(fill(rect(col.u, (base + top) / 2, col.w, top - base), col.color, col.win, { alpha: 0.85 }))
    strokes.push(stroke(closed(rect(col.u, (base + top) / 2, col.w, top - base)), 0.025, INK, [col.win[0] + 0.05, col.win[1] + 0.05], { alpha: 0.6 }))
    const value = `${col.f.prefix ?? ''}${col.f.value.toFixed(col.f.decimals ?? 0)}${col.f.suffix ?? ''}`.toUpperCase()
    labels.push(label(value, [col.u, top + 0.35], 0.17, [col.win[1] - 0.04, col.win[1] + 0.14], { font: 'mono', align: 'center', color: INK }))
    labels.push(label(col.name, [col.u, base - 0.42], 0.12, [col.win[0], col.win[0] + 0.16], { font: 'mono', align: 'center', color: TAUPE }))
  }
  labels.push(label('ADP 2025–26 · TO SCALE', [6.0, -3.6], 0.12, [0.7, 0.88], { font: 'mono', color: BRASS, align: 'right' }))
  return { strokes, fills, labels }
}
const SAND_COL = '#cec29c'

/**
 * PACT — three states as a schematic triangle (not a map): the sides are drawn one by one as the
 * agreement is signed, a single brass ring closes around all three, and pulses run from each to
 * the other two (an attack on one is treated as an attack on all).
 */
export const pact: MotifGenerator = () => {
  const nodes: [string, UV, [number, number]][] = [
    ['TÜRKİYE', [1.3, 2.4], [0.05, 0.2]],
    ['SAUDI ARABIA', [1.3, -1.6], [0.1, 0.25]],
    ['PAKISTAN', [5.0, 0.4], [0.15, 0.3]],
  ]
  const c: UV = [(1.3 + 1.3 + 5.0) / 3, 0.4]
  const strokes: MotifStroke[] = []
  const fills: MotifFill[] = []
  const labels: MotifLabel[] = []
  // Names sit clear of the sides: above, below, and inside the triangle's eastern corner.
  const nameAt: UV[] = [[1.3, 2.85], [1.3, -1.95], [4.45, 0.32]]
  nodes.forEach(([name, at, win], i) => {
    const [, next] = nodes[(i + 1) % 3]
    strokes.push(stroke(resample([at, next], 0.2), 0.04, OLIVE, [0.22 + i * 0.1, 0.36 + i * 0.1], { alpha: 0.8 }))
    fills.push(fill(ellipse(at[0], at[1], 0.17, 0.17, 20), name === 'PAKISTAN' ? BRASS : INK, win))
    labels.push(label(name, nameAt[i], 0.18, [win[0] + 0.04, win[1] + 0.06], { font: 'display', align: i === 2 ? 'right' : 'center', tracking: 0.12 }))
  })
  // One umbrella over all three.
  strokes.push(stroke(ellipse(c[0], c[1], 3.35, 3.0, 96, Math.PI / 2, Math.PI / 2 + Math.PI * 2), 0.05, BRASS, [0.5, 0.7]))
  labels.push(label('MECCA · 7 AUGUST 2026', [c[0], -3.15], 0.17, [0.48, 0.64], { font: 'mono', align: 'center', color: BRASS }))
  labels.push(label('JOINT DEFENCE AGREEMENT', [c[0], -3.55], 0.13, [0.52, 0.68], { font: 'mono', align: 'center' }))
  labels.push(label('AN ATTACK ON ONE · AN ATTACK ON ALL', [c[0], -4.05], 0.13, [0.7, 0.88], { font: 'mono', align: 'center', color: OLIVE }))
  labels.push(label('SCHEMATIC · NOT A MAP', [0.4, 4.2], 0.11, [0.05, 0.25], { font: 'mono', color: TAUPE }))
  // Each state answers for the other two.
  const from: UV[] = []
  const to: UV[] = []
  for (const [, a] of nodes) for (const [, b] of nodes) if (a !== b) (from.push(a), to.push(b))
  return {
    strokes,
    fills,
    labels,
    dots: [{ from, to, delay: from.map((_, i) => i / from.length), window: [0.6, 0.95], size: 8, color: BRASS, glow: true }],
  }
}

/** DIALOGUE — two lines from far apart meet at one point; a table; a memorandum is signed. */
export const dialogue: MotifGenerator = () => {
  const center: UV = [2.9, 0.9]
  const west = resample([[-0.6, 2.8], [0.6, 2.2], [1.6, 1.4], [center[0] - 0.9, center[1] + 0.1]], 0.25)
  const east = resample([[6.6, 2.8], [5.4, 2.2], [4.3, 1.5], [center[0] + 0.9, center[1] + 0.1]], 0.25)
  return {
    strokes: [
      stroke(west, 0.05, INK, [0.0, 0.3], { dash: 0.3 }),
      stroke(east, 0.05, INK, [0.0, 0.3], { dash: 0.3 }),
      stroke(ellipse(center[0], center[1], 1.1, 0.55, 48), 0.05, BRASS, [0.28, 0.42]),
      stroke(closed(rect(center[0], -1.9, 3.2, 2.0)), 0.035, INK, [0.45, 0.55], { alpha: 0.7 }),
      ...textLines(center[0], -1.3, 2.4, 3, 0.32, [0.5, 0.62], 9),
      stroke(flourish(center[0], -2.45, 1.5, 55), 0.04, INK, [0.64, 0.78], { taper: true }),
    ],
    fills: [fill(rect(center[0], -1.9, 3.2, 2.0), PARCH, [0.42, 0.52], { alpha: 0.9 })],
    labels: [
      label('WASHINGTON', [-0.6, 3.25], 0.16, [0.05, 0.25], { font: 'mono' }),
      label('TEHRAN', [6.6, 3.25], 0.16, [0.05, 0.25], { font: 'mono', align: 'right' }),
      label('ISLAMABAD', [center[0], center[1] + 0.95], 0.3, [0.3, 0.48], { font: 'display', align: 'center', color: OLIVE, tracking: 0.12 }),
      label('ISLAMABAD MEMORANDUM OF UNDERSTANDING · JUNE 2026', [center[0], -3.25], 0.13, [0.6, 0.78], { font: 'mono', align: 'center', color: BRASS }),
    ],
  }
}
