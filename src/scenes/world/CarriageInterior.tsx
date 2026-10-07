import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color, CylinderGeometry, InstancedBufferAttribute, SphereGeometry, type BufferGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '@/scenes/shared/sampleLines'
import { PALETTE } from './layout'
import { diorama } from './materials'
import { instanced, type Placement } from './build'
import { personGeometry, type Detail, type PeopleVariant } from './silhouettes'
import { ROOF, floorTexture, luggageRack, roofArc, slattedBench } from './trainKit'

/**
 * Inside the carriage the camera enters (spec §12): a third-class carriage of the period, crowded.
 * Wooden slatted benches face each other in bays along the window side, iron luggage racks above
 * them loaded with trunks and bundles, a lamp in each bay under an arched, ribbed ceiling, worn
 * floorboards. Passengers sit on the benches and on the floor with their belongings.
 *
 * Coordinates are the carriage's own (floor at y = 0, centred on x = 0, window wall at z = −w/2).
 * Kept clear: the hero window the seated camera looks through, and the camera's path from the
 * door to its seat (x ≈ 1.2 … 5.2, z > −0.2).
 */
interface Props {
  length: number
  width: number
  height: number
  bays: number[]
  heroX: number
  doorX: number
  shadows: boolean
  detail: Detail
}

const CLOTH1 = ['#eee7d7', '#e2d8c3', '#d4c5ad', '#b8a88f', '#9aa596', '#5f6f62', '#3e604f', '#5c574c', '#3c3b36', '#7a6a4f']
const CLOTH2 = ['#f3eee3', '#e8ddca', '#d4c5ad', '#b8a88f', '#a88b57', '#6f7d6c', '#4a4a42']

