import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { CanvasTexture, DataTexture } from 'three'
import { cinematic, frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { fontsReady, markSceneReady } from '@/engine/assets/boot'
import { mix } from '@/engine/progress/ranges'
import { createGrainTexture, createEmbossTexture } from '@/scenes/shared/paperTextures'
import { EMBOSS, GROUND, LANDSCAPE, MAP, MAP_FRAMES } from '@/scenes/world/layout'
import { openingState } from '@/scenes/openingCurves'
import { createPaperMaterial } from './PaperMaterial'
import { createMapTexture, createStateTexture } from './mapCanvas'
import { Dust } from './Dust'
import { PartitionInk } from './PartitionInk'
import { MigrationFlows } from './MigrationFlows'
import { MapPrints } from './MapPrints'

interface PaperTextures {
  grain: DataTexture
  map: CanvasTexture
  state: CanvasTexture
  emboss: CanvasTexture
}

/**
 * Scenes 01–04 on one plane: darkness and dust, the outline of the land, the map, 1947 pressed
 * into the paper, the new state, the partition ink, the flows across the line — and finally the
 * ground the station stands on. Textures are painted once (after the map fonts load) and disposed.
 */
export function PaperScene() {
  const quality = useCinematicStore((s) => s.quality)
  const material = useMemo(() => createPaperMaterial(), [])
  const [textures, setTextures] = useState<PaperTextures | null>(null)

  useEffect(() => {
    let alive = true
    let made: PaperTextures | null = null
    fontsReady().then(() => {
      if (!alive) return
      made = {
        grain: createGrainTexture(quality.grainTextureSize),
        map: createMapTexture(quality.mapTextureSize),
        state: createStateTexture(1024),
        emboss: createEmbossTexture('1947'),
      }
      setTextures(made)
    })
    return () => {
      alive = false
      if (made) Object.values(made).forEach((t) => t.dispose())
    }
  }, [quality.grainTextureSize, quality.mapTextureSize])

  useEffect(() => {
    if (!textures) return
    const u = material.uniforms
    u.uGrainTex.value = textures.grain
    u.uMapTex.value = textures.map
    u.uStateTex.value = textures.state
    u.uEmbossTex.value = textures.emboss
    u.uHasMap.value = 1
    u.uMapRect.value.set(MAP.center[0] - MAP.size / 2, MAP.center[1] - MAP.size / 2, MAP.size, 0)
    u.uEmbossRect.value.set(EMBOSS.center[0], EMBOSS.center[1], EMBOSS.width, EMBOSS.height)
    u.uRevealCenter.value.set(MAP_FRAMES.subcontinent.x, MAP_FRAMES.subcontinent.z - 6)
    // Let the textures upload on the next frame, then open the curtain.
    requestAnimationFrame(() => requestAnimationFrame(() => markSceneReady()))
  }, [textures, material])

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const { timeline } = cinematic.get()
    const s = openingState(timeline, frame.progress)
    const u = material.uniforms
    u.uDark.value = s.dark
    u.uCoast.value = s.coast
    u.uReveal.value = s.reveal
    u.uRevealEdge.value = s.revealEdge
    u.uEmboss.value = s.emboss
    u.uWash.value = s.wash
    u.uSplit.value = s.split
    u.uGround.value = s.ground
    u.uLight.value.set(s.light[0], s.light[1], s.light[2])
    // The pool of light drifts slowly across the subcontinent while the dust gathers.
    u.uPool.value.set(mix(-30, 30, s.dustGather), mix(10, 40, s.dustGather))
    // Relief reads at map scale and on the ground; haze only at human scale.
    u.uFogAmount.value = s.haze
    u.uRelief.value = mix(1, 0.6, s.ground)
    u.uScroll.value = s.travel * LANDSCAPE.travelDistance
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={material} renderOrder={0}>
        <planeGeometry args={[GROUND.size, GROUND.size]} />
      </mesh>
      <PartitionInk />
      {quality.dustCount > 0 && <Dust count={quality.dustCount} />}
      <MigrationFlows count={Math.round(quality.dustCount * 0.55)} />
      <MapPrints />
    </group>
  )
}
