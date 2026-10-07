import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { GEO } from '@/data/geo/geo'
import { PALETTE } from '@/scenes/world/layout'
import { buildInkGeometry, createInkMaterial, type InkStroke } from '@/scenes/shared/ink'
import { openingState } from '@/scenes/openingCurves'

/**
 * Scene 03 — the boundary as ink, not a UI line (spec §09). Punjab and Bengal draw on together
 * (inkSpread), with a wide faint bleed underneath that blooms while the ink is wet.
 * No line is drawn through Jammu & Kashmir (build-geo cuts the west line at the state boundary).
 */
export function PartitionInk() {
  const { core, bleed } = useMemo(() => {
    const lines = [...GEO.borderWest, ...GEO.borderEast]
    const stroke = (width: number, alpha: number): InkStroke[] =>
      lines.map((points) => ({ points, width, color: PALETTE.charcoal, alpha, window: [0, 1] as [number, number] }))
    return { core: buildInkGeometry({ strokes: stroke(0.2, 0.92) }), bleed: buildInkGeometry({ strokes: stroke(0.95, 0.16) }) }
  }, [])
  const coreMat = useMemo(() => createInkMaterial(), [])
  const bleedMat = useMemo(() => createInkMaterial(), [])

  useEffect(
    () => () => {
      core.dispose()
      bleed.dispose()
      coreMat.dispose()
      bleedMat.dispose()
    },
    [core, bleed, coreMat, bleedMat],
  )

  useFrame(() => {
    const s = openingState(cinematic.get().timeline, frame.progress)
    // The line stays on the ground as the station rises on it — fainter, like an old mark.
    const keep = 1 - s.ground * 0.55
    coreMat.uniforms.uT.value = s.ink
    coreMat.uniforms.uOpacity.value = keep
    bleedMat.uniforms.uT.value = s.ink
    bleedMat.uniforms.uOpacity.value = s.inkBleed * keep
  })

  return (
    <group position-y={0.01}>
      <mesh geometry={bleed} material={bleedMat} renderOrder={1} rotation-x={0} />
      <mesh geometry={core} material={coreMat} renderOrder={2} />
    </group>
  )
}