export function CarriageInterior({ length, width, height, bays, heroX, doorX, shadows, detail }: Props) {
  const built = useMemo(() => {
    const r = rng(1947)
    const wall = -width / 2 + 0.08
    const inPath = (x: number, z: number) => x > doorX - 0.7 && x < heroX + 0.7 && z > -0.2
    const benches: Placement[] = []
    const racks: Placement[] = []
    const lamps: Placement[] = []
    const seatsFar: { x: number; z: number; facing: number }[] = []
    // Bench positions: in each bay a pair facing each other, back to back with the next bay's. The
    // hero bay sets its benches wider, clear of the window the camera looks through.
    const heroBenches = [heroX - 0.95, heroX + 0.95]
    const benchXs: { x: number; facing: number }[] = []
    for (const bx of bays) {
      for (const side of [-1, 1]) {
        const hero = Math.abs(bx - heroX) < 0.01
        const x = hero ? bx + side * 0.95 : bx + side * 0.62
        if (!hero && heroBenches.some((h) => Math.abs(h - x) < 0.75)) continue
        if (Math.abs(x) > length / 2 - 0.4) continue
        benchXs.push({ x, facing: -side })
      }
      racks.push({ x: bx, y: 1.98, z: wall })
      lamps.push({ x: bx, y: height + roofArc(0) * 0.6 - 0.22, z: 0 })
    }
    for (const { x, facing } of benchXs) {
      // Far (window) side; the bench's back is away from the bay it faces.
      benches.push({ x, y: 0, z: wall + 0.72, ry: facing > 0 ? 0 : Math.PI })
      seatsFar.push({ x, z: wall + 0.38, facing }, { x, z: wall + 1.02, facing })
      // Near side too, except where the door and the camera's way in need the floor.
      if (!(x > doorX - 1.1 && x < heroX + 1.3)) benches.push({ x, y: 0, z: width / 2 - 0.8, ry: facing > 0 ? 0 : Math.PI })
    }

    // Who sits where. The hero bay: one passenger each side by the window, looking out.
    const people: { v: PeopleVariant; p: Placement }[] = []
    for (const s of seatsFar) {
      const hero = Math.abs(s.x - heroX) < 1.2
      const nearWindow = s.z < wall + 0.6
      if (hero && !nearWindow) continue // the hero bay keeps its aisle side free for the camera's view
      if (!hero && r() < 0.18) continue
      const v: PeopleVariant = (['passenger', 'passengerMan', 'passengerWoman', 'passengerElder'] as const)[Math.floor(r() * 4)]
      // Facing across the bay; those by the window turn toward it.
      const ry = (s.facing > 0 ? Math.PI / 2 : -Math.PI / 2) + (nearWindow ? s.facing * 0.5 : (r() - 0.5) * 0.3)
      people.push({ v: hero ? (s.facing > 0 ? 'passengerElder' : 'passengerMan') : v, p: { x: s.x + s.facing * 0.02, y: 0, z: s.z, ry } })
    }
    // On the floor of the aisle with their bundles: families who found no seat.
    const floorBundles: Placement[] = []
    for (let i = 0; i < 9; i++) {
      const x = -length / 2 + 1.2 + r() * (length - 2.4)
      const z = -0.05 + r() * 1.2
      if (inPath(x, z) || Math.abs(x - doorX) < 0.9) continue
      people.push({ v: r() < 0.5 ? 'floorWoman' : 'floorMan', p: { x, y: 0, z, ry: r() * Math.PI * 2 } })
      floorBundles.push({ x: x + (r() - 0.5) * 0.6, y: 0, z: Math.min(width / 2 - 0.3, z + 0.4), ry: r() * Math.PI, s: 0.8 + r() * 0.3 })
    }
    // On the racks: trunks and bundles.
    const rackTrunks: Placement[] = []
    const rackBundles: Placement[] = []
    for (const rk of racks) {
      for (let k = 0; k < 3; k++) {
        const x = rk.x - 0.6 + k * 0.6 + (r() - 0.5) * 0.15
        if (r() < 0.5) rackTrunks.push({ x, y: rk.y + 0.02, z: rk.z + 0.2, ry: (r() - 0.5) * 0.2, s: 0.55 + r() * 0.15 })
        else rackBundles.push({ x, y: rk.y + 0.02, z: rk.z + 0.2, ry: r() * Math.PI, s: 0.5 + r() * 0.2 })
      }
    }

    // Instancing: one mesh per passenger variant, each instance its own dress, skin and timing.
    const meshes: InstancedMesh[] = []
    const byVariant = new Map<PeopleVariant, Placement[]>()
    for (const { v, p } of people) {
      if (!byVariant.has(v)) byVariant.set(v, [])
      byVariant.get(v)!.push(p)
    }
    for (const [v, items] of byVariant) {
      const geo = personGeometry(v, detail === 0 ? 1 : 2)
      const mesh = instanced(geo, diorama('#ffffff', { figure: true }), items, { shadows })
      const c2 = new Float32Array(items.length * 3)
      items.forEach((_, i) => {
        mesh.setColorAt(i, new Color(CLOTH1[Math.floor(r() * CLOTH1.length)]))
        const c = new Color(CLOTH2[Math.floor(r() * CLOTH2.length)])
        c2.set([c.r, c.g, c.b], i * 3)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      geo.setAttribute('aCloth2', new InstancedBufferAttribute(c2, 3))
      geo.setAttribute('aLife', new InstancedBufferAttribute(new Float32Array(items.flatMap(() => [r(), r()])), 2))
      meshes.push(mesh)
    }

    const wood = diorama('#7a5f40')
    meshes.push(instanced(slattedBench(1.35), wood, benches, { shadows }))
    meshes.push(instanced(luggageRack(1.75), diorama(PALETTE.charcoal), racks))
    const lampGeo = mergeGeometries([new CylinderGeometry(0.09, 0.12, 0.06, 12).translate(0, 0.1, 0), new SphereGeometry(0.1, 12, 8).translate(0, 0.0, 0)])!
    meshes.push(instanced(lampGeo, diorama('#f3e6c8', { glow: 0.55 }), lamps))
    const trunkGeo = mergeGeometries([new BoxGeometry(0.7, 0.36, 0.42).translate(0, 0.18, 0), new BoxGeometry(0.72, 0.04, 0.44).translate(0, 0.3, 0)])!
    const bundleGeo = mergeGeometries([new SphereGeometry(0.3, 12, 8).scale(1, 0.62, 0.9).translate(0, 0.17, 0), new SphereGeometry(0.08, 8, 6).translate(0, 0.36, 0)])!
    if (rackTrunks.length) {
      const m = instanced(trunkGeo, diorama('#ffffff'), rackTrunks)
      rackTrunks.forEach((_, i) => m.setColorAt(i, new Color(['#6d6a60', '#5e6a5c', '#7a6845'][i % 3])))
      meshes.push(m)
    }
    const allBundles = [...rackBundles, ...floorBundles]
    if (allBundles.length) {
      const m = instanced(bundleGeo, diorama('#ffffff'), allBundles, { shadows })
      allBundles.forEach((_, i) => m.setColorAt(i, new Color([PALETTE.parchment, PALETTE.sage, PALETTE.sandstone, '#d9cbb0'][i % 4])))
      meshes.push(m)
    }
    for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true

    // Ceiling: the inside of the arched roof, painted, with a rib (carline) every 0.6 m.
    const ceilingPts: BufferGeometry[] = []
    const ribs: BufferGeometry[] = []
    const n = 18
    const half = width / 2 - 0.08
    for (let i = 0; i < n; i++) {
      const z0 = -half + (2 * half * i) / n
      const z1 = -half + (2 * half * (i + 1)) / n
      const y0 = roofArc(z0) * 0.6
      const y1 = roofArc(z1) * 0.6
      const panel = new BoxGeometry(length - 0.2, 0.02, Math.hypot(z1 - z0, y1 - y0) + 0.01)
      panel.rotateX(Math.atan2(y1 - y0, z1 - z0))
      panel.translate(0, height - 0.06 + (y0 + y1) / 2, (z0 + z1) / 2)
      ceilingPts.push(panel)
      for (let x = -length / 2 + 0.4; x < length / 2 - 0.3; x += 0.6) {
        const rib = new BoxGeometry(0.05, 0.05, Math.hypot(z1 - z0, y1 - y0) + 0.01)
        rib.rotateX(Math.atan2(y1 - y0, z1 - z0))
        rib.translate(x, height - 0.09 + (y0 + y1) / 2, (z0 + z1) / 2)
        ribs.push(rib)
      }
    }
    const ceiling = mergeGeometries(ceilingPts)!
    const ribGeo = mergeGeometries(ribs)!
    ceilingPts.forEach((g) => g.dispose())
    ribs.forEach((g) => g.dispose())

    const floorTex = floorTexture(length, width)
    return { meshes, ceiling, ribGeo, floorTex }
  }, [length, width, height, bays, heroX, doorX, shadows, detail])

  useEffect(
    () => () => {
      built.meshes.forEach((m) => m.geometry.dispose())
      built.ceiling.dispose()
      built.ribGeo.dispose()
      built.floorTex.dispose()
    },
    [built],
  )

  return (
    <group>
      <mesh position-y={-0.05} material={diorama('#ffffff', { map: built.floorTex })} receiveShadow={shadows}>
        <boxGeometry args={[length, 0.1, width]} />
      </mesh>
      <mesh geometry={built.ceiling} material={diorama('#b9ae98')} />
      <mesh geometry={built.ribGeo} material={diorama('#8f8470')} />
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

export const CEILING_RISE = ROOF.rise * 0.6
