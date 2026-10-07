import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2, type BufferGeometry, type Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PALETTE } from './layout'
import { diorama } from './materials'
import { LAND_UNIFORMS } from './landscapeMaterial'
import { RAIL_TOP, bogieFrame, wheelset } from './trainKit'

/**
 * The locomotive: a broad-gauge 4-6-0 passenger engine of the kind that worked the North Western
 * Railway in 1947, in general form (an illustration, not a particular engine): leading bogie, three
 * coupled driving wheels under splashers, outside cylinders, a Belpaire firebox, a cab with
 * spectacle windows, a headlamp on the smokebox. Front to +X, centred on x = 0.
 *
 * When the train departs, the wheels turn and the rods work: every angle is the distance travelled
 * divided by the wheel's radius (the landscape's scroll offset), so it reverses with the scroll.
 */
const DRIVER_R = 0.94
const BOGIE_R = 0.48
const DRIVERS = [-2.9, -0.85, 1.2]
const BOGIE = [3.55, 5.15]
const CRANK = 0.34
const ROD_Z = 1.3
const CYL_X = 4.0
const ROD_LEN = 3.25
const AXLE_Y = RAIL_TOP + DRIVER_R
const BOILER_Y = 2.78

const IRON = PALETTE.charcoal
const IRON_LIGHT = '#55554d'
const STEEL = '#8a8a82'
const BRASS = PALETTE.brass
const BEAM = '#8d7448'

function lathe(points: [number, number][], seg = 20): LatheGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), seg)
}

