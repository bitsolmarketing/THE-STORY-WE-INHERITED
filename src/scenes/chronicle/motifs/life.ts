import type { MotifGenerator, MotifStroke, MotifLabel, MotifFill, UV } from './types'
import { BRASS, INK, OLIVE, PARCH, SAGE, TAUPE, closed, ellipse, fill, label, parabola, rect, resample, stroke, wobble } from './kit'
import { rng } from '@/scenes/shared/sampleLines'

/**
 * People and moments: distance and return, lights of remembrance, the trajectories of a ball and
 * a javelin, an aircraft's path, a rocket's arc, molten steel, two forces becoming one, a horizon.
 * Diagrams on paper — never illustrations pretending to be photographs.
 */
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

/** CROWD — 2020–21: people move apart, and come back together. */
export const crowd: MotifGenerator = () => {
  const c: UV = [2.6, 0.2]
  const from: UV[] = []
  const to: UV[] = []
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 8; j++) {
      const u = c[0] + (i - 5.5) * 0.36
      const v = c[1] + (j - 3.5) * 0.36
      from.push([u, v])
      to.push([c[0] + (u - c[0]) * 1.85, c[1] + (v - c[1]) * 1.85])
    }
  }
  return {
    strokes: [],
    labels: [label('HEALTHCARE · VACCINATION · RELIEF · ADAPTATION', [6.4, -4.1], 0.14, [0.55, 0.8], { font: 'mono', color: BRASS, align: 'right' })],
    dots: [{ from, to, window: [0.0, 1.0], size: 6, color: INK, pingPong: true }],
  }
}

/** MEMORIAL — remembrance only: one light, or a field of small lights that cannot be counted. */
export const memorial: MotifGenerator = (e) => {
  const n = Number(e.visualTreatment.params?.lights ?? 1)
  const strokes: MotifStroke[] = [stroke(resample([[-0.6, -0.4], [6.4, -0.4]], 0.4), 0.02, TAUPE, [0.0, 0.3])]
  const r = rng(n * 7 + 1)
  const pts: UV[] = []
  if (n <= 1) pts.push([2.6, 0.35])
  else {
    for (let i = 0; i < 96; i++) pts.push([-0.2 + r() * 6.4, -0.1 + r() * r() * 3.6])
  }
  const place = e.id === 'E43' ? 'PESHAWAR' : 'RAWALPINDI'
  return {
    strokes,
    labels: [label(place, [6.4, -0.85], 0.16, [0.35, 0.6], { font: 'mono', align: 'right', color: TAUPE })],
    dots: [{ from: pts, to: pts, delay: pts.map((_, i) => (n <= 1 ? 0 : i / pts.length)), window: [0.1, 0.95], size: n <= 1 ? 22 : 7, color: BRASS, glow: true }],
  }
}

/** TRAJECTORY — hockey (with the titles accumulating), cricket at the MCG, the javelin in Paris. */
export const trajectory: MotifGenerator = (e) => {
  const p = e.visualTreatment.params ?? {}
  const sport = str(p.sport, 'hockey')
  if (sport === 'javelin') return javelin(str(p.label, ''))
  if (sport === 'cricket') return cricket()
  return hockey(Number(p.tally ?? 1), Boolean(p.olympic), e.id)
}

