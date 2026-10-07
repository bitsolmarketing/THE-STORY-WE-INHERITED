import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color, CylinderGeometry, InstancedBufferAttribute, SphereGeometry, TorusGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '@/scenes/shared/sampleLines'
import { PALETTE, PLATFORM, TRAIN } from './layout'
import { diorama } from './materials'
import { instanced, type Placement } from './build'
import { personGeometry, type Detail, type PeopleVariant } from './silhouettes'
import { roofTopAt } from './trainKit'

/**
 * Scene 04 — the crowd (spec §10): scale, waiting, luggage, children close to adults. Modelled,
 * faceless-by-distance figures of 1947 (silhouettes.ts), each with its own dress, skin tone, height
 * and timing, rising one after another out of the map. A lane is kept clear for the traveller.
 * `where`: the platform crowd (slides away with the station) or the people riding on the roofs.
 *
 * Level of detail: figures near the stretch the camera walks are built finer than those further
 * down the platform; the low quality tier builds everyone at the coarse level.
 */

/** First cloth (kurta, kameez, saree): mostly undyed and pale cottons, then khaki, grey and dark. */
const CLOTH1 = ['#eee7d7', '#e6dcc6', '#ddd2bb', '#d4c5ad', '#c9bfa4', '#b8a88f', '#9aa596', '#8fa294', '#7a6a4f', '#5f6f62', '#3e604f', '#5c574c', '#3c3b36']
/** Second cloth (shalwar, dhoti, dupatta, turban, shawl). */
const CLOTH2 = ['#f3eee3', '#ebe3d2', '#e8ddca', '#d4c5ad', '#b8a88f', '#a88b57', '#9aa596', '#6f7d6c', '#5c574c', '#3c3b36']

const PLATFORM_MIX: [PeopleVariant, number][] = [
  ['man', 0.12],
  ['manCap', 0.08],
  ['manTurban', 0.09],
  ['manDhoti', 0.06],
  ['manTrunk', 0.05],
  ['woman', 0.11],
  ['womanSaree', 0.04],
  ['mother', 0.05],
  ['bundleBearer', 0.08],
  ['child', 0.07],
  ['girl', 0.05],
  ['elder', 0.04],
  ['elderWoman', 0.03],
  ['seated', 0.05],
  ['seatedWoman', 0.03],
  ['floorWoman', 0.03],
  ['floorMan', 0.02],
]

function pick(r: number, mix: [PeopleVariant, number][]): PeopleVariant {
  const total = mix.reduce((n, [, w]) => n + w, 0)
  let acc = 0
  for (const [v, w] of mix) {
    acc += w / total
    if (r <= acc) return v
  }
  return mix[0][0]
}

interface Person extends Placement {
  c1: string
  c2: string
  skin: number
  phase: number
}