export function Locomotive({ x, shadows }: { x: number; shadows: boolean }) {
  const drivers = useRef<(Mesh | null)[]>([])
  const bogies = useRef<(Mesh | null)[]>([])
  const coupling = useRef<(Mesh | null)[]>([])
  const connecting = useRef<(Mesh | null)[]>([])
  const crosshead = useRef<(Mesh | null)[]>([])

  const g = useMemo(() => {
    const geos: Record<string, BufferGeometry> = {}
    geos.driver = wheelset(DRIVER_R, 0.838, { counterweight: true })
    geos.bogieWheel = wheelset(BOGIE_R, 0.838, { spokes: 10 })
    geos.bogieFrame = bogieFrame(1.6, BOGIE_R).translate(0, RAIL_TOP, 0)
    // Frames: deep plates inside the wheels.
    geos.frames = mergeGeometries([-0.6, 0.6].map((z) => new BoxGeometry(11.0, 0.75, 0.05).translate(0.6, 1.25, z)))!
    // Running board, valance and the buffer beam.
    geos.footplate = mergeGeometries([
      new BoxGeometry(10.9, 0.06, 2.95).translate(0.95, 1.66, 0),
      ...[-1.45, 1.45].map((z) => new BoxGeometry(10.9, 0.2, 0.05).translate(0.95, 1.54, z)),
    ])!
    geos.beam = new BoxGeometry(0.22, 0.55, 2.95).translate(6.5, 1.25, 0)
    geos.buffers = mergeGeometries([-0.85, 0.85].flatMap((z) => [new CylinderGeometry(0.12, 0.14, 0.42, 12).rotateZ(Math.PI / 2).translate(6.8, 1.18, z), new CylinderGeometry(0.22, 0.22, 0.05, 16).rotateZ(Math.PI / 2).translate(7.02, 1.18, z)]))!
    geos.hook = new BoxGeometry(0.3, 0.08, 0.1).translate(6.75, 1.05, 0)
    // Splashers over the driving wheels.
    geos.splashers = mergeGeometries(
      DRIVERS.flatMap((dx) => [-0.84, 0.84].map((z) => new CylinderGeometry(DRIVER_R + 0.06, DRIVER_R + 0.06, 0.16, 24, 1, false, Math.PI / 2 + 0.55, Math.PI - 1.1).rotateX(Math.PI / 2).translate(dx, AXLE_Y, z))),
    )!
    // Boiler with lagging bands, Belpaire firebox, smokebox and its door.
    geos.boiler = new CylinderGeometry(0.8, 0.8, 6.6, 28).rotateZ(Math.PI / 2).translate(0.7, BOILER_Y, 0)
    geos.bands = mergeGeometries([-2.2, -0.8, 0.6, 2.0, 3.4].map((dx) => new CylinderGeometry(0.815, 0.815, 0.06, 28).rotateZ(Math.PI / 2).translate(dx, BOILER_Y, 0)))!
    geos.firebox = mergeGeometries([new BoxGeometry(1.7, 1.45, 1.7).translate(-3.4, 2.55, 0), new BoxGeometry(1.7, 0.2, 1.5).translate(-3.4, 3.37, 0)])!
    geos.smokebox = new CylinderGeometry(0.84, 0.84, 1.2, 28).rotateZ(Math.PI / 2).translate(4.6, BOILER_Y, 0)
    geos.door = mergeGeometries([
      new CylinderGeometry(0.76, 0.78, 0.08, 28).rotateZ(Math.PI / 2).translate(5.23, BOILER_Y, 0),
      new SphereGeometry(0.76, 20, 8, 0, Math.PI * 2, 0, 0.35).rotateZ(-Math.PI / 2).translate(4.52, BOILER_Y, 0),
    ])!
    geos.doorFittings = mergeGeometries([
      new CylinderGeometry(0.035, 0.035, 0.18, 8).rotateZ(Math.PI / 2).translate(5.43, BOILER_Y, 0),
      new BoxGeometry(0.04, 0.05, 0.5).translate(5.48, BOILER_Y, 0),
      ...[0.35, -0.35].map((dy) => new BoxGeometry(0.03, 0.06, 1.1).translate(5.3, BOILER_Y + dy, 0.3)),
    ])!
    geos.chimney = lathe([[0.3, 0], [0.26, 0.12], [0.24, 0.55], [0.27, 0.7], [0.33, 0.78], [0.33, 0.84], [0.24, 0.86], [0.0, 0.86]]).translate(4.65, BOILER_Y + 0.72, 0)
    geos.dome = lathe([[0.42, 0], [0.38, 0.12], [0.33, 0.3], [0.28, 0.38], [0.15, 0.45], [0, 0.47]]).translate(0.4, BOILER_Y + 0.7, 0)
    geos.valves = mergeGeometries([-0.18, 0.18].map((z) => new CylinderGeometry(0.06, 0.08, 0.32, 10).translate(-3.4, 3.62, z)))!
    geos.whistle = mergeGeometries([new CylinderGeometry(0.025, 0.025, 0.3, 6).translate(-4.15, 3.62, 0), new CylinderGeometry(0.06, 0.05, 0.16, 10).translate(-4.15, 3.85, 0)])!
    geos.sandboxes = mergeGeometries(DRIVERS.slice(1).flatMap((dx) => [-1.15, 1.15].map((z) => new BoxGeometry(0.45, 0.4, 0.28).translate(dx - 1.02, 1.89, z))))!
    geos.handrails = mergeGeometries([-0.92, 0.92].map((z) => new CylinderGeometry(0.018, 0.018, 7.4, 6).rotateZ(Math.PI / 2).translate(1.0, BOILER_Y + 0.25, z)))!
    // Headlamp on the smokebox, a lamp iron and its lens.
    geos.headlamp = mergeGeometries([new CylinderGeometry(0.2, 0.2, 0.42, 16).rotateZ(Math.PI / 2).translate(5.0, BOILER_Y + 0.98, 0), new BoxGeometry(0.3, 0.18, 0.22).translate(5.0, BOILER_Y + 0.82, 0)])!
    geos.lens = new CylinderGeometry(0.16, 0.16, 0.03, 16).rotateZ(Math.PI / 2).translate(5.22, BOILER_Y + 0.98, 0)
    // Outside cylinders with valve chests, and the slide bars.
    geos.cylinders = mergeGeometries([-ROD_Z, ROD_Z].flatMap((z) => [
      new CylinderGeometry(0.34, 0.34, 1.15, 18).rotateZ(Math.PI / 2).translate(CYL_X + 0.4, AXLE_Y, z),
      new BoxGeometry(1.05, 0.38, 0.4).translate(CYL_X + 0.4, AXLE_Y + 0.5, z),
      new CylinderGeometry(0.36, 0.36, 0.06, 18).rotateZ(Math.PI / 2).translate(CYL_X - 0.18, AXLE_Y, z),
    ]))!
    geos.slidebars = mergeGeometries([-ROD_Z, ROD_Z].flatMap((z) => [0.12, -0.12].map((dy) => new BoxGeometry(1.9, 0.05, 0.06).translate(CYL_X - 1.15, AXLE_Y + dy, z))))!
    // Cab: side sheets with windows, front spectacle plate, roof with an overhang.
    geos.cab = mergeGeometries([
      ...[-1.43, 1.43].flatMap((z) => [
        new BoxGeometry(2.7, 1.0, 0.06).translate(-5.55, 2.2, z),
        new BoxGeometry(2.7, 0.35, 0.06).translate(-5.55, 3.8, z),
        new BoxGeometry(0.5, 1.0, 0.06).translate(-6.65, 3.15, z),
        new BoxGeometry(0.25, 1.0, 0.06).translate(-4.33, 3.15, z),
      ]),
      new BoxGeometry(0.06, 2.3, 2.9).translate(-4.2, 2.8, 0),
    ])!
    geos.cabWindows = mergeGeometries([
      ...[-1.42, 1.42].map((z) => new BoxGeometry(1.75, 0.9, 0.03).translate(-5.4, 3.15, z)),
      ...[-0.85, 0.85].map((z) => new CylinderGeometry(0.22, 0.22, 0.03, 16).rotateZ(Math.PI / 2).translate(-4.16, 3.45, z)),
    ])!
    geos.cabRoof = mergeGeometries([new BoxGeometry(3.3, 0.08, 3.2).translate(-5.5, 4.02, 0), new BoxGeometry(3.1, 0.08, 2.4).translate(-5.5, 4.1, 0)])!
    // Rods: coupling rod joins the crank pins; connecting rod runs from the crosshead to the middle driver.
    geos.coupling = new BoxGeometry(DRIVERS[2] - DRIVERS[0] + 0.25, 0.1, 0.06)
    geos.connecting = new BoxGeometry(ROD_LEN, 0.12, 0.07)
    geos.crosshead = new BoxGeometry(0.34, 0.2, 0.12)
    return geos
  }, [])

  useEffect(() => () => Object.values(g).forEach((geo) => geo.dispose()), [g])

  const mats = {
    iron: diorama(IRON),
    ironLight: diorama(IRON_LIGHT),
    steel: diorama(STEEL),
    brass: diorama(BRASS),
    beam: diorama(BEAM),
    glass: diorama('#26281f'),
    lamp: diorama('#f3e6c8', { glow: 0.6 }),
    roof: diorama('#46473f'),
  }

  const lastAngle = useRef(Number.NaN)
  useFrame(() => {
    const travel = LAND_UNIFORMS.uOffset.value
    const a = travel / DRIVER_R
    if (a === lastAngle.current) return
    lastAngle.current = a
    drivers.current.forEach((m) => m && (m.rotation.z = -a))
    const ab = travel / BOGIE_R
    bogies.current.forEach((m) => m && (m.rotation.z = -ab))
    // Right side leads the left by a quarter turn (quartering).
    ;[1, -1].forEach((side, i) => {
      const th = -a + (side > 0 ? 0 : Math.PI / 2)
      const px = Math.cos(th) * CRANK
      const py = Math.sin(th) * CRANK
      const c = coupling.current[i]
      if (c) c.position.set((DRIVERS[0] + DRIVERS[2]) / 2 + px, AXLE_Y + py, side * (ROD_Z - 0.18))
      // Connecting rod from the middle driver's pin to the crosshead sliding on the bars.
      const pinX = DRIVERS[1] + px
      const pinY = AXLE_Y + py
      const xh = pinX + Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - py * py))
      const r = connecting.current[i]
      if (r) {
        r.position.set((pinX + xh) / 2, (pinY + AXLE_Y) / 2, side * ROD_Z)
        r.rotation.z = Math.atan2(AXLE_Y - pinY, xh - pinX)
      }
      const h = crosshead.current[i]
      if (h) h.position.set(xh, AXLE_Y, side * ROD_Z)
    })
  })

  const M = (geo: BufferGeometry, mat: (typeof mats)[keyof typeof mats], cast = false) => <mesh geometry={geo} material={mat} castShadow={shadows && cast} receiveShadow={shadows} />
  return (
    <group position={[x, 0, 0]}>
      {DRIVERS.map((dx, i) => (
        <mesh key={dx} ref={(m) => void (drivers.current[i] = m)} geometry={g.driver} material={mats.iron} position={[dx, AXLE_Y, 0]} castShadow={shadows} />
      ))}
      {BOGIE.map((dx, i) => (
        <mesh key={dx} ref={(m) => void (bogies.current[i] = m)} geometry={g.bogieWheel} material={mats.iron} position={[dx, RAIL_TOP + BOGIE_R, 0]} />
      ))}
      <mesh geometry={g.bogieFrame} material={mats.ironLight} position-x={(BOGIE[0] + BOGIE[1]) / 2} />
      {M(g.frames, mats.iron)}
      {M(g.footplate, mats.iron, true)}
      {M(g.beam, mats.beam)}
      {M(g.buffers, mats.steel)}
      {M(g.hook, mats.iron)}
      {M(g.splashers, mats.iron, true)}
      {M(g.boiler, mats.iron, true)}
      {M(g.bands, mats.brass)}
      {M(g.firebox, mats.iron, true)}
      {M(g.smokebox, mats.ironLight, true)}
      {M(g.door, mats.ironLight)}
      {M(g.doorFittings, mats.steel)}
      {M(g.chimney, mats.iron, true)}
      {M(g.dome, mats.brass, true)}
      {M(g.valves, mats.brass)}
      {M(g.whistle, mats.brass)}
      {M(g.sandboxes, mats.iron)}
      {M(g.handrails, mats.steel)}
      {M(g.headlamp, mats.iron)}
      {M(g.lens, mats.lamp)}
      {M(g.cylinders, mats.ironLight, true)}
      {M(g.slidebars, mats.steel)}
      {M(g.cab, mats.iron, true)}
      {M(g.cabWindows, mats.glass)}
      {M(g.cabRoof, mats.roof, true)}
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={(m) => void (coupling.current[i] = m)} geometry={g.coupling} material={mats.steel} />
          <mesh ref={(m) => void (connecting.current[i] = m)} geometry={g.connecting} material={mats.steel} />
          <mesh ref={(m) => void (crosshead.current[i] = m)} geometry={g.crosshead} material={mats.steel} />
        </group>
      ))}
    </group>
  )
}