function hockey(tally: number, olympic: boolean, id: string) {
  const c: UV = [2.6, 0.5]
  const W = 6.6
  const H = 4.0
  const strokes: MotifStroke[] = [
    stroke(closed(rect(c[0], c[1], W, H)), 0.04, INK, [0.0, 0.2]),
    stroke([[c[0], c[1] - H / 2], [c[0], c[1] + H / 2]], 0.025, INK, [0.1, 0.22], { alpha: 0.6 }),
    stroke(ellipse(c[0] - W / 2, c[1], 1.2, 1.2, 40, -Math.PI / 2, Math.PI / 2), 0.03, INK, [0.15, 0.3], { alpha: 0.7 }),
    stroke(ellipse(c[0] + W / 2, c[1], 1.2, 1.2, 40, Math.PI / 2, Math.PI * 1.5), 0.03, INK, [0.15, 0.3], { alpha: 0.7 }),
    stroke(closed(rect(c[0] + W / 2 + 0.12, c[1], 0.24, 0.6)), 0.03, INK, [0.2, 0.3]),
  ]
  // The ball's path: a few passes, then the shot into the goal.
  const path = wobble(resample([[c[0] - 2.4, c[1] - 1.2], [c[0] - 0.8, c[1] + 0.9], [c[0] + 0.9, c[1] - 0.4], [c[0] + 2.2, c[1] + 0.3], [c[0] + W / 2 + 0.05, c[1] + 0.05]], 0.15), 0.02, 5)
  strokes.push(stroke(path, 0.045, BRASS, [0.25, 0.62], { dash: 0.22 }))
  const fills: MotifFill[] = [fill(ellipse(c[0] + W / 2 - 0.05, c[1] + 0.05, 0.1, 0.1, 14), INK, [0.6, 0.66])]
  // Titles so far, as brass tally marks.
  const titles = olympic ? ['1960', '1968', '1984'] : id === 'E34' ? ['1971', '1978', '1982', '1994'] : ['1971', '1978', '1982', '1994'].slice(0, tally)
  titles.forEach((_, i) => strokes.push(stroke([[c[0] - W / 2 + 0.15 + i * 0.3, c[1] - H / 2 - 0.55], [c[0] - W / 2 + 0.15 + i * 0.3, c[1] - H / 2 - 1.05]], 0.07, BRASS, [0.62 + i * 0.05, 0.68 + i * 0.05])))
  const labels: MotifLabel[] = [
    label((olympic ? 'OLYMPIC GOLD · ' : 'WORLD CUP · ') + titles.join(' · '), [c[0] - W / 2 + 0.25 + titles.length * 0.3, c[1] - H / 2 - 0.8], 0.16, [0.66, 0.86], { font: 'mono' }),
  ]
  if (id === 'E34') labels.push(label('CHAMPIONS TROPHY · LAHORE 1994', [c[0] + W / 2, c[1] - H / 2 - 0.8], 0.14, [0.75, 0.92], { font: 'mono', color: BRASS, align: 'right' }))
  return { strokes, fills, labels }
}

function cricket() {
  const c: UV = [2.6, 0.3]
  const strokes: MotifStroke[] = [
    stroke(ellipse(c[0], c[1], 3.4, 2.9, 96), 0.05, INK, [0.0, 0.25]),
    stroke(ellipse(c[0], c[1], 1.6, 1.35, 72), 0.02, INK, [0.1, 0.3], { alpha: 0.5 }),
    stroke(closed(rect(c[0], c[1], 0.28, 1.55)), 0.03, INK, [0.2, 0.32]),
  ]
  // A delivery down the pitch to the stumps.
  const top: UV = [c[0], c[1] + 0.72]
  const bottom: UV = [c[0], c[1] - 0.72]
  strokes.push(stroke(resample([[c[0] + 0.05, c[1] + 1.15], top, [c[0] - 0.03, c[1] - 0.1], bottom], 0.06), 0.035, BRASS, [0.35, 0.6], { dash: 0.12 }))
  for (const du of [-0.06, 0, 0.06]) strokes.push(stroke([[c[0] + du, bottom[1] - 0.05], [c[0] + du, bottom[1] - 0.25]], 0.02, INK, [0.55, 0.62]))
  return {
    strokes,
    labels: [
      label('MELBOURNE CRICKET GROUND', [c[0], c[1] - 3.35], 0.16, [0.2, 0.4], { font: 'mono', align: 'center' }),
      label('WORLD CUP · 1992', [c[0], c[1] + 3.2], 0.26, [0.6, 0.8], { font: 'display', align: 'center', color: OLIVE, tracking: 0.12 }),
    ],
  }
}

function javelin(distance: string) {
  const a: UV = [-0.6, -1.9]
  const b: UV = [6.2, -1.9]
  const strokes: MotifStroke[] = [
    stroke([[-0.9, -1.9], [6.6, -1.9]], 0.02, TAUPE, [0.0, 0.2]),
    stroke([[-0.9, -2.15], [a[0], -2.15]], 0.05, INK, [0.0, 0.1]),
    stroke(parabola(a, b, 3.6, 60), 0.05, BRASS, [0.15, 0.62]),
    stroke([[b[0] - 0.15, b[1] + 0.25], [b[0] + 0.12, b[1] - 0.05]], 0.06, INK, [0.6, 0.68]),
  ]
  for (let k = 0; k <= 6; k++) strokes.push(stroke([[a[0] + k * 1.0, -2.0], [a[0] + k * 1.0, -2.25]], 0.02, INK, [0.05 + k * 0.03, 0.12 + k * 0.03], { alpha: 0.6 }))
  return {
    strokes,
    labels: [
      label(distance, [b[0], b[1] + 0.75], 0.42, [0.62, 0.8], { font: 'display', align: 'right', color: OLIVE }),
      label('OLYMPIC RECORD · PARIS 2024', [b[0], b[1] - 0.6], 0.15, [0.68, 0.88], { font: 'mono', align: 'right', color: BRASS }),
    ],
  }
}

