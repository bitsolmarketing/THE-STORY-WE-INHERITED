import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, ExtrudeGeometry, NormalBlending, Path, PlaneGeometry, SRGBColorSpace, ShaderMaterial, Shape, type Group, type Material, type Mesh, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { frame, cinematic } from '@/engine/store/cinematicStore'
import { srgbVec3 } from '@/engine/assets/color'
import { rng } from '@/scenes/shared/sampleLines'
import { INTERIOR, PALETTE, TRAIN } from './layout'
import { diorama } from './materials'
import { instanced } from './build'
import { LAND_UNIFORMS } from './landscapeMaterial'
import type { Detail } from './silhouettes'
import { CarriageInterior } from './CarriageInterior'
import { CHIMNEY, Locomotive, Tender } from './Locomotive'
import { RAIL_TOP, ROOF, ROOF_BASE, arcRoof, bogieFrame, coachSideTexture, interiorWallTexture, roofArc, ventilator, wheelset } from './trainKit'

/**
 * Scene 06 — the train (spec §12): a North Western Railway broad-gauge train of 1947, as in the
 * archive's refugee-train photographs: varnished teak coaches with beaded panels, small barred
 * windows and louvred shutters, footboards, arched roofs with ventilators (crowded with people and
 * bundles), four-wheel bogies, "N.W.R." on the side, a 4-6-0 locomotive and its tender. Two solid
 * coaches and one hollow coach the camera enters through the open door. An illustration (the
 * caption says so), never a photograph.
 *
 * The train never moves: during Departure the world slides past it (WorldScene), so the camera
 * can sit still. Its wheels turn and its rods work with the distance travelled, and the coaches
 * ride the rail joints with a slight rock — all pure functions of the scroll.
 */
const C = TRAIN.carriage
const BODY_H = 2.75
const carriageX = (i: number) => TRAIN.firstCarriageX + i * (C.length + C.gap)
/** The window the seated camera looks through (it frames the departing landscape). */
const WINDOW = { w: INTERIOR.window.width, h: INTERIOR.window.height, y: INTERIOR.window.y - TRAIN.floorY }
/** Every other window: a small compartment window of the period, barred, with a louvred shutter. */
const SMALL = { w: 0.8, h: 0.84 }
const HERO_X = INTERIOR.window.x - carriageX(1)
const DOOR_X = TRAIN.door.x - carriageX(1)
const windowXs = Array.from({ length: 9 }, (_, i) => HERO_X + (i - 6) * 1.9).filter((x) => Math.abs(x) < C.length / 2 - 0.8)
const isHero = (wx: number, withDoor: boolean) => !withDoor && Math.abs(wx - HERO_X) < 0.01
const nearDoor = (wx: number) => Math.abs(wx - DOOR_X) < (WINDOW.w + TRAIN.door.width) / 2 + 0.15
/** Painted doors on the solid coaches (one at the west end, where the window spacing leaves room). */
const SOLID_DOORS = [-8.45]
/** Bogie centres and the wheelbase of the four-wheel bogies. */
const BOGIES = [-6.65, 6.65]
const WHEELBASE = 1.5
const WHEEL_R = 0.46
/** The roof sits so that its underside meets the wall tops (no gap of daylight at the cornice). */
const ROOF_Y = ROOF_BASE

function letteringTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#d9c99d'
  ctx.font = '600 92px "Cormorant Garamond", Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '18px'
  ctx.fillText('N.W.R.', 256, 68)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function wallGeometry(withDoor: boolean, depth = 0.08): BufferGeometry {
  const s = new Shape()
  s.moveTo(-C.length / 2, 0)
  s.lineTo(C.length / 2, 0)
  s.lineTo(C.length / 2, BODY_H)
  s.lineTo(-C.length / 2, BODY_H)
  s.closePath()
  if (withDoor) {
    const d = new Path()
    d.moveTo(DOOR_X - TRAIN.door.width / 2, 0.02)
    d.lineTo(DOOR_X + TRAIN.door.width / 2, 0.02)
    d.lineTo(DOOR_X + TRAIN.door.width / 2, TRAIN.door.height)
    d.lineTo(DOOR_X - TRAIN.door.width / 2, TRAIN.door.height)
    d.closePath()
    s.holes.push(d)
  }
  for (const wx of windowXs) {
    if (withDoor && nearDoor(wx)) continue
    const { w, h: hh } = isHero(wx, withDoor) ? WINDOW : SMALL
    const h = new Path()
    h.moveTo(wx - w / 2, WINDOW.y - hh / 2)
    h.lineTo(wx + w / 2, WINDOW.y - hh / 2)
    h.lineTo(wx + w / 2, WINDOW.y + hh / 2)
    h.lineTo(wx - w / 2, WINDOW.y + hh / 2)
    h.closePath()
    s.holes.push(h)
  }
  return new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 })
}