export function Crowd({ count, luggage, where, shadows, detail = 2 }: { count: number; luggage: number; where: 'platform' | 'roof'; shadows: boolean; detail?: Detail }) {
  const meshes = useMemo(() => {
    const random = rng(where === 'platform' ? 1401 : 1402)
    const groups = new Map<string, { v: PeopleVariant; d: Detail; items: Person[] }>()
    const trunks: Placement[] = []
    const bags: Placement[] = []
    const bundles: Placement[] = []
    const bedrolls: Placement[] = []
    const add = (v: PeopleVariant, d: Detail, p: Placement) => {
      const key = `${v}|${d}`
      if (!groups.has(key)) groups.set(key, { v, d, items: [] })
      // Height and build vary person to person (never clones).
      const h = 0.94 + random() * 0.12
      groups.get(key)!.items.push({
        ...p,
        sx: (p.s ?? 1) * (0.95 + random() * 0.1),
        sy: (p.s ?? 1) * h,
        sz: (p.s ?? 1) * (0.95 + random() * 0.1),
        s: undefined,
        c1: CLOTH1[Math.floor(random() * CLOTH1.length)],
        c2: CLOTH2[Math.floor(random() * CLOTH2.length)],
        skin: random(),
        phase: random(),
      })
    }
    const near = (x: number): Detail => (detail === 0 ? 0 : x > -8 && x < 34 ? detail : (Math.max(0, detail - 1) as Detail))

    if (where === 'platform') {
      let placed = 0
      let guard = 0
      const spots: [number, number][] = []
      const clear = (x: number, z: number, r: number) => spots.every(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 > r * r)
      while (placed < count && guard++ < count * 30) {
        // Denser near the train and around the stretch the camera walks.
        const x = PLATFORM.xMin + 3 + random() * (PLATFORM.xMax - PLATFORM.xMin - 6)
        const nearTrain = random() < 0.55
        const z = nearTrain ? PLATFORM.zMin + 0.6 + random() * 2.1 : PLATFORM.zMin + 0.7 + random() * (PLATFORM.zMax - PLATFORM.zMin - 1.4)
        if (x > -3 && x < 20 && z > 3.3 && z < 5.1) continue // the traveller's lane
        if (x > 16 && x < 20.5 && z < 3.3) continue // the open door
        if (Math.abs(z - PLATFORM.columnZ) < 0.45 && Math.abs((((x - PLATFORM.xMin - 3) % PLATFORM.columnSpacing) + PLATFORM.columnSpacing) % PLATFORM.columnSpacing) < 0.6) continue
        if (random() > (x > -10 && x < 45 ? 1 : 0.55)) continue
        // Nobody stands inside anybody else.
        if (!clear(x, z, 0.52)) continue
        spots.push([x, z])
        const v = pick(random(), PLATFORM_MIX)
        // Most face the arriving camera (−X), turned a little each; some face away or toward the train.
        const r = random()
        const ry = r < 0.55 ? -Math.PI / 2 + (random() - 0.5) * 1.3 : r < 0.75 ? Math.PI + (random() - 0.5) * 0.8 : r < 0.9 ? Math.PI / 2 + (random() - 0.5) * 1.2 : (random() - 0.5) * 1.0
        const delay = Math.min(1, Math.max(0, (x + 30) / 100 + (random() - 0.5) * 0.3))
        add(v, near(x), { x, y: PLATFORM.y, z, ry, delay })
        placed++
        // Children keep close to an adult.
        if ((v === 'woman' || v === 'manTurban') && random() < 0.6) {
          const cx = x + Math.cos(ry) * 0.42
          const cz = z - Math.sin(ry) * 0.42
          if (clear(cx, cz, 0.3) && !(cx > -3 && cx < 20 && cz > 3.3 && cz < 5.1)) {
            spots.push([cx, cz])
            add(random() < 0.5 ? 'child' : 'girl', near(cx), { x: cx, y: PLATFORM.y, z: cz, ry: ry + (random() - 0.5) * 0.4, delay })
          }
        }
        if (random() < luggage / Math.max(1, count)) {
          const a = random() * Math.PI * 2
          const lx = x + Math.cos(a) * 0.45
          const lz = z + Math.sin(a) * 0.45
          if (lx > -3 && lx < 20 && lz > 3.3 && lz < 5.1) continue
          const kind = random()
          const ld = 0.3 + random() * 0.6
          if (kind < 0.35) trunks.push({ x: lx, y: PLATFORM.y, z: lz, ry: random() * Math.PI, s: 0.85 + random() * 0.3, delay: ld })
          else if (kind < 0.55) bags.push({ x: lx, y: PLATFORM.y, z: lz, ry: random() * Math.PI, s: 0.8 + random() * 0.4, delay: ld })
          else if (kind < 0.8) bundles.push({ x: lx, y: PLATFORM.y, z: lz, ry: random() * Math.PI, s: 0.8 + random() * 0.5, delay: ld })
          else bedrolls.push({ x: lx, y: PLATFORM.y, z: lz, ry: random() * Math.PI, s: 0.85 + random() * 0.3, delay: ld })
        }
      }
    } else {
      // People riding on the carriage roofs (as the refugee trains carried them), seated close
      // together with their bundles: the archive's 1947 photographs show roofs crowded end to end.
      // Seated on the arched roof's surface, wherever across it they sit.
      const roofY = (z: number) => TRAIN.floorY + roofTopAt(z) - 0.01
      const carriages = [0, 1, 2].map((i) => TRAIN.firstCarriageX + i * (TRAIN.carriage.length + TRAIN.carriage.gap))
      const roofMix: [PeopleVariant, number][] = [
        ['floorMan', 0.32],
        ['floorWoman', 0.24],
        ['seated', 0.16],
        ['man', 0.1],
        ['manTurban', 0.08],
        ['child', 0.1],
      ]
      for (const cx of carriages) {
        const spots: [number, number][] = []
        for (let i = 0, guard = 0; i < Math.round(count / 3) && guard < 400; guard++) {
          const x = cx - 8.6 + random() * 17.2
          const z = (random() - 0.5) * 2.0
          if (!spots.every(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 > 0.5 * 0.5)) continue
          spots.push([x, z])
          i++
          const v = pick(random(), roofMix)
          add(v, Math.min(detail, 1) as Detail, { x, y: roofY(z), z, ry: -Math.PI / 2 + (random() - 0.5) * 1.8, delay: 0.4 + random() * 0.6 })
          if (random() < 0.4) {
            const bz = Math.max(-1.1, Math.min(1.1, z + (random() - 0.5) * 0.6))
            bundles.push({ x: x + (random() - 0.5) * 0.7, y: roofY(bz), z: bz, ry: random() * Math.PI, s: 0.7 + random() * 0.4, delay: 0.4 + random() * 0.6 })
          }
        }
      }
    }

    const people: InstancedMesh[] = []
    for (const { v, d, items } of groups.values()) {
      const geo = personGeometry(v, d)
      const mesh = instanced(geo, diorama('#ffffff', { curve: 'people', staggered: true, figure: true }), items, { shadows: shadows && d > 0 })
      items.forEach((p, i) => mesh.setColorAt(i, new Color(p.c1)))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      const c2 = new Float32Array(items.length * 3)
      items.forEach((p, i) => {
        const c = new Color(p.c2)
        c2.set([c.r, c.g, c.b], i * 3)
      })
      geo.setAttribute('aCloth2', new InstancedBufferAttribute(c2, 3))
      geo.setAttribute('aLife', new InstancedBufferAttribute(new Float32Array(items.flatMap((p) => [p.skin, p.phase])), 2))
      people.push(mesh)
    }

    // Period luggage: tin trunks with a lid band, cloth-covered cases with straps, knotted bundles, rolled bedding.
    const extras: InstancedMesh[] = []
    const luggageMat = (hex: string) => diorama(hex, { curve: 'people', staggered: true })
    const tint = (m: InstancedMesh, tones: string[]) => {
      for (let i = 0; i < m.count; i++) m.setColorAt(i, new Color(tones[i % tones.length]))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    if (trunks.length) {
      const g = mergeGeometries([new BoxGeometry(0.7, 0.36, 0.42).translate(0, 0.18, 0), new BoxGeometry(0.72, 0.04, 0.44).translate(0, 0.3, 0), new BoxGeometry(0.04, 0.37, 0.44).translate(-0.2, 0.185, 0), new BoxGeometry(0.04, 0.37, 0.44).translate(0.2, 0.185, 0)])!
      const m = instanced(g, luggageMat('#ffffff'), trunks, { shadows })
      tint(m, ['#6d6a60', '#5e6a5c', '#7a6845', '#4f4d45'])
      extras.push(m)
    }
    if (bags.length) {
      const g = mergeGeometries([new BoxGeometry(0.56, 0.36, 0.22).translate(0, 0.18, 0), new BoxGeometry(0.04, 0.37, 0.23).translate(-0.14, 0.18, 0), new BoxGeometry(0.04, 0.37, 0.23).translate(0.14, 0.18, 0), new TorusGeometry(0.06, 0.012, 5, 10, Math.PI).translate(0, 0.36, 0)])!
      const m = instanced(g, luggageMat('#ffffff'), bags, { shadows })
      tint(m, [PALETTE.taupe, '#7a6845', PALETTE.olive, '#8a7a5c'])
      extras.push(m)
    }
    if (bundles.length) {
      const body = new SphereGeometry(0.3, 12, 8).scale(1, 0.62, 0.9).translate(0, 0.17, 0)
      const knot = new SphereGeometry(0.08, 8, 6).scale(1, 0.8, 1).translate(0, 0.36, 0)
      const m = instanced(mergeGeometries([body, knot])!, luggageMat('#ffffff'), bundles, { shadows })
      tint(m, [PALETTE.parchment, PALETTE.sage, PALETTE.sandstone, PALETTE.taupe, '#d9cbb0', '#9aa596'])
      extras.push(m)
    }
    if (bedrolls.length) {
      const roll = new CylinderGeometry(0.15, 0.15, 0.7, 12).rotateZ(Math.PI / 2).translate(0, 0.15, 0)
      const strap = (x: number) => new CylinderGeometry(0.158, 0.158, 0.035, 12).rotateZ(Math.PI / 2).translate(x, 0.15, 0)
      const m = instanced(mergeGeometries([roll, strap(-0.2), strap(0.2)])!, luggageMat('#ffffff'), bedrolls, { shadows })
      tint(m, ['#8fa294', '#b8a88f', '#6f5b3c', '#5f6f62'])
      extras.push(m)
    }
    return [...people, ...extras]
  }, [count, luggage, where, shadows, detail])

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