/** Plan-view silhouette of a four-engined, high-winged transport (generic, unmarked). */
function airframe(cu: number, cv: number, s: number, angle: number): UV[] {
  const pts: UV[] = [
    [0, 1.0], [0.07, 0.86], [0.08, 0.3], [0.95, 0.12], [0.95, 0.02], [0.08, 0.0], [0.07, -0.62], [0.36, -0.78], [0.36, -0.86],
    [0, -0.86], [-0.36, -0.86], [-0.36, -0.78], [-0.07, -0.62], [-0.08, 0.0], [-0.95, 0.02], [-0.95, 0.12], [-0.08, 0.3], [-0.07, 0.86],
  ]
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  return pts.map(([x, y]) => [cu + (x * c - y * sn) * s, cv + (x * sn + y * c) * s])
}

/** AIRCRAFT — 1988: a path that simply stops. 2024: an aircraft arriving at Gwadar. */
export const aircraft: MotifGenerator = (e) => {
  const vanish = e.visualTreatment.params?.mode === 'vanish'
  if (vanish) {
    const path = resample([[-0.6, -2.4], [1.6, -0.8], [3.6, 0.6]], 0.2)
    return {
      strokes: [stroke(path, 0.035, INK, [0.05, 0.5], { dash: 0.25 }), stroke(ellipse(3.6, 0.6, 0.16, 0.16, 20), 0.025, INK, [0.55, 0.62])],
      fills: [fill(airframe(1.1, -1.2, 0.85, -0.95), '#5a5850', [0.12, 0.3], { alpha: 0.85 })],
      labels: [label('NEAR BAHAWALPUR', [3.9, 0.55], 0.16, [0.6, 0.8], { font: 'mono', color: TAUPE })],
    }
  }
  const strokes: MotifStroke[] = [
    stroke(closed(rect(3.2, -1.6, 6.4, 0.55)), 0.035, INK, [0.0, 0.25]),
    stroke([[0.4, -1.6], [6.0, -1.6]], 0.03, PARCH, [0.15, 0.35], { dash: 0.35 }),
    stroke(resample([[-0.6, 2.4], [1.2, 0.6], [2.0, -1.4]], 0.2), 0.03, BRASS, [0.3, 0.6], { dash: 0.22 }),
    // Gwadar's hammerhead coast, schematic.
    stroke(wobble(resample([[-0.8, 3.6], [1.6, 3.3], [2.6, 3.9], [4.2, 3.95], [4.6, 3.4], [6.4, 3.2]], 0.2), 0.05, 8), 0.035, OLIVE, [0.05, 0.3]),
  ]
  return {
    strokes,
    fills: [fill(rect(3.2, -1.6, 6.4, 0.55), SAGE, [0.05, 0.25], { alpha: 0.25 }), fill(airframe(1.15, 0.7, 0.7, -0.75), INK, [0.45, 0.6], { alpha: 0.85 })],
    labels: [label('GWADAR', [6.4, 4.3], 0.3, [0.2, 0.4], { font: 'display', align: 'right', tracking: 0.2 })],
  }
}

/** ROCKET — Rehbar-I rises from the coast at Sonmiani through the layers of the sky. */
export const rocket: MotifGenerator = () => {
  const base: UV = [2.4, -2.9]
  const strokes: MotifStroke[] = [stroke(wobble(resample([[-0.6, -3.2], [1.4, -3.05], [3.2, -3.2], [6.4, -3.0]], 0.2), 0.05, 2), 0.04, OLIVE, [0.0, 0.2])]
  for (const [i, v] of [-1.0, 0.6, 2.2].entries()) strokes.push(stroke(resample([[-0.6, v], [6.4, v + 0.2]], 0.5), 0.015, TAUPE, [0.08 + i * 0.05, 0.3 + i * 0.05], { alpha: 0.7 }))
  strokes.push(stroke(parabola(base, [3.4, 3.4], 0.6, 50).map(([u, v], i, arr) => [u, base[1] + (v - base[1]) * (i / (arr.length - 1)) + 0] as UV), 0.04, BRASS, [0.25, 0.65], { dash: 0.2 }))
  return {
    strokes,
    fills: [fill([[base[0] - 0.12, base[1]], [base[0] + 0.12, base[1]], [base[0], base[1] + 0.45]], INK, [0.2, 0.28])],
    labels: [
      label('SONMIANI', [base[0] + 0.3, base[1] - 0.5], 0.16, [0.1, 0.3], { font: 'mono' }),
      label('REHBAR-I · 7 JUNE 1962', [3.7, 3.55], 0.18, [0.6, 0.8], { font: 'mono', color: BRASS }),
    ],
  }
}

