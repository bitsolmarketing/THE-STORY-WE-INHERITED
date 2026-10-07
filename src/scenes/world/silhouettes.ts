import { BoxGeometry, BufferAttribute, CapsuleGeometry, Color, CylinderGeometry, LatheGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The people of 1947 (spec §10–11, owner brief of 6 Oct 2026): modelled figures in the dress of
 * the subcontinent — kurta and shalwar, dhoti, kameez and dupatta, saree, turbans, caps, shawls,
 * children's clothes — carrying bundles, tin trunks and infants. Anonymous composites: never a
 * portrait of a real person. Faces are simple sculpted forms (brow, eyes, nose, ears, beards).
 *
 * Feet at y = 0, facing +Z, 1 unit = 1 m. Every vertex carries, for materials.diorama `figure`:
 *   color    base colour of fixed parts (hair, leather, wood, metal)
 *   aFig.x   weight of the instance's first cloth colour (kurta, kameez, saree)
 *   aFig.y   weight of the instance's second cloth colour (shalwar, dhoti, dupatta, turban, shawl)
 *   aFig.z   1 on skin: the instance's skin tone replaces the colour
 *   aFig.w   part: 0 still · 1 chest (breathes) · 2 head (glances, nods) · 3/4 left/right arm (sway)
 *   aPivot   the joint the part turns about (neck, shoulder)
 * so one shared mesh per variant can vary dress, skin and timing per instance (instancing).
 *
 * Detail (LOD): 2 near (interior, platform close to the camera), 1 mid, 0 far (crowds in the
 * distance, walkers in the fields): fewer segments and no facial features.
 */
type V3 = [number, number, number]
export type Detail = 0 | 1 | 2

const TONE = {
  /** Default skin for meshes without instances (the traveller). */
  skin: '#8a6647',
  hair: '#2a2824',
  grey: '#9c978c',
  eye: '#3a2c22',
  brow: '#3b3128',
  shoe: '#3d352b',
  trunk: '#5a4a35',
  tin: '#6d6a60',
  bundleRope: '#6f5b3c',
  wood: '#5a4a33',
} as const

type Role = 'c1' | 'c1soft' | 'c2' | 'c2soft' | 'skin' | 'fixed'
type Part = { g: BufferGeometry; role: Role; hex?: string; part: number; pivot?: V3 }

const PART = { still: 0, chest: 1, head: 2, armL: 3, armR: 4 } as const
const UP = new Vector3(0, 1, 0)

let seg = { limb: 8, sphereW: 14, sphereH: 10, lathe: 16, face: true }
function setDetail(d: Detail) {
  seg = d === 2 ? { limb: 8, sphereW: 14, sphereH: 10, lathe: 18, face: true } : d === 1 ? { limb: 6, sphereW: 10, sphereH: 7, lathe: 12, face: true } : { limb: 4, sphereW: 7, sphereH: 5, lathe: 8, face: false }
}

function paint(p: Part): BufferGeometry {
  const g = p.g
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  const c = new Color(p.role === 'fixed' ? (p.hex ?? '#ffffff') : p.role === 'skin' ? TONE.skin : '#ffffff')
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  const t1 = p.role === 'c1' ? 1 : p.role === 'c1soft' ? 0.6 : 0
  const t2 = p.role === 'c2' ? 1 : p.role === 'c2soft' ? 0.55 : 0
  const pivot = p.pivot ?? [0, 0, 0]
  const piv = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) piv.set(pivot, i * 3)
  // Packed (vertex attribute slots are few): aFig = (cloth 1 weight, cloth 2 weight, skin, part).
  const fig = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) fig.set([t1, t2, p.role === 'skin' ? 1 : 0, p.part], i * 4)
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setAttribute('aFig', new BufferAttribute(fig, 4))
  g.setAttribute('aPivot', new BufferAttribute(piv, 3))
  return g
}

function build(parts: Part[]): BufferGeometry {
  const geos = parts.map(paint)
  const merged = mergeGeometries(geos)!
  geos.forEach((g) => g.dispose())
  return merged
}

/* ── Primitives ──────────────────────────────────────────────────────────────────────────── */

