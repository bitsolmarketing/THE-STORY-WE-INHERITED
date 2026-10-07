import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Mesh } from 'three'
import { frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { markSceneReady } from '@/engine/assets/boot'
import { createPaperMaterial } from '@/scenes/paper/PaperMaterial'
import { createGrainTexture } from '@/scenes/shared/paperTextures'
import { buildInkGeometry, createInkMaterial } from '@/scenes/shared/ink'
import { buildChronicleLayout, focusAt } from './layout'
import { railTimeAt, railwayStrokes } from './railway'
import { YearTicks } from './YearTicks'
import { ChronicleTrain } from './ChronicleTrain'
import { Nature } from './Nature'
import { Plates } from './Plates'

/**
 * 1948 → 2026: the long paper table. One plane follows the camera (the shader works in world
 * space, so the paper never slides); the spine — a railway line — is written just ahead of the
 * camera, with a milepost for every year where the odometer reads it and a period train running on
 * it; each storyboard frame is laid beside it.
 */
export function ChronicleScene() {
  const timeline = useCinematicStore((s) => s.timeline)
  const quality = useCinematicStore((s) => s.quality)
  const layout = useMemo(() => buildChronicleLayout(timeline), [timeline])
  const camera = useThree((s) => s.camera)
  const table = useRef<Mesh>(null)
  const material = useMemo(() => createPaperMaterial(), [])
  const [grain] = useState(() => createGrainTexture(quality.grainTextureSize))

  const focus = useMemo(() => () => focusAt(timeline, layout, Math.max(frame.progress, timeline.scenes.chronicle.start)), [timeline, layout])

  // The spine is a railway line: rails, sleepers and a milepost for every year, as one ink drawing.
  const spine = useMemo(() => buildInkGeometry({ strokes: railwayStrokes(layout) }), [layout])
  const spineMat = useMemo(() => createInkMaterial(), [])

  useEffect(() => {
    const u = material.uniforms
    u.uGrainTex.value = grain
    u.uHasMap.value = 0
    u.uDark.value = 0
    u.uRelief.value = 0.85
    u.uLight.value.set(-0.45, 0.7, 0.55)
    requestAnimationFrame(() => requestAnimationFrame(() => markSceneReady()))
    return () => {
      material.dispose()
      grain.dispose()
    }
  }, [material, grain])

  useEffect(
    () => () => {
      spine.dispose()
      spineMat.dispose()
    },
    [spine, spineMat],
  )

  useFrame(() => {
    // Keep the table under the camera; snap so nothing shimmers.
    if (table.current) {
      table.current.position.x = Math.round(camera.position.x / 6.5) * 6.5
      table.current.position.z = Math.round(camera.position.z / 6.5) * 6.5
    }
    // The spine is written a little ahead of where the camera looks (time being recorded).
    const s = focus()
    spineMat.uniforms.uT.value = Math.min(1, railTimeAt(s + 26, layout))
  })

  return (
    <group>
      <mesh ref={table} rotation-x={-Math.PI / 2} material={material} renderOrder={0}>
        <planeGeometry args={[340, 340]} />
      </mesh>
      <Nature layout={layout} focus={focus} />
      <mesh geometry={spine} material={spineMat} position-y={0.012} renderOrder={2} />
      <YearTicks marks={layout.marks} focus={focus} />
      <ChronicleTrain layout={layout} focus={focus} />
      <Plates layout={layout} />
    </group>
  )
}