/** INDUSTRY — steel: a ladle tips, a molten stream, ingots filling. */
export const industry: MotifGenerator = () => {
  const strokes: MotifStroke[] = [stroke(ellipse(0.8, 2.6, 1.0, 0.7, 40, Math.PI, Math.PI * 2), 0.07, INK, [0.0, 0.2]), stroke([[-0.2, 2.6], [1.8, 2.6]], 0.05, INK, [0.15, 0.22])]
  strokes.push(stroke(resample([[1.7, 2.3], [2.2, 1.4], [2.4, 0.2]], 0.1), 0.16, BRASS, [0.2, 0.42]))
  const fills: MotifFill[] = []
  for (let i = 0; i < 4; i++) {
    const cu = 1.2 + i * 1.3
    strokes.push(stroke(closed(rect(cu, -0.9, 1.0, 1.5)), 0.04, INK, [0.25 + i * 0.04, 0.35 + i * 0.04]))
    fills.push(fill(rect(cu, -0.9, 0.9, 1.4), i === 0 ? BRASS : TAUPE, [0.4 + i * 0.1, 0.6 + i * 0.1], { alpha: 0.9 }))
  }
  return {
    strokes,
    fills,
    labels: [label('PAKISTAN STEEL · KARACHI', [6.4, -2.4], 0.16, [0.6, 0.8], { font: 'mono', align: 'right', color: BRASS })],
  }
}

/** UNIFICATION — electromagnetism and the weak force become one line (electroweak). */
export const unification: MotifGenerator = () => {
  const wave = (v0: number, amp: number, freq: number): UV[] => {
    const pts: UV[] = []
    for (let i = 0; i <= 120; i++) {
      const u = -0.6 + (3.6 * i) / 120
      const k = 1 - i / 120
      pts.push([u, v0 * k + 0.3 * (1 - k) + Math.sin(u * freq) * amp * k])
    }
    return pts
  }
  return {
    strokes: [
      stroke(wave(1.8, 0.35, 5), 0.04, INK, [0.0, 0.45]),
      stroke(wave(-1.2, 0.2, 11), 0.04, OLIVE, [0.05, 0.5]),
      stroke(resample([[3.0, 0.3], [6.4, 0.3]], 0.2), 0.08, BRASS, [0.45, 0.7]),
    ],
    labels: [
      label('ELECTROMAGNETIC', [-0.6, 2.55], 0.15, [0.1, 0.3], { font: 'mono' }),
      label('WEAK', [-0.6, -0.55], 0.15, [0.15, 0.35], { font: 'mono', color: OLIVE }),
      label('ELECTROWEAK', [6.4, 0.85], 0.2, [0.6, 0.8], { font: 'mono', align: 'right', color: BRASS }),
      label('SU(2) × U(1)', [6.4, -0.35], 0.3, [0.7, 0.9], { font: 'italic', align: 'right' }),
    ],
  }
}

/** HORIZON — the next chapter: a horizon, a rising light, and the storyboard's seven directions. */
export const horizon: MotifGenerator = () => {
  const c: UV = [3.2, -1.6]
  // The storyboard's seven directions, in the order it lists them, fanned from left to right.
  const words = ['TECHNOLOGY', 'INDUSTRY', 'AGRICULTURE', 'INFRASTRUCTURE', 'SCIENCE', 'YOUTH', 'DIPLOMACY'].reverse()
  const strokes: MotifStroke[] = [stroke(resample([[0.4, c[1]], [6.2, c[1]]], 0.4), 0.035, INK, [0.0, 0.2]), stroke(ellipse(c[0], c[1], 0.9, 0.9, 60, 0, Math.PI), 0.06, BRASS, [0.12, 0.32])]
  const labels: MotifLabel[] = []
  words.forEach((w, i) => {
    const a = Math.PI * (0.1 + (0.8 * i) / (words.length - 1))
    const r0 = 1.1
    const r1 = 2.0 + (i % 2) * 0.55
    const end: UV = [c[0] + Math.cos(a) * r1 * 1.1, c[1] + Math.sin(a) * r1]
    strokes.push(stroke(resample([[c[0] + Math.cos(a) * r0 * 1.1, c[1] + Math.sin(a) * r0], end], 0.15), 0.025, BRASS, [0.3 + i * 0.05, 0.42 + i * 0.05]))
    labels.push(label(w, [end[0] + Math.cos(a) * 0.2, end[1] + 0.22], 0.14, [0.38 + i * 0.05, 0.55 + i * 0.05], { font: 'mono', align: Math.cos(a) > 0.2 ? 'left' : Math.cos(a) < -0.2 ? 'right' : 'center' }))
  })
  return { strokes, labels }
}