/** Map a texture across an extruded wall's caps (shape coordinates are metres). */
function capMapped(t: Texture): Texture {
  t.repeat.set(1 / C.length, 1 / BODY_H)
  t.offset.set(0.5, 0)
  return t
}

export function Train({ shadows, detail = 2 }: { shadows: boolean; detail?: Detail }) {
  const rocking = useRef<Group>(null)
  const wheelMeshes = useRef<(Mesh | null)[]>([])

  const parts = useMemo(() => {
    const small = windowXs.map((x) => ({ x, w: SMALL.w, h: SMALL.h }))
    // Painted sides: one per solid coach (each weathered a little differently), and the hollow coach's two walls.
    const solidSides = [0, 2].map((i) => coachSideTexture({ length: C.length, height: BODY_H, windows: small, windowY: WINDOW.y, doors: SOLID_DOORS, seed: 11 + i * 17 }))
    const nearSide = capMapped(coachSideTexture({ length: C.length, height: BODY_H, windows: small.filter((w) => !nearDoor(w.x)), windowY: WINDOW.y, doors: [], openDoor: DOOR_X, seed: 29 }))
    const farSide = capMapped(coachSideTexture({ length: C.length, height: BODY_H, windows: windowXs.map((x) => (Math.abs(x - HERO_X) < 0.01 ? { x, w: WINDOW.w, h: WINDOW.h } : { x, w: SMALL.w, h: SMALL.h })), windowY: WINDOW.y, doors: [], seed: 41 }))
    const inside = capMapped(interiorWallTexture(C.length, BODY_H, WINDOW.y, WINDOW.h))
    const lettering = letteringTexture()

    const solidBody = new BoxGeometry(C.length, BODY_H, C.width - 0.02).translate(0, BODY_H / 2, 0)
    const sidePlane = new PlaneGeometry(C.length, BODY_H).translate(0, BODY_H / 2, 0)
    // The far side faces −Z: flip its UVs so the painting runs the same way as the coach.
    const sidePlaneBack = sidePlane.clone().rotateY(Math.PI)
    const uv = sidePlaneBack.attributes.uv as BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
    const roof = arcRoof(C.length + 0.25)
    const rainStrip = mergeGeometries([-1, 1].map((s) => new BoxGeometry(C.length, 0.03, 0.04).translate(0, roofArc(1.55) + ROOF.thick + 0.02, s * 1.55)))!
    const endWall = new BoxGeometry(0.1, BODY_H, C.width).translate(0, BODY_H / 2, 0)
    const footboard = mergeGeometries([-1, 1].map((s) => new BoxGeometry(C.length - 1.4, 0.05, 0.28).translate(0, 0, s * (C.width / 2 + 0.16))))!
    // Underframe: solebars, trussing and the brake cylinder's box.
    const underframe = mergeGeometries([
      ...[-1, 1].map((s) => new BoxGeometry(C.length - 0.4, 0.28, 0.08).translate(0, -0.14, s * 1.45)),
      ...[-1, 1].map((s) => new BoxGeometry(8.5, 0.05, 0.05).translate(0, -0.55, s * 1.1)),
      new BoxGeometry(0.9, 0.35, 0.6).translate(1.5, -0.4, 0),
    ])!
    const bufferGeo = mergeGeometries([-1, 1].flatMap((end) => [-0.85, 0.85].flatMap((z) => [new CylinderGeometry(0.11, 0.13, 0.38, 10).rotateZ(Math.PI / 2).translate(end * (C.length / 2 + 0.19), -0.1, z), new CylinderGeometry(0.19, 0.19, 0.04, 14).rotateZ(Math.PI / 2).translate(end * (C.length / 2 + 0.39), -0.1, z)])))!
    const windowPane = new BoxGeometry(SMALL.w, SMALL.h * 0.58, 0.02)
    const louvre = new BoxGeometry(SMALL.w, SMALL.h * 0.42, 0.03)
    const winBar = new BoxGeometry(0.025, SMALL.h, 0.025)
    const letterPlane = new PlaneGeometry(1.7, 0.42)

    const solids = [0, 2].map((i) => carriageX(i))
    const allCoaches = [0, 1, 2].map((i) => carriageX(i))
    const sideZ = (side: number, off = 0.012) => side * (C.width / 2 + off)
    const winY = TRAIN.floorY + WINDOW.y
    const panes = solids.flatMap((cx) => windowXs.flatMap((wx) => [-1, 1].map((side) => ({ x: cx + wx, y: winY + SMALL.h * 0.21, z: sideZ(side) }))))
    const louvres = solids.flatMap((cx) => windowXs.flatMap((wx) => [-1, 1].map((side) => ({ x: cx + wx, y: winY - SMALL.h * 0.29, z: sideZ(side, 0.016) }))))
    // Bars on every small window, solid coaches and the hollow one alike (never across the door).
    const barred = allCoaches.flatMap((cx, ci) =>
      windowXs.flatMap((wx) =>
        [-1, 1].flatMap((side) => {
          if (ci === 1 && side === -1 && Math.abs(wx - HERO_X) < 0.01) return []
          if (ci === 1 && side === 1 && nearDoor(wx)) return []
          return [-0.24, 0, 0.24].map((dx) => ({ x: cx + wx + dx, y: winY, z: sideZ(side, 0.03) }))
        }),
      ),
    )
    // Torpedo ventilators along the roof crown, staggered either side.
    const vents = allCoaches.flatMap((cx) => Array.from({ length: 7 }, (_, k) => ({ x: cx - 7.2 + k * 2.4, y: TRAIN.floorY + ROOF_Y + ROOF.rise + ROOF.thick - 0.02, z: k % 2 ? 0.35 : -0.35 })))

    // Hollow carriage: walls with real openings; inside faces get the compartment's own paint.
    const farWall = wallGeometry(false)
    const nearWall = wallGeometry(true)
    const farLining = wallGeometry(false, 0.004)
    const nearLining = wallGeometry(true, 0.004)
    // Window frames inside the hero window: a sill and side mouldings.
    const heroFrame = mergeGeometries([
      new BoxGeometry(WINDOW.w + 0.2, 0.06, 0.16).translate(HERO_X, WINDOW.y - WINDOW.h / 2 - 0.03, 0),
      new BoxGeometry(WINDOW.w + 0.2, 0.05, 0.1).translate(HERO_X, WINDOW.y + WINDOW.h / 2 + 0.025, 0),
      ...[-1, 1].map((s) => new BoxGeometry(0.06, WINDOW.h + 0.1, 0.1).translate(HERO_X + s * (WINDOW.w / 2 + 0.03), WINDOW.y, 0)),
    ])!
    const heroBar = new BoxGeometry(0.03, WINDOW.h, 0.03)

    // Bogies and wheelsets.
    const bogieGeo = bogieFrame(WHEELBASE, WHEEL_R).translate(0, RAIL_TOP, 0)
    const bogies = allCoaches.flatMap((cx) => BOGIES.map((bx) => ({ x: cx + bx, y: 0, z: 0 })))
    const wheelGeo = wheelset(WHEEL_R, 0.838, { spokes: 10 })
    const wheelXs = allCoaches.flatMap((cx) => BOGIES.flatMap((bx) => [-WHEELBASE / 2, WHEELBASE / 2].map((dx) => cx + bx + dx)))

    // Tender and locomotive, ahead (+X) of the last carriage.
    const TENDER_L = 5.6
    const tenderX = carriageX(2) + C.length / 2 + C.gap + TENDER_L / 2
    const locoX = tenderX + TENDER_L / 2 + 0.5 + TRAIN.locomotiveLength / 2

    return {
      textures: { solidSides, nearSide, farSide, inside, lettering },
      solidBody,
      sidePlane,
      sidePlaneBack,
      roof,
      rainStrip,
      endWall,
      footboard,
      underframe,
      bufferGeo,
      letterPlane,
      solids,
      allCoaches,
      panes: instanced(windowPane, diorama('#24261f'), panes),
      louvres: instanced(louvre, diorama('#54462f'), louvres),
      bars: instanced(winBar, diorama(PALETTE.charcoal), barred),
      vents: instanced(ventilator(), diorama('#5d5b52'), vents),
      bogies: instanced(bogieGeo, diorama('#4a4a42'), bogies, { shadows }),
      wheelGeo,
      wheelXs,
      farWall,
      nearWall,
      farLining,
      nearLining,
      heroFrame,
      heroBar,
      tender: { x: tenderX, length: TENDER_L },
      locoX,
    }
  }, [shadows])

  useEffect(
    () => () => {
      const geos: BufferGeometry[] = [parts.solidBody, parts.sidePlane, parts.sidePlaneBack, parts.roof, parts.rainStrip, parts.endWall, parts.footboard, parts.underframe, parts.bufferGeo, parts.letterPlane, parts.wheelGeo, parts.farWall, parts.nearWall, parts.farLining, parts.nearLining, parts.heroFrame, parts.heroBar]
      geos.forEach((g) => g.dispose())
      for (const im of [parts.panes, parts.louvres, parts.bars, parts.vents, parts.bogies]) im.geometry.dispose()
      const t = parts.textures
      ;[...t.solidSides, t.nearSide, t.farSide, t.inside, t.lettering].forEach((x) => x.dispose())
    },
    [parts],
  )

  // Wheels turn with the distance travelled; the coaches ride the rail joints (every 13 m) with a
  // slight rock. Reduced motion keeps the turning wheels but not the rocking.
  const lastTravel = useRef(Number.NaN)
  useFrame(() => {
    const travel = LAND_UNIFORMS.uOffset.value
    if (travel === lastTravel.current) return
    lastTravel.current = travel
    const a = travel / WHEEL_R
    wheelMeshes.current.forEach((m) => m && (m.rotation.z = -a))
    const g = rocking.current
    if (!g) return
    const still = cinematic.get().reducedMotion || travel <= 0
    const joint = (travel / 13) % 1
    const bump = Math.exp(-((joint - 0.02) ** 2) / 0.0006) + 0.6 * Math.exp(-((joint - 0.13) ** 2) / 0.0006)
    g.position.y = still ? 0 : Math.sin(travel * 0.9) * 0.006 + bump * 0.008
    g.rotation.x = still ? 0 : Math.sin(travel * 0.37) * 0.0022
  })

  const t = parts.textures
  const floorY = TRAIN.floorY
  const hollowX = carriageX(1)
  const teak = diorama('#735f43')
  const teakDark = diorama('#54462f')
  const roofMat = diorama('#8a8274')
  const iron = diorama(PALETTE.charcoal)

  return (
    <group>
      <group ref={rocking}>
        {/* Solid carriages: a body and two painted sides. */}
        {parts.solids.map((cx, i) => (
          <group key={cx} position={[cx, floorY, 0]}>
            <mesh geometry={parts.solidBody} material={teak} castShadow={shadows} receiveShadow={shadows} />
            <mesh geometry={parts.sidePlane} material={diorama('#ffffff', { map: t.solidSides[i] })} position-z={C.width / 2 + 0.002} />
            <mesh geometry={parts.sidePlaneBack} material={diorama('#ffffff', { map: t.solidSides[i] })} position-z={-C.width / 2 - 0.002} />
          </group>
        ))}
        {/* What every coach shares: footboards, an arched roof, ventilators, buffers, the company's letters. */}
        {parts.allCoaches.map((cx) => (
          <group key={`trim${cx}`} position={[cx, floorY, 0]}>
            <mesh geometry={parts.footboard} material={teakDark} position-y={-0.32} />
            <mesh geometry={parts.roof} material={roofMat} position-y={ROOF_Y} castShadow={shadows} receiveShadow={shadows} />
            <mesh geometry={parts.rainStrip} material={teakDark} position-y={ROOF_Y} />
            <mesh geometry={parts.underframe} material={iron} />
            <mesh geometry={parts.bufferGeo} material={diorama('#8a8a82')} />
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                geometry={parts.letterPlane}
                material={diorama('#ffffff', { map: t.lettering })}
                position={[-4.6, 0.48, side * (C.width / 2 + 0.008)]}
                rotation-y={side > 0 ? 0 : Math.PI}
              />
            ))}
          </group>
        ))}
        <primitive object={parts.panes} />
        <primitive object={parts.louvres} />
        <primitive object={parts.bars} />
        <primitive object={parts.vents} />

        {/* The hollow carriage the camera enters. */}
        <group position={[hollowX, floorY, 0]}>
          <mesh geometry={parts.farWall} material={diorama('#ffffff', { map: t.farSide })} position-z={-C.width / 2} castShadow={shadows} />
          <mesh geometry={parts.farLining} material={diorama('#ffffff', { map: t.inside })} position-z={-C.width / 2 + 0.081} />
          <mesh geometry={parts.nearWall} material={diorama('#ffffff', { map: t.nearSide })} position-z={C.width / 2 - 0.08} castShadow={shadows} />
          <mesh geometry={parts.nearLining} material={diorama('#ffffff', { map: t.inside })} position-z={C.width / 2 - 0.085} />
          <mesh geometry={parts.endWall} material={teak} position-x={-C.length / 2} />
          <mesh geometry={parts.endWall} material={teak} position-x={C.length / 2} />
          <mesh geometry={parts.heroFrame} material={diorama('#5a4630')} position-z={-C.width / 2 + 0.1} />
          {[-0.39, -0.13, 0.13, 0.39].map((dx) => (
            <mesh key={dx} geometry={parts.heroBar} material={iron} position={[HERO_X + dx, WINDOW.y, -C.width / 2 + 0.04]} />
          ))}
          <CarriageInterior length={C.length - 0.1} width={C.width} height={BODY_H} bays={windowXs} heroX={HERO_X} doorX={DOOR_X} shadows={shadows} detail={detail} />
        </group>

        {/* Bogies and their wheelsets. */}
        <primitive object={parts.bogies} />
        {parts.wheelXs.map((x, i) => (
          <mesh key={x} ref={(m) => void (wheelMeshes.current[i] = m)} geometry={parts.wheelGeo} material={iron} position={[x, RAIL_TOP + WHEEL_R, 0]} />
        ))}
      </group>

      <Tender x={parts.tender.x} length={parts.tender.length} shadows={shadows} />
      <Locomotive x={parts.locoX} shadows={shadows} />
      <Smoke x={parts.locoX + CHIMNEY.dx} y={CHIMNEY.y} />
    </group>
  )
}

