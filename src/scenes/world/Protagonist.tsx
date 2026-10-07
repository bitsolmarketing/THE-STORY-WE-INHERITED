import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { ease, mix, seg } from '@/engine/progress/ranges'
import { PALETTE, PLATFORM, PROTAGONIST, TRAIN } from './layout'
import { diorama } from './materials'
import { protagonistGeometry } from './silhouettes'

/**
 * Scene 05 — one of the millions (spec §11). A composite, fictional civilian: a coat, a cap, a
 * suitcase in the right hand. Not a documented person. They walk only when the visitor scrolls
 * (every pose is a pure function of progress): a stride every ~0.7 m with the legs and free arm
 * swinging, then a turn to the carriage and the step up into the door.
 */
const STRIDE = 0.72

export function Protagonist({ shadows }: { shadows: boolean }) {
  const group = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const geo = useMemo(() => protagonistGeometry(), [])
  useEffect(
    () => () => {
      geo.body.dispose()
      geo.leg.dispose()
      geo.arm.dispose()
      geo.case.dispose()
    },
    [geo],
  )

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { timeline } = cinematic.get()
    const u = timeline.sceneLocal(frame.progress, 'opening')
    const walk = timeline.chapterRange('protagonist')
    const board = timeline.chapterRange('train')
    const tWalk = seg(u, walk.start - (walk.end - walk.start) * 0.15, walk.start + (walk.end - walk.start) * PROTAGONIST.reachesDoorAt)
    const tBoard = seg(u, board.start, board.start + (board.end - board.start) * 0.35)

    let x = mix(PROTAGONIST.startX, PROTAGONIST.endX, ease.inOutSine(tWalk))
    let z: number = PROTAGONIST.z
    let y: number = PLATFORM.y
    // Turn toward the door and step up into it.
    const turn = ease.inOutSine(seg(tBoard, 0, 0.5))
    const bx = mix(x, TRAIN.door.x, ease.inOutSine(tBoard))
    const bz = mix(z, TRAIN.door.z - 0.2, ease.inOutSine(seg(tBoard, 0.1, 1)))
    // Distance walked drives the stride (forward along the platform, then the few steps to the door).
    const walked = x + Math.abs(bz - z) * 1.2
    x = bx
    z = bz
    y = mix(y, TRAIN.floorY, ease.inOutSine(seg(tBoard, 0.55, 0.9)))
    const moving = (tWalk > 0 && tWalk < 1) || (tBoard > 0 && tBoard < 0.9) ? 1 : 0
    const phase = (walked / STRIDE) * Math.PI
    const swing = Math.sin(phase) * 0.42 * moving
    g.position.set(x, y + Math.abs(Math.cos(phase)) * 0.025 * moving, z)
    // Faces the way they walk (+X), then turns to the door (−Z).
    g.rotation.y = Math.PI / 2 + turn * (Math.PI / 2)
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
    if (armL.current) armL.current.rotation.x = -swing * 0.7
    g.visible = tBoard < 0.97 && u > walk.start - (walk.end - walk.start) * 0.4
  })

  const coat = diorama('#ffffff', { still: true, figure: true })
  const suitcase = diorama(PALETTE.brass, { still: true, figure: true })
  return (
    <group ref={group}>
      <mesh geometry={geo.body} material={coat} castShadow={shadows} />
      <mesh geometry={geo.case} material={suitcase} castShadow={shadows} />
      {[-1, 1].map((side) => (
        <group key={side} ref={side < 0 ? legL : legR} position={[side * geo.hipX, geo.hipY, 0]}>
          <mesh geometry={geo.leg} material={coat} castShadow={shadows} />
        </group>
      ))}
      <group ref={armL} position={geo.shoulder}>
        <mesh geometry={geo.arm} material={coat} castShadow={shadows} />
      </group>
    </group>
  )
}
