import { useEffect, useMemo } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CylinderGeometry, DoubleSide, MeshBasicMaterial, AdditiveBlending, PlaneGeometry, Color, CanvasTexture, LinearFilter, SRGBColorSpace, type Group } from 'three'
import { WORLD_UNIFORMS } from './materials'
import { PALETTE, PLATFORM, TRACK } from './layout'
import { diorama } from './materials'
import { instanced, range } from './build'

/**
 * Scene 04 — the station rises out of the Punjab: platform, broad-gauge track, cast-iron columns,
 * a roof of light and shade, brass lanterns and a platform board that names no city.
 * Every repeated piece is instanced (draw calls stay in the tens).
 */
export function Station({ shadows }: { shadows: boolean }) {
  const parts = useMemo(() => {
    const platformLen = PLATFORM.xMax - PLATFORM.xMin
    const platformW = PLATFORM.zMax - PLATFORM.zMin
    const cx = (PLATFORM.xMin + PLATFORM.xMax) / 2
    const cz = (PLATFORM.zMin + PLATFORM.zMax) / 2

    const platformGeo = new BoxGeometry(platformLen, PLATFORM.y, platformW).translate(0, PLATFORM.y / 2, 0)
    const copingGeo = new BoxGeometry(platformLen, 0.06, 0.42).translate(0, 0.03, 0)
    const edgeLineGeo = new BoxGeometry(platformLen, 0.005, 0.07)

    // Track: ballast bed, sleepers, two rails per line; a second line on the far side.
    const trackLen = TRACK.xMax - TRACK.xMin
    const ballastGeo = new BoxGeometry(trackLen, 0.12, 3.2).translate(0, 0.06, 0)
    const sleeperGeo = new BoxGeometry(0.24, 0.08, 2.5).translate(0, 0.04, 0)
    const railGeo = new BoxGeometry(trackLen, 0.11, 0.07).translate(0, 0.055, 0)
    // The far line (z −4.6) belongs to the scrolling landscape; this one stays under the train.
    const lines = [0]
    const sleepers = lines.flatMap((z) => range(TRACK.xMin, TRACK.xMax, TRACK.sleeperSpacing).map((x) => ({ x, y: 0.12, z })))
    const rails = lines.flatMap((z) => [z - TRACK.gauge / 2, z + TRACK.gauge / 2].map((rz) => ({ x: (TRACK.xMin + TRACK.xMax) / 2, y: 0.12, z: rz })))

    // Cast-iron columns with a bracket head, along the platform.
    const columnH = PLATFORM.roofY - PLATFORM.y
    const columnGeo = new CylinderGeometry(0.09, 0.12, columnH, 10).translate(0, columnH / 2, 0)
    const capitalGeo = new BoxGeometry(0.5, 0.18, 0.5).translate(0, 0.09, 0)
    const columnXs = range(PLATFORM.xMin + 3, PLATFORM.xMax - 3, PLATFORM.columnSpacing)
    const columns = columnXs.map((x) => ({ x, y: PLATFORM.y, z: PLATFORM.columnZ }))
    const capitals = columnXs.map((x) => ({ x, y: PLATFORM.roofY - 0.18, z: PLATFORM.columnZ }))

    // Roof: a long canopy with open slats so the sun falls through in bars.
    const roofW = platformW + 0.6
    const beamGeo = new BoxGeometry(0.18, 0.22, roofW).translate(0, 0.11, 0)
    const slatGeo = new BoxGeometry(platformLen, 0.05, 0.62).translate(0, 0.025, 0)
    const beams = range(PLATFORM.xMin + 0.5, PLATFORM.xMax - 0.5, 3.5).map((x) => ({ x, y: PLATFORM.roofY, z: cz + 0.2 }))
    const slats = range(PLATFORM.zMin - 0.1, PLATFORM.zMax + 0.4, 0.95).map((z) => ({ x: cx, y: PLATFORM.roofY + 0.22, z }))
    const fasciaGeo = new BoxGeometry(platformLen, 0.5, 0.06).translate(0, 0.25, 0)

    // Brass lanterns hanging between columns.
    const lanternGeo = new CylinderGeometry(0.11, 0.08, 0.32, 8).translate(0, 0.16, 0)
    const chainGeo = new BoxGeometry(0.015, 0.7, 0.015).translate(0, 0.35, 0)
    const lanternXs = columnXs.slice(0, -1).map((x) => x + PLATFORM.columnSpacing / 2)
    const lanterns = lanternXs.map((x) => ({ x, y: PLATFORM.roofY - 1.0, z: PLATFORM.columnZ - 1.2 }))
    const chains = lanternXs.map((x) => ({ x, y: PLATFORM.roofY - 0.7, z: PLATFORM.columnZ - 1.2 }))

    return {
      platform: { geo: platformGeo, x: cx, z: cz },
      coping: { geo: copingGeo, x: cx, z: PLATFORM.zMin + 0.21 },
      edgeLine: { geo: edgeLineGeo, x: cx, z: PLATFORM.zMin + 0.55 },
      ballast: lines.map((z) => ({ geo: ballastGeo, x: (TRACK.xMin + TRACK.xMax) / 2, z })),
      sleepers: instanced(sleeperGeo, diorama(PALETTE.taupe), sleepers),
      rails: instanced(railGeo, diorama(PALETTE.charcoal), rails),
      columns: instanced(columnGeo, diorama('#4a4d44'), columns, { shadows }),
      capitals: instanced(capitalGeo, diorama('#4a4d44'), capitals, { shadows }),
      beams: instanced(beamGeo, diorama(PALETTE.olive), beams, { shadows }),
      slats: instanced(slatGeo, diorama('#56594f'), slats, { shadows }),
      fascia: { geo: fasciaGeo, x: cx },
      lanterns: instanced(lanternGeo, diorama(PALETTE.brass, { glow: 0.35 }), lanterns),
      chains: instanced(chainGeo, diorama(PALETTE.charcoal), chains),
    }
  }, [shadows])

  // Platform board: no city is named — this platform stands for many (spec: generic sign).
  const board = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#E8DDCA'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#3C3B36'
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, 496, 112)
    ctx.fillStyle = '#3C3B36'
    ctx.font = '500 54px "Cormorant Garamond", Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '10px'
    ctx.fillText('PLATFORM  No. 2', 256, 68)
    const t = new CanvasTexture(c)
    t.minFilter = LinearFilter
    t.colorSpace = SRGBColorSpace
    return t
  }, [])

  // Sun shafts: a few additive planes slanting through the slats (very low intensity).
  const shaft = useMemo(
    () => ({
      geo: new PlaneGeometry(0.55, 7.5),
      mat: new MeshBasicMaterial({ color: new Color(PALETTE.softWhite).multiplyScalar(0.035), blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide }),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(parts).forEach((v) => {
        if (Array.isArray(v)) v.forEach((b) => b.geo.dispose())
        else if ('geo' in v) v.geo.dispose()
        else v.geometry.dispose()
      })
      board.dispose()
      shaft.geo.dispose()
      shaft.mat.dispose()
    },
    [parts, board, shaft],
  )

  // The board and the light shafts are not cut-outs: they appear once the station stands.
  const late = useRef<Group>(null)
  useFrame(() => {
    if (late.current) late.current.visible = WORLD_UNIFORMS.uRise.value > 0.97
  })

  const cz = (PLATFORM.zMin + PLATFORM.zMax) / 2
  return (
    <group>
      <mesh geometry={parts.platform.geo} material={diorama(PALETTE.sandstone)} position={[parts.platform.x, 0, parts.platform.z]} receiveShadow />
      <mesh geometry={parts.coping.geo} material={diorama(PALETTE.parchment)} position={[parts.coping.x, PLATFORM.y, parts.coping.z]} receiveShadow />
      <mesh geometry={parts.edgeLine.geo} material={diorama(PALETTE.softWhite)} position={[parts.edgeLine.x, PLATFORM.y + 0.002, parts.edgeLine.z]} />
      {parts.ballast.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={diorama('#c9b99f')} position={[b.x, 0, b.z]} receiveShadow />
      ))}
      <primitive object={parts.sleepers} />
      <primitive object={parts.rails} />
      <primitive object={parts.columns} />
      <primitive object={parts.capitals} />
      <primitive object={parts.beams} />
      <primitive object={parts.slats} />
      <mesh geometry={parts.fascia.geo} material={diorama(PALETTE.olive)} position={[parts.fascia.x, PLATFORM.roofY - 0.25, PLATFORM.zMin - 0.2]} castShadow={shadows} />
      <primitive object={parts.lanterns} />
      <primitive object={parts.chains} />
      <group ref={late}>
        {/* Board hangs from the canopy, facing the arriving camera (−X). */}
        <group position={[2.5, PLATFORM.roofY - 1.1, 6.6]} rotation-y={Math.PI / 2}>
          <mesh>
            <planeGeometry args={[2.4, 0.6]} />
            <meshLambertMaterial map={board} side={DoubleSide} />
          </mesh>
        </group>
        {[-6, 9, 24, 39].map((x) => (
          <mesh key={x} geometry={shaft.geo} material={shaft.mat} position={[x, 3.6, cz + 0.6]} rotation={[0.2, 0.55, 0.62]} />
        ))}
      </group>
    </group>
  )
}