function limb(a: V3, b: V3, r: number, r2 = r): BufferGeometry {
  const va = new Vector3(...a)
  const d = new Vector3(...b).sub(va)
  const len = d.length()
  const g =
    Math.abs(r - r2) < 1e-4
      ? new CapsuleGeometry(r, Math.max(0.001, len), 2, seg.limb)
      : new CylinderGeometry(r2, r, Math.max(0.001, len), seg.limb, 1, false)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate(a[0] + (b[0] - a[0]) / 2, a[1] + (b[1] - a[1]) / 2, a[2] + (b[2] - a[2]) / 2)
  return g
}

function blob(c: V3, r: V3, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI, fine = 1): BufferGeometry {
  const g = new SphereGeometry(1, Math.max(5, Math.round(seg.sphereW * fine)), Math.max(4, Math.round(seg.sphereH * fine)), phiStart, phiLength, thetaStart, thetaLength)
  g.scale(r[0], r[1], r[2])
  g.translate(c[0], c[1], c[2])
  return g
}

/** A garment turned on a lathe (profile bottom → top), flattened front-to-back like a body. */
function lathe(profile: [number, number][], depth = 0.62, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  const g = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    seg.lathe,
    phiStart,
    phiLength,
  )
  g.scale(1, 1, depth)
  return g
}

const sc = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]

/* ── Body parts ──────────────────────────────────────────────────────────────────────────── */

export type HeadStyle = 'hair' | 'grey' | 'cap' | 'karakul' | 'turban' | 'pagri' | 'dupatta' | 'pallu' | 'bare-bundle' | 'child'
export type Facial = 'none' | 'moustache' | 'beard' | 'grey-beard'

