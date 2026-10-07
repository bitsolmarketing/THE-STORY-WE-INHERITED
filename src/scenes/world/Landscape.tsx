import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '@/scenes/shared/sampleLines'
import { LANDSCAPE, PALETTE, TRACK } from './layout'
import { landscape } from './landscapeMaterial'
import { instanced, range, type Placement } from './build'
import { personGeometry, type PeopleVariant } from './silhouettes'

/**
 * What the window frames (spec §13): the second line, telegraph poles flicking past, fields, the
 * trees of the Punjab plain (broad shisham and neem, poplar and eucalyptus along a canal, flat-topped
 * kikar), straw stacks, families walking with bundles along a dirt track, a village far off.
 * Backlit by the afternoon sun and softened by haze.
 *
 * Every repeated piece is instanced and wraps (landscapeMaterial), so a few hundred pieces make an
 * endless plain; long uniform pieces are cut into 10 m segments so their triangles stay small
 * (one 1.4 km sliver triangle loses depth precision and shows through the carriage walls).
 */
const MIN = -120
const SPAN = 300

/** A lumpy crown: overlapping spheres jittered deterministically, merged. */
function crown(seed: number, lumps: [number, number, number, number][], detail = 1): BufferGeometry {
  const r = rng(seed)
  const parts = lumps.map(([x, y, z, rad]) => {
    const g = new SphereGeometry(rad, 9 * detail, 7 * detail)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const k = 1 + (r() - 0.5) * 0.16
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.92, pos.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g.translate(x, y, z)
  })
  const merged = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return merged
}