/** The tender: a six-wheeled coal-and-water tender with flared coal rails and a heaped load. */
export function Tender({ x, length, shadows }: { x: number; length: number; shadows: boolean }) {
  const R = 0.5
  const axles = [-1.75, 0, 1.75]
  const wheels = useRef<(Mesh | null)[]>([])
  const g = useMemo(() => {
    const geos: Record<string, BufferGeometry> = {}
    geos.wheel = wheelset(R, 0.838, { spokes: 10 })
    geos.frames = mergeGeometries([-1.0, 1.0].flatMap((z) => [new BoxGeometry(length - 0.3, 0.42, 0.08).translate(0, RAIL_TOP + R + 0.05, z), ...axles.map((ax) => new BoxGeometry(0.28, 0.3, 0.18).translate(ax, RAIL_TOP + R, z))]))!
    geos.tank = new BoxGeometry(length, 1.75, 2.85).translate(0, 2.1, 0)
    geos.flare = mergeGeometries([-1.47, 1.47].map((z) => new BoxGeometry(length * 0.7, 0.32, 0.06).rotateX(z > 0 ? -0.35 : 0.35).translate(-0.6, 3.1, z)))!
    geos.trim = mergeGeometries([new BoxGeometry(length + 0.04, 0.06, 2.9).translate(0, 2.98, 0), new BoxGeometry(length + 0.04, 0.08, 2.9).translate(0, 1.25, 0)])!
    // Coal: a heap of lumps (deterministic) rising toward the front of the bunker.
    const lumps: BufferGeometry[] = []
    let seed = 3
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 46; i++) {
      const lx = -length * 0.42 + r() * length * 0.62
      const lz = (r() - 0.5) * 2.4
      const ly = 2.98 + 0.12 + (1 - Math.abs(lz) / 1.3) * 0.32 * (0.6 + r() * 0.4)
      lumps.push(new SphereGeometry(0.18 + r() * 0.16, 6, 5).scale(1, 0.6, 1).translate(lx, ly, lz))
    }
    geos.coal = mergeGeometries(lumps)!
    lumps.forEach((l) => l.dispose())
    geos.filler = new CylinderGeometry(0.28, 0.28, 0.14, 14).translate(length * 0.36, 3.05, 0)
    geos.buffers = mergeGeometries([-0.85, 0.85].map((z) => new CylinderGeometry(0.12, 0.14, 0.4, 12).rotateZ(Math.PI / 2).translate(-length / 2 - 0.15, 1.18, z)))!
    return geos
  }, [length])
  useEffect(() => () => Object.values(g).forEach((geo) => geo.dispose()), [g])

  const lastAngle = useRef(Number.NaN)
  useFrame(() => {
    const a = LAND_UNIFORMS.uOffset.value / R
    if (a === lastAngle.current) return
    lastAngle.current = a
    wheels.current.forEach((m) => m && (m.rotation.z = -a))
  })

  const iron = diorama(IRON)
  return (
    <group position={[x, 0, 0]}>
      {axles.map((ax, i) => (
        <mesh key={ax} ref={(m) => void (wheels.current[i] = m)} geometry={g.wheel} material={iron} position={[ax, RAIL_TOP + R, 0]} />
      ))}
      <mesh geometry={g.frames} material={diorama(IRON_LIGHT)} />
      <mesh geometry={g.tank} material={iron} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={g.flare} material={iron} castShadow={shadows} />
      <mesh geometry={g.trim} material={diorama(BRASS)} />
      <mesh geometry={g.coal} material={diorama('#2b2a26')} />
      <mesh geometry={g.filler} material={diorama(IRON_LIGHT)} />
      <mesh geometry={g.buffers} material={diorama(STEEL)} />
    </group>
  )
}

/** The chimney's world position for the smoke (relative to the locomotive's x). */
export const CHIMNEY = { dx: 4.65, y: BOILER_Y + 0.72 + 0.86 }
