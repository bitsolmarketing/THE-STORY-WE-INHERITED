import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Fog, type DirectionalLight, type Group, Object3D } from 'three'
import { cinematic, frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { openingState } from '@/scenes/openingCurves'
import { LANDSCAPE, LIGHT, PALETTE } from './layout'
import { WORLD_UNIFORMS, disposeDioramaMaterials } from './materials'
import { LAND_UNIFORMS, disposeLandscapeMaterials } from './landscapeMaterial'
import { Station } from './Station'
import { Crowd } from './Crowd'
import { Protagonist } from './Protagonist'
import { Train } from './Train'
import { Landscape } from './Landscape'
import { Sky } from './Sky'

/**
 * Scenes 04–07 — "the world rises out of the paper": the station on the Punjab, the crowd,
 * the traveller, the train, and the land sliding past the window. Paper cut-outs in palette
 * colours, one warm afternoon sun, parchment haze. The train stays still; the world moves.
 */
const FOG_COLOR = PALETTE.parchment

export function WorldScene() {
  const quality = useCinematicStore((s) => s.quality)
  const scene = useThree((s) => s.scene)
  const root = useRef<Group>(null)
  const station = useRef<Group>(null)
  const sun = useRef<DirectionalLight>(null)
  const shadows = quality.shadows
  // Figure detail by tier: near-quality models on high, mid on medium, coarse on low.
  const detail = quality.tier === 'high' ? 2 : quality.tier === 'medium' ? 1 : 0

  useEffect(() => {
    const prev = scene.fog
    const fog = new Fog(new Color(FOG_COLOR), 30, 230)
    scene.fog = fog
    // Light target sits on the platform, where shadows matter.
    const target = new Object3D()
    target.position.set(18, 0, 3)
    scene.add(target)
    if (sun.current) sun.current.target = target
    return () => {
      scene.fog = prev
      scene.remove(target)
      disposeDioramaMaterials()
      disposeLandscapeMaterials()
    }
  }, [scene])

  useFrame(() => {
    const { timeline } = cinematic.get()
    const s = openingState(timeline, frame.progress)
    WORLD_UNIFORMS.uRise.value = s.rise
    WORLD_UNIFORMS.uPeople.value = s.people
    // The people's idle life (breathing, glances): only when idle motion is allowed.
    const { quality: q, reducedMotion } = cinematic.get()
    const live = q.idleMotion && !reducedMotion
    if (live) WORLD_UNIFORMS.uTime.value = frame.time
    WORLD_UNIFORMS.uIdle.value = live ? 1 : 0
    const offset = s.travel * LANDSCAPE.travelDistance
    LAND_UNIFORMS.uOffset.value = offset
    if (station.current) station.current.position.x = -offset
    if (root.current) root.current.visible = s.rise > 0.002
    // Haze only at human scale: push the fog away while the camera is still above the map.
    const fog = scene.fog as Fog | null
    if (fog) {
      fog.near = 30 + (1 - s.haze) * 2000
      fog.far = 230 + (1 - s.haze) * 4000
    }
    if (sun.current) sun.current.castShadow = shadows && s.rise > 0.98
  })

  const [sx, sy, sz] = LIGHT.sunDirection
  return (
    <group ref={root}>
      <Sky />
      <ambientLight intensity={1.75} color={PALETTE.parchment} />
      <directionalLight
        ref={sun}
        position={[18 + sx * 80, sy * 80, 3 + sz * 80]}
        intensity={1.9}
        color={LIGHT.sunColor}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <group ref={station}>
        <Station shadows={shadows} />
        <Crowd where="platform" count={quality.crowdCount} luggage={quality.luggageCount} shadows={shadows} detail={detail} />
        <Protagonist shadows={shadows} />
      </group>
      <Train shadows={shadows} detail={detail} />
      <Crowd where="roof" count={Math.round(quality.crowdCount * 0.22)} luggage={0} shadows={shadows} detail={detail} />
      <Landscape density={quality.landscapeDensity} />
    </group>
  )
}