/** Head on its neck: face, hair or headwear. Everything turns about the base of the neck. */
function head(c: V3, k: number, style: HeadStyle, facial: Facial = 'none'): Part[] {
  const [x, y, z] = c
  const pivot: V3 = [x, y - 0.15 * k, z]
  const H = (g: BufferGeometry, role: Role, hex?: string): Part => ({ g, role, hex, part: PART.head, pivot })
  const parts: Part[] = [
    { g: limb([x, y - 0.17 * k, z - 0.005], [x, y - 0.07 * k, z], 0.046 * k), role: 'skin', part: PART.still },
    H(blob([x, y, z], [0.09 * k, 0.113 * k, 0.1 * k], 0, Math.PI * 2, 0, Math.PI, 1.1), 'skin'),
    // Jaw and chin: a slightly narrower lower face.
    H(blob([x, y - 0.045 * k, z + 0.022 * k], [0.072 * k, 0.07 * k, 0.075 * k], 0, Math.PI * 2, 0, Math.PI, 0.7), 'skin'),
  ]
  if (seg.face) {
    const f = z + 0.093 * k
    for (const sx of [-1, 1]) {
      // Eyes set into the face (small and soft, never staring) under a fine brow.
      parts.push(H(blob([x + sx * 0.031 * k, y + 0.012 * k, f - 0.011 * k], [0.0095 * k, 0.0055 * k, 0.005 * k], 0, Math.PI * 2, 0, Math.PI, 0.5), 'fixed', TONE.eye))
      parts.push(H(blob([x + sx * 0.032 * k, y + 0.03 * k, f - 0.008 * k], [0.017 * k, 0.0035 * k, 0.005 * k], 0, Math.PI * 2, 0, Math.PI, 0.5), 'fixed', style === 'grey' ? TONE.grey : TONE.brow))
      parts.push(H(blob([x + sx * 0.09 * k, y + 0.0, z], [0.012 * k, 0.027 * k, 0.018 * k], 0, Math.PI * 2, 0, Math.PI, 0.5), 'skin'))
    }
    parts.push(H(blob([x, y - 0.006 * k, f + 0.006 * k], [0.014 * k, 0.03 * k, 0.02 * k], 0, Math.PI * 2, 0, Math.PI, 0.5), 'skin'))
    if (facial === 'moustache' || facial === 'beard' || facial === 'grey-beard') {
      parts.push(H(blob([x, y - 0.043 * k, f - 0.004 * k], [0.032 * k, 0.009 * k, 0.012 * k], 0, Math.PI * 2, 0, Math.PI, 0.5), 'fixed', facial === 'grey-beard' ? TONE.grey : TONE.hair))
    }
  }
  if (facial === 'beard' || facial === 'grey-beard') {
    parts.push(H(blob([x, y - 0.07 * k, z + 0.04 * k], [0.075 * k, 0.07 * k, 0.07 * k], 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), 'fixed', facial === 'grey-beard' ? TONE.grey : TONE.hair))
  }
  const hairCap = (hex: string) => H(blob([x, y + 0.016 * k, z - 0.012 * k], [0.097 * k, 0.105 * k, 0.106 * k], 0, Math.PI * 2, 0, 1.55), 'fixed', hex)
  switch (style) {
    case 'hair':
      parts.push(hairCap(TONE.hair))
      break
    case 'grey':
      parts.push(hairCap(TONE.grey))
      break
    case 'child':
      parts.push(hairCap(TONE.hair))
      break
    case 'cap':
      parts.push(hairCap(TONE.hair))
      parts.push(H(new CylinderGeometry(0.095 * k, 0.098 * k, 0.07 * k, seg.sphereW).translate(x, y + 0.085 * k, z - 0.008 * k), 'c2'))
      break
    case 'karakul':
      parts.push(hairCap(TONE.hair))
      parts.push(H(new CylinderGeometry(0.1 * k, 0.096 * k, 0.1 * k, seg.sphereW).translate(x, y + 0.1 * k, z - 0.008 * k), 'fixed', '#3f3b33'))
      break
    case 'turban':
    case 'pagri':
    case 'bare-bundle': {
      parts.push(H(new TorusGeometry(0.094 * k, 0.04 * k, Math.max(4, seg.limb), seg.sphereW).rotateX(Math.PI / 2).translate(x, y + 0.055 * k, z - 0.006 * k), 'c2'))
      if (style !== 'bare-bundle') parts.push(H(blob([x, y + 0.09 * k, z - 0.006 * k], [0.104 * k, 0.07 * k, 0.108 * k], 0, Math.PI * 2, 0, Math.PI / 2), 'c2'))
      // A pagri's loose end (shamla) falls behind the head.
      if (style === 'pagri') parts.push(H(limb([x + 0.03 * k, y + 0.06 * k, z - 0.1 * k], [x + 0.05 * k, y - 0.16 * k, z - 0.12 * k], 0.025 * k), 'c2'))
      break
    }
    case 'dupatta':
    case 'pallu': {
      // Hair parted beneath, the cloth over the head and down the back, open at the face.
      parts.push(H(blob([x, y + 0.03 * k, z + 0.01 * k], [0.094 * k, 0.09 * k, 0.1 * k], 0, Math.PI * 2, 0, 1.2), 'fixed', TONE.hair))
      parts.push(H(blob([x, y + 0.012 * k, z - 0.01 * k], [0.112 * k, 0.13 * k, 0.118 * k], Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, 2.25), style === 'pallu' ? 'c1soft' : 'c2soft'))
      break
    }
  }
  return parts
}