/**
 * Locomotive smoke: soft particles drifting up and back, dark and dense as they leave the chimney,
 * thinning to a pale haze. Ambient (clock-driven) when idle motion is allowed; when the train
 * departs, the plume streams back along the carriages.
 */
function Smoke({ x, y }: { x: number; y: number }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const count = cinematic.get().quality.smokeCount
  const { geometry, material } = useMemo(() => {
    const r = rng(7)
    const seed = new Float32Array(count)
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) seed[i] = r()
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: 1 },
        uTravel: { value: 0 },
        uOrigin: { value: [x, y, 0] },
        cYoung: { value: srgbVec3('#5f5b52') },
        cOld: { value: srgbVec3('#d8d0c0') },
        uAlpha: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uPx, uTravel;
        uniform vec3 uOrigin;
        varying float vA;
        varying float vAge;
        void main() {
          float age = fract(aSeed * 7.31 + uTime * (0.07 + aSeed * 0.05));
          vec3 p = uOrigin;
          p.y += age * (9.0 - uTravel * 5.0) + sin(aSeed * 40.0) * 0.4 * age;
          p.x -= age * (3.0 + uTravel * 26.0) + aSeed * 0.6 * age;
          p.z += sin(aSeed * 91.0 + age * 3.0) * (0.25 + age * 3.0);
          vA = (1.0 - age) * smoothstep(0.0, 0.06, age);
          vAge = age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (34.0 + age * 190.0) * uPx / max(1.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 cYoung, cOld;
        uniform float uAlpha;
        varying float vA;
        varying float vAge;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          // A billow, not a disc: a lumpy edge from the point's own angle.
          float lump = 0.06 * sin(atan(q.y, q.x) * 5.0 + vAge * 9.0);
          float a = smoothstep(0.5 + lump, 0.05, d) * vA * mix(0.55, 0.26, vAge) * uAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(mix(cYoung, cOld, smoothstep(0.0, 0.55, vAge)), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
    return { geometry: g, material: mat }
  }, [count, x, y])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const { quality, timeline } = cinematic.get()
    const u = material.uniforms
    if (quality.idleMotion) u.uTime.value = frame.time
    else u.uTime.value = frame.progress * 40
    u.uPx.value = dpr
    const opening = timeline.sceneLocal(frame.progress, 'opening')
    u.uTravel.value = Math.max(0, Math.min(1, (opening - timeline.chapterRange('departure').start) / 0.05))
    // Smoke only once the locomotive stands.
    u.uAlpha.value = Math.min(1, Math.max(0, (opening - timeline.chapterRange('migration').end) / 0.03))
  })

  return <points geometry={geometry} material={material as Material} frustumCulled={false} renderOrder={6} />
}