function trunk(h: number, r0: number, branches: [number, number, number][] = []): BufferGeometry {
  const parts: BufferGeometry[] = [new CylinderGeometry(r0 * 0.6, r0, h, 7).translate(0, h / 2, 0)]
  for (const [y, a, len] of branches) {
    const b = new CylinderGeometry(r0 * 0.25, r0 * 0.45, len, 5).translate(0, len / 2, 0)
    b.rotateZ(a)
    parts.push(b.translate(0, y, 0))
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

interface Species {
  trunk: BufferGeometry
  crown: BufferGeometry
  bark: string
  leaf: string
  count: number
  near: number
  far: number
}

export function Landscape({ density }: { density: number }) {
  const meshes = useMemo(() => {
    const r = rng(1950)
    const out: InstancedMesh[] = []
    const scaled = (n: number) => Math.max(4, Math.round(n * density))

    // The second line (z ≈ −4.6): sleepers; its rails and ballast are uniform, so static (below).
    const sleepers = range(MIN, MIN + SPAN, TRACK.sleeperSpacing).map((x) => ({ x, y: 0.12, z: -4.6 }))
    out.push(instanced(new BoxGeometry(0.24, 0.08, 2.5).translate(0, 0.04, 0), landscape(PALETTE.taupe, MIN, SPAN), sleepers))

    // Telegraph poles beside the line, with a cross-arm and insulators.
    const poleParts = [
      new CylinderGeometry(0.07, 0.1, 7, 6).translate(0, 3.5, 0),
      new BoxGeometry(0.08, 0.08, 1.4).translate(0, 6.6, 0),
      new BoxGeometry(0.06, 0.06, 1.0).translate(0, 6.2, 0),
      ...[-0.55, 0, 0.55].map((z) => new CylinderGeometry(0.035, 0.045, 0.1, 6).translate(0, 6.69, z)),
    ]
    const poles = range(MIN, MIN + SPAN - LANDSCAPE.poleSpacing, LANDSCAPE.poleSpacing).map((x) => ({ x, y: 0, z: -7.4 }))
    out.push(instanced(mergeGeometries(poleParts)!, landscape('#4b4a42', MIN, SPAN), poles))

    // Fields: a mosaic of crops, fallow and ploughed earth.
    const fields: Placement[] = []
    const fieldColors: string[] = []
    for (let i = 0; i < scaled(70); i++) {
      fields.push({ x: MIN + r() * SPAN, y: 0.015 + r() * 0.01, z: -12 - r() * 90, sx: 8 + r() * 26, sy: 1, sz: 4 + r() * 14 })
      fieldColors.push([PALETTE.sage, '#c9bfa4', PALETTE.sandstone, '#b9b393', '#a7ad94', '#9fa585'][Math.floor(r() * 6)])
    }
    const fieldMesh = instanced(new BoxGeometry(1, 0.01, 1), landscape('#ffffff', MIN, SPAN), fields)
    fieldColors.forEach((hex, i) => fieldMesh.setColorAt(i, new Color(hex)))
    if (fieldMesh.instanceColor) fieldMesh.instanceColor.needsUpdate = true
    out.push(fieldMesh)

    // Trees, three kinds; trunks and crowns share placements.
    const species: Species[] = [
      // Shisham / neem: a broad, rounded crown of several masses.
      {
        trunk: trunk(2.2, 0.2, [[1.6, 0.5, 1.0], [1.8, -0.55, 0.9]]),
        crown: crown(11, [[0, 3.2, 0, 1.45], [-1.1, 2.8, 0.2, 1.0], [1.05, 2.9, -0.2, 1.05], [0.2, 3.9, 0.3, 0.9], [-0.3, 2.9, -0.8, 0.9]]),
        bark: '#4a4136',
        leaf: '#59604f',
        count: 55,
        near: 26,
        far: 150,
      },
      // Poplar / eucalyptus: tall and narrow, in rows along the canal.
      {
        trunk: trunk(5.0, 0.13),
        crown: crown(23, [[0, 4.4, 0, 0.7], [0, 5.6, 0, 0.62], [0, 6.6, 0, 0.45], [0.15, 3.4, 0.1, 0.6]]),
        bark: '#6b6455',
        leaf: '#69705c',
        count: 38,
        near: 58,
        far: 70,
      },
      // Kikar (acacia): a low, flat, spreading crown.
      {
        trunk: trunk(1.6, 0.14, [[1.2, 0.8, 1.2], [1.2, -0.8, 1.1]]),
        crown: crown(37, [[0, 2.3, 0, 1.0], [-1.0, 2.15, 0.3, 0.8], [1.0, 2.2, -0.2, 0.85]]).scale(1.2, 0.45, 1.2).translate(0, 1.3, 0),
        bark: '#3f3a31',
        leaf: '#6f735c',
        count: 24,
        near: 22,
        far: 110,
      },
    ]
    species.forEach((s, k) => {
      const items: Placement[] = []
      for (let i = 0; i < scaled(s.count); i++) {
        const t = r()
        // Poplars line the canal (z ≈ −61 and −67); the others keep their distance from the line.
        const z = k === 1 ? (r() < 0.5 ? -61 : -67) - r() * 1.2 : -s.near - t * t * (s.far - s.near)
        items.push({ x: MIN + r() * SPAN, y: 0, z, s: 0.85 + r() * 0.5 + t * 0.6, ry: r() * Math.PI * 2 })
      }
      out.push(instanced(s.trunk, landscape(s.bark, MIN, SPAN), items))
      out.push(instanced(s.crown, landscape(s.leaf, MIN, SPAN), items))
    })

    // Bushes along field edges.
    const bushes: Placement[] = []
    for (let i = 0; i < scaled(60); i++) bushes.push({ x: MIN + r() * SPAN, y: 0, z: -10 - r() * 50, s: 0.5 + r() * 0.7, ry: r() * Math.PI })
    out.push(instanced(crown(51, [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.2, 0.45], [-0.45, 0.35, -0.1, 0.4]]), landscape('#6a705d', MIN, SPAN), bushes))

    // Straw stacks (toori) by the fields: a thatched cone on a short drum.
    const stacks: Placement[] = []
    for (let i = 0; i < scaled(16); i++) stacks.push({ x: MIN + r() * SPAN, y: 0, z: -18 - r() * 40, s: 0.8 + r() * 0.5 })
    const stackGeo = mergeGeometries([new CylinderGeometry(1.0, 1.1, 1.2, 12).translate(0, 0.6, 0), new ConeGeometry(1.25, 1.6, 12).translate(0, 2.0, 0)])!
    out.push(instanced(stackGeo, landscape('#b9a77e', MIN, SPAN), stacks))

    // Families walking along the dirt track beside the line, the way the train is going.
    const walkers: [PeopleVariant, number][] = [
      ['bundleBearer', 14],
      ['woman', 14],
      ['mother', 6],
      ['manTurban', 10],
      ['child', 10],
      ['elder', 6],
    ]
    for (const [v, n] of walkers) {
      const items: Placement[] = []
      for (let i = 0; i < scaled(n); i++) {
        const group = Math.floor(r() * 14)
        items.push({ x: MIN + group * (SPAN / 14) + r() * 6, y: 0, z: -15 - r() * 3, ry: Math.PI / 2 + (r() - 0.5) * 0.4, s: 0.95 + r() * 0.1 })
      }
      out.push(instanced(personGeometry(v, 0), landscape('#45463f', MIN, SPAN), items))
    }

    // A village far off: flat-roofed mud houses with parapets, in small clusters.
    const village: Placement[] = []
    for (let i = 0; i < scaled(12); i++) village.push({ x: MIN + r() * SPAN, y: 0, z: -95 - r() * 45, s: 0.65 + r() * 0.35, ry: (r() - 0.5) * 0.3 })
    const houses = [0, 1, 2].flatMap((k) => {
      const w = 3 + k
      const h = 2.4 + k * 0.6
      const x = k * 3.6 - 3.6
      return [new BoxGeometry(w, h, w * 0.8).translate(x, h / 2, k * 0.6), new BoxGeometry(w + 0.1, 0.35, w * 0.8 + 0.1).translate(x, h + 0.17, k * 0.6)]
    })
    out.push(instanced(mergeGeometries(houses)!, landscape('#8a8371', MIN, SPAN), village))

    return out
  }, [density])

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  // Long, uniform pieces: 1400 m, cut into 10 m segments (see the note above).
  const SEG = 140
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <mesh position={[0, 0.06, -4.6]} material={landscape('#c9b99f', MIN, SPAN)}>
        <boxGeometry args={[1400, 0.12, 3.2, SEG, 1, 1]} />
      </mesh>
      {[-4.6 - TRACK.gauge / 2, -4.6 + TRACK.gauge / 2].map((z) => (
        <mesh key={z} position={[0, 0.175, z]} material={landscape(PALETTE.charcoal, MIN, SPAN)}>
          <boxGeometry args={[1400, 0.11, 0.07, SEG, 1, 1]} />
        </mesh>
      ))}
      {[6.55, 6.65, 6.15].map((y, i) => (
        <mesh key={i} position={[0, y, -7.4 + (i - 1) * 0.5]} material={landscape('#3f3e38', MIN, SPAN)}>
          <boxGeometry args={[1400, 0.012, 0.012, SEG, 1, 1]} />
        </mesh>
      ))}
      {/* The canal, with the poplars along its banks. */}
      <mesh position={[0, 0.02, -64]} material={landscape('#9fae9f', MIN, SPAN)}>
        <boxGeometry args={[1400, 0.01, 5, SEG, 1, 1]} />
      </mesh>
    </group>
  )
}