/** Arm: sleeve (or bare forearm) and a hand, turning about the shoulder. */
function arm(s: V3, e: V3, w: V3, k: number, side: number, opts: { bareForearm?: boolean; role?: Role; hex?: string; part?: number } = {}): Part[] {
  const part = opts.part ?? (side < 0 ? PART.armL : PART.armR)
  const role = opts.role ?? 'c1'
  const hand: V3 = [w[0] + (w[0] - e[0]) * 0.3, w[1] + (w[1] - e[1]) * 0.3, w[2] + (w[2] - e[2]) * 0.3]
  return [
    { g: limb(s, e, 0.047 * k, 0.043 * k), role, hex: opts.hex, part, pivot: s },
    { g: limb(e, w, opts.bareForearm ? 0.034 * k : 0.041 * k, opts.bareForearm ? 0.03 * k : 0.038 * k), role: opts.bareForearm ? 'skin' : role, hex: opts.hex, part, pivot: s },
    { g: blob(hand, [0.03 * k, 0.05 * k, 0.022 * k], 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'skin', part, pivot: s },
  ]
}

/** Leg with a garment over it (shalwar, trousers) or bare below the knee (dhoti), and a shoe. */
function leg(h: V3, kn: V3, a: V3, k: number, opts: { bareShin?: boolean; role?: Role; hex?: string; wide?: boolean } = {}): Part[] {
  const role = opts.role ?? 'c2'
  const wide = opts.wide ? 1.15 : 1
  return [
    { g: limb(h, kn, 0.082 * k * wide, 0.07 * k * wide), role, hex: opts.hex, part: PART.still },
    { g: limb(kn, a, opts.bareShin ? 0.048 * k : 0.064 * k * wide, opts.bareShin ? 0.035 * k : 0.052 * k), role: opts.bareShin ? 'skin' : role, hex: opts.hex, part: PART.still },
    { g: blob([a[0], 0.032 * k, a[2] + 0.05 * k], [0.044 * k, 0.032 * k, 0.11 * k], 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'fixed', hex: TONE.shoe, part: PART.still },
  ]
}

/* ── Garments ────────────────────────────────────────────────────────────────────────────── */

type Garment = 'kurta' | 'kurta-short' | 'kameez' | 'frock' | 'saree' | 'waistcoat' | 'coat'

const PROFILES: Record<Garment, [number, number][]> = {
  kurta: [[0.205, 0.6], [0.19, 0.74], [0.172, 0.92], [0.162, 1.06], [0.18, 1.22], [0.197, 1.35], [0.18, 1.43], [0.06, 1.465], [0, 1.47]],
  'kurta-short': [[0.19, 0.78], [0.172, 0.92], [0.162, 1.06], [0.18, 1.22], [0.197, 1.35], [0.18, 1.43], [0.06, 1.465], [0, 1.47]],
  kameez: [[0.235, 0.5], [0.215, 0.7], [0.19, 0.9], [0.165, 1.05], [0.176, 1.22], [0.184, 1.33], [0.165, 1.41], [0.06, 1.45], [0, 1.455]],
  frock: [[0.26, 0.5], [0.22, 0.66], [0.17, 0.86], [0.165, 1.05], [0.176, 1.22], [0.184, 1.33], [0.165, 1.41], [0.06, 1.45], [0, 1.455]],
  saree: [[0.25, 0.02], [0.24, 0.3], [0.21, 0.62], [0.19, 0.86], [0.166, 1.04], [0.176, 1.22], [0.184, 1.33], [0.165, 1.41], [0.06, 1.45], [0, 1.455]],
  waistcoat: [[0.19, 0.88], [0.172, 0.95], [0.167, 1.06], [0.185, 1.22], [0.2, 1.35], [0.18, 1.43], [0.07, 1.46], [0, 1.465]],
  coat: [[0.24, 0.44], [0.215, 0.6], [0.19, 0.85], [0.176, 1.0], [0.19, 1.2], [0.207, 1.34], [0.186, 1.43], [0.065, 1.47], [0, 1.475]],
}

function torso(g: Garment, k: number, dy = 0, role: Role = 'c1', hex?: string, cutBelow = -1): Part {
  const pts = PROFILES[g].filter(([, y]) => y >= cutBelow).map(([r, y]) => [r * k, (y + dy) * k] as [number, number])
  return { g: lathe(pts), role, hex, part: PART.chest }
}

/* ── Figures ─────────────────────────────────────────────────────────────────────────────── */

interface Standing {
  k?: number
  headK?: number
  head?: HeadStyle
  facial?: Facial
  garment?: Garment
  lower?: 'shalwar' | 'dhoti' | 'none'
  shawl?: boolean
  waistcoat?: boolean
  dupatta?: boolean
  arms?: 'down' | 'bundle' | 'stick' | 'hand-out' | 'infant' | 'trunk' | 'hands-front'
  lean?: number
}

function stoop(parts: Part[], pivotY: number, angle: number) {
  for (const p of parts) {
    p.g.translate(0, -pivotY, 0)
    p.g.rotateX(angle)
    p.g.translate(0, pivotY, 0)
    if (p.pivot) {
      const v = new Vector3(p.pivot[0], p.pivot[1] - pivotY, p.pivot[2]).applyAxisAngle(new Vector3(1, 0, 0), angle)
      p.pivot = [v.x, v.y + pivotY, v.z]
    }
  }
}

function standing(o: Standing = {}): BufferGeometry {
  const k = o.k ?? 1
  const headK = o.headK ?? 1
  const g = o.garment ?? 'kurta'
  const woman = g === 'kameez' || g === 'saree' || g === 'frock'
  const upper: Part[] = [torso(g, k)]
  const sx = woman ? 0.165 : 0.175
  for (const side of [-1, 1]) upper.push({ g: blob(sc([side * sx, 1.385, 0], k), sc([0.07, 0.065, 0.07], k), 0, Math.PI * 2, 0, Math.PI, 0.7), role: 'c1', part: PART.chest })
  if (o.waistcoat) upper.push(torso('waistcoat', k * 1.03, 0, 'fixed', '#3f3d35'))
  if (o.shawl) upper.push({ g: lathe([[0.25 * k, 0.86 * k], [0.25 * k, 1.1 * k], [0.235 * k, 1.3 * k], [0.16 * k, 1.44 * k], [0.08 * k, 1.47 * k]], 0.72, 0.5, Math.PI * 2 - 1.0), role: 'c2', part: PART.chest })
  if (o.dupatta || g === 'saree') {
    // Over the shoulders and down the back (a saree's pallu in the saree's own colour).
    upper.push({ g: lathe([[0.25 * k, 0.92 * k], [0.262 * k, 1.12 * k], [0.24 * k, 1.3 * k], [0.165 * k, 1.44 * k], [0.12 * k, 1.53 * k]], 0.7, 0.6, Math.PI * 2 - 1.2), role: g === 'saree' ? 'c1soft' : 'c2soft', part: PART.chest })
  }
  const headC: V3 = [0, (1.47 + (1.575 - 1.47) * headK) * k, 0]
  upper.push(...head(headC, k * headK, o.head ?? (woman ? 'dupatta' : 'hair'), o.facial ?? 'none'))

  const arms = o.arms ?? 'down'
  const sleeveRole: Role = 'c1'
  for (const side of [-1, 1]) {
    const s: V3 = sc([side * (woman ? 0.185 : 0.2), 1.375, 0], k)
    let e: V3
    let w: V3
    if (arms === 'bundle') {
      e = sc([side * 0.27, 1.6, 0.02], k)
      w = sc([side * 0.13, 1.79, 0.02], k)
    } else if (arms === 'stick' && side === 1) {
      e = sc([0.25, 1.13, 0.1], k)
      w = sc([0.26, 0.97, 0.24], k)
    } else if (arms === 'hand-out' && side === 1) {
      e = sc([0.27, 1.12, 0.04], k)
      w = sc([0.34, 0.88, 0.08], k)
    } else if (arms === 'infant' || arms === 'hands-front') {
      // Forearms across the body: cradling an infant, or hands clasped in front.
      e = sc([side * 0.22, 1.12, 0.1], k)
      w = sc([side * 0.05, arms === 'infant' ? 1.12 : 0.98, 0.2], k)
    } else if (arms === 'trunk' && side === 1) {
      // Carrying a tin trunk by its handle at the side.
      e = sc([0.25, 1.1, 0], k)
      w = sc([0.27, 0.86, 0.0], k)
    } else {
      e = sc([side * (woman ? 0.215 : 0.235), 1.1, 0], k)
      w = sc([side * (woman ? 0.2 : 0.235), 0.85, woman ? 0.06 : 0.03], k)
    }
    upper.push(...arm(s, e, w, k, side, { role: sleeveRole }))
  }
  if (arms === 'bundle') {
    upper.push({ g: blob(sc([0, 1.88, 0], k), sc([0.28, 0.14, 0.22], k)), role: 'c2soft', part: PART.still })
    upper.push({ g: blob(sc([0.02, 2.0, 0], k), sc([0.07, 0.05, 0.06], k), 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'c2soft', part: PART.still })
  }
  if (arms === 'infant') {
    // A swaddled infant held to the chest.
    upper.push({ g: blob(sc([0.02, 1.16, 0.2], k), sc([0.16, 0.085, 0.09], k)), role: 'c2soft', part: PART.still })
    upper.push({ g: blob(sc([0.15, 1.2, 0.2], k), sc([0.055, 0.06, 0.055], k), 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'skin', part: PART.still })
  }
  if (o.lean) stoop(upper, 0.92 * k, o.lean)

  const parts: Part[] = [...upper]
  const hem = PROFILES[g][0][1]
  if (o.lower === 'dhoti') {
    // Dhoti: wrapped cloth to mid-calf, bare shins.
    parts.push({ g: lathe([[0.2 * k, 0.32 * k], [0.21 * k, 0.6 * k], [0.18 * k, 0.88 * k], [0.15 * k, 0.95 * k]], 0.7), role: 'c2', part: PART.still })
    for (const side of [-1, 1]) parts.push(...leg(sc([side * 0.09, 0.85, 0], k), sc([side * 0.095, 0.5, 0.012], k), sc([side * 0.095, 0.09, 0], k), k, { bareShin: true }))
  } else if (g !== 'saree') {
    for (const side of [-1, 1]) parts.push(...leg(sc([side * 0.09, Math.min(0.9, hem + 0.3), 0], k), sc([side * 0.095, 0.5, 0.012], k), sc([side * 0.095, 0.09, 0], k), k, { wide: true }))
  } else {
    for (const side of [-1, 1]) parts.push({ g: blob([side * 0.09 * k, 0.032 * k, 0.07 * k], [0.044 * k, 0.03 * k, 0.1 * k], 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'fixed', hex: TONE.shoe, part: PART.still })
  }
  if (arms === 'stick') {
    const hand = new Vector3(0.26, 0.97, 0.24).multiplyScalar(k)
    hand.y -= 0.92 * k
    hand.applyAxisAngle(new Vector3(1, 0, 0), o.lean ?? 0)
    hand.y += 0.92 * k
    parts.push({ g: limb([hand.x, hand.y - 0.02, hand.z + 0.01], [hand.x + 0.05, 0.0, hand.z + 0.12], 0.014), role: 'fixed', hex: TONE.wood, part: PART.still })
  }
  if (arms === 'trunk') {
    parts.push({ g: new BoxGeometry(0.16, 0.3, 0.52).translate(0.3 * k, 0.62 * k, 0), role: 'fixed', hex: TONE.tin, part: PART.still })
    parts.push({ g: new BoxGeometry(0.17, 0.03, 0.53).translate(0.3 * k, 0.72 * k, 0), role: 'fixed', hex: '#4c4a42', part: PART.still })
  }
  return build(parts)
}

/** Seated with hands on the knees (or holding a child): on a tin trunk, on a bench, or on the floor. */
interface Seated {
  on: 'trunk' | 'bench' | 'floor'
  head?: HeadStyle
  facial?: Facial
  woman?: boolean
  child?: boolean
  shawl?: boolean
  /** Turned to the window: the head is set a little toward the left shoulder. */
  lap?: 'hands' | 'child' | 'bundle'
}

function seated(o: Seated): BufferGeometry {
  const hipY = o.on === 'trunk' ? 0.5 : o.on === 'bench' ? 0.48 : 0.12
  const dy = hipY - 0.92
  const g: Garment = o.woman ? 'kameez' : 'kurta'
  const parts: Part[] = [torso(g, 1, dy, 'c1', undefined, 0.88)]
  // The skirt of the garment falls over the lap.
  parts.push({ g: blob([0, hipY + 0.03, 0.16], [0.2, 0.06, 0.22]), role: 'c1', part: PART.still })
  for (const side of [-1, 1]) parts.push({ g: blob([side * 0.175, 1.385 + dy, 0], [0.07, 0.065, 0.07], 0, Math.PI * 2, 0, Math.PI, 0.7), role: 'c1', part: PART.chest })
  if (o.shawl) parts.push({ g: lathe([[0.25, 0.9 + dy], [0.25, 1.1 + dy], [0.235, 1.3 + dy], [0.16, 1.44 + dy], [0.08, 1.47 + dy]], 0.72, 0.5, Math.PI * 2 - 1.0), role: 'c2', part: PART.chest })
  if (o.woman) parts.push({ g: lathe([[0.25, 0.92 + dy], [0.262, 1.12 + dy], [0.24, 1.3 + dy], [0.165, 1.44 + dy], [0.12, 1.53 + dy]], 0.7, 0.6, Math.PI * 2 - 1.2), role: 'c2soft', part: PART.chest })
  const lap = o.lap ?? 'hands'
  for (const side of [-1, 1]) {
    const s: V3 = [side * 0.2, 1.375 + dy, 0]
    if (o.on === 'floor') {
      // Cross-legged on the floor (roof riders, families on the platform).
      parts.push({ g: limb([side * 0.09, hipY, 0.02], [side * 0.3, 0.1, 0.3], 0.078, 0.068), role: 'c2', part: PART.still })
      parts.push({ g: limb([side * 0.3, 0.1, 0.3], [-side * 0.08, 0.07, 0.38], 0.062, 0.05), role: 'c2', part: PART.still })
      parts.push({ g: blob([-side * 0.12, 0.06, 0.38], [0.1, 0.03, 0.04], 0, Math.PI * 2, 0, Math.PI, 0.6), role: 'fixed', hex: TONE.shoe, part: PART.still })
      parts.push(...arm(s, [side * 0.24, 1.1 + dy, 0.12], [side * 0.22, 0.25, 0.3], 1, side))
    } else {
      parts.push(...leg([side * 0.09, hipY, 0.02], [side * 0.105, hipY + 0.02, 0.42], [side * 0.105, 0.09, 0.45], 1))
      const w: V3 = lap === 'child' ? [side * 0.06, 0.72 + dy + 0.5, 0.3] : [side * 0.15, 0.97 + dy, 0.33]
      parts.push(...arm(s, [side * 0.235, 1.1 + dy, 0.12], w, 1, side))
    }
  }
  if (lap === 'child') {
    // A small child seated on the lap, held close.
    parts.push({ g: lathe([[0.12, hipY + 0.06], [0.11, hipY + 0.2], [0.11, hipY + 0.32], [0.05, hipY + 0.38], [0, hipY + 0.385]], 0.75), role: 'c2', part: PART.still })
    parts.push({ g: blob([0, hipY + 0.47, 0.22], [0.07, 0.085, 0.075]), role: 'skin', part: PART.still })
    parts.push({ g: blob([0, hipY + 0.49, 0.21], [0.073, 0.08, 0.078], 0, Math.PI * 2, 0, 1.6), role: 'fixed', hex: TONE.hair, part: PART.still })
    parts[parts.length - 3].g.translate(0, 0, 0.22)
  }
  if (lap === 'bundle') parts.push({ g: blob([0, hipY + 0.16, 0.3], [0.2, 0.12, 0.14]), role: 'c2soft', part: PART.still })
  parts.push(...head([0, 1.575 + dy, 0], 1, o.woman ? 'dupatta' : (o.head ?? 'hair'), o.facial ?? 'none'))
  if (o.on === 'trunk') {
    parts.push({ g: new BoxGeometry(0.66, 0.42, 0.44).translate(0, 0.21, -0.04), role: 'fixed', hex: TONE.tin, part: PART.still })
    parts.push({ g: new BoxGeometry(0.67, 0.035, 0.45).translate(0, 0.33, -0.04), role: 'fixed', hex: '#4c4a42', part: PART.still })
  }
  return build(parts)
}

/* ── The cast ────────────────────────────────────────────────────────────────────────────── */

export const PEOPLE_VARIANTS = {
  man: () => standing({ head: 'hair', facial: 'moustache' }),
  manCap: () => standing({ head: 'karakul', facial: 'moustache', waistcoat: true }),
  manTurban: () => standing({ head: 'pagri', facial: 'beard', arms: 'hand-out' }),
  manDhoti: () => standing({ head: 'turban', facial: 'moustache', garment: 'kurta-short', lower: 'dhoti' }),
  manTrunk: () => standing({ head: 'cap', facial: 'moustache', arms: 'trunk' }),
  woman: () => standing({ garment: 'kameez', dupatta: true, arms: 'hands-front' }),
  womanSaree: () => standing({ garment: 'saree', head: 'pallu' }),
  mother: () => standing({ garment: 'kameez', dupatta: true, arms: 'infant' }),
  bundleBearer: () => standing({ head: 'bare-bundle', facial: 'moustache', arms: 'bundle', garment: 'kurta-short', lower: 'dhoti' }),
  child: () => standing({ k: 0.6, headK: 1.28, head: 'child', garment: 'kurta' }),
  girl: () => standing({ k: 0.58, headK: 1.28, head: 'child', garment: 'frock' }),
  elder: () => standing({ head: 'turban', facial: 'grey-beard', arms: 'stick', lean: 0.26, shawl: true }),
  elderWoman: () => standing({ garment: 'kameez', dupatta: true, lean: 0.18, arms: 'hands-front' }),
  seated: () => seated({ on: 'trunk', head: 'cap', facial: 'moustache' }),
  seatedWoman: () => seated({ on: 'trunk', woman: true, lap: 'bundle' }),
  floorMan: () => seated({ on: 'floor', head: 'turban', facial: 'beard', shawl: true }),
  floorWoman: () => seated({ on: 'floor', woman: true }),
  passenger: () => seated({ on: 'bench', head: 'pagri', facial: 'beard', shawl: true }),
  passengerMan: () => seated({ on: 'bench', head: 'karakul', facial: 'moustache' }),
  passengerWoman: () => seated({ on: 'bench', woman: true, lap: 'child' }),
  passengerElder: () => seated({ on: 'bench', head: 'grey', facial: 'grey-beard', shawl: true }),
} as const
export type PeopleVariant = keyof typeof PEOPLE_VARIANTS

export function personGeometry(variant: PeopleVariant, detail: Detail = 2): BufferGeometry {
  setDetail(detail)
  const g = PEOPLE_VARIANTS[variant]()
  setDetail(2)
  return g
}

/**
 * The traveller (spec §11): a long coat, a suitcase in the right hand, seen mostly from behind.
 * Built in pieces so the legs and the free arm swing as they walk (pivots at the origin).
 */
export function protagonistGeometry(): {
  body: BufferGeometry
  leg: BufferGeometry
  arm: BufferGeometry
  case: BufferGeometry
  hipY: number
  hipX: number
  shoulder: V3
} {
  setDetail(2)
  const COAT = '#2f3a33'
  const TROUSER = '#3a3a34'
  const body = build([
    torso('coat', 1, 0, 'fixed', COAT),
    { g: new TorusGeometry(0.06, 0.022, 6, 14).rotateX(Math.PI / 2).translate(0, 1.47, 0), role: 'fixed', hex: COAT, part: 0 },
    ...[-1, 1].map((side): Part => ({ g: blob([side * 0.18, 1.39, 0], [0.072, 0.066, 0.072]), role: 'fixed', hex: COAT, part: 0 })),
    ...head([0, 1.58, 0], 1.02, 'cap', 'moustache').map((p): Part => (p.role === 'c2' ? { ...p, role: 'fixed', hex: '#2f2e29' } : p)),
    ...arm([0.205, 1.38, 0], [0.245, 1.1, 0.0], [0.265, 0.83, 0.0], 1, 1, { role: 'fixed', hex: COAT }),
  ])
  const leg = build([
    { g: limb([0, 0, 0], [0, -0.42, 0.012], 0.074, 0.066), role: 'fixed', hex: TROUSER, part: 0 },
    { g: limb([0, -0.42, 0.012], [0, -0.83, 0], 0.062, 0.054), role: 'fixed', hex: TROUSER, part: 0 },
    { g: blob([0, -0.885, 0.05], [0.046, 0.036, 0.115]), role: 'fixed', hex: TONE.shoe, part: 0 },
  ])
  const armGeo = build(arm([0, 0, 0], [-0.03, -0.28, 0.0], [-0.03, -0.53, 0.04], 1, -1, { role: 'fixed', hex: COAT }))
  const corner = (y: number, z: number): Part => ({ g: new BoxGeometry(0.145, 0.03, 0.03).translate(0.28, y, z), role: 'fixed', hex: '#4a3d2a', part: 0 })
  const caseGeo = build([
    { g: new BoxGeometry(0.13, 0.33, 0.46).translate(0.28, 0.58, 0.0), role: 'fixed', hex: '#ffffff', part: 0 },
    { g: new TorusGeometry(0.05, 0.012, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(0.28, 0.745, 0.0), role: 'fixed', hex: '#4a3d2a', part: 0 },
    corner(0.43, -0.22),
    corner(0.43, 0.22),
    corner(0.73, -0.22),
    corner(0.73, 0.22),
  ])
  return { body, leg, arm: armGeo, case: caseGeo, hipY: 0.92, hipX: 0.09, shoulder: [-0.205, 1.38, 0] }
}
