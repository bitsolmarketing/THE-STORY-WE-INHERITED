import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial } from 'three'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { srgbVec3 } from '@/engine/assets/color'
import { GEO } from '@/data/geo/geo'
import { PALETTE } from '@/scenes/world/layout'
import { openingState } from '@/scenes/openingCurves'
import { rng, sampleLines } from '@/scenes/shared/sampleLines'
import { seg } from '@/engine/progress/ranges'

/**
 * Partition → Migration on the map: small ink marks crossing the new line in BOTH directions.
 * Movement is driven by scroll (scroll = time), so people move only while the visitor moves the
 * film, and walk back when it is scrolled back. Weighted toward the Punjab, where the camera goes.
 */
export function MigrationFlows({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const geometry = useMemo(() => {
    const random = rng(1948)
    const lines = [...GEO.borderWest, ...GEO.borderEast]
    // Most movement across the Punjab (north end of the west line) and Bengal; little through the desert.
    const weight = (x: number, z: number) => (z < 6 && x > -6 ? 4 : x > 30 ? 1.6 : 0.35)
    const at = sampleLines(lines, count, random, weight)
    const from = new Float32Array(count * 3)
    const to = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const p = at[i]
      const dir = random() < 0.5 ? 1 : -1
      const near = 2 + random() * 7
      const far = 2 + random() * 7
      const along = (random() - 0.5) * 2.4
      const tx = -p.nz
      const tz = p.nx
      from[i * 3] = p.x - p.nx * near * dir + tx * along
      from[i * 3 + 1] = 0.05
      from[i * 3 + 2] = p.z - p.nz * near * dir + tz * along
      to[i * 3] = p.x + p.nx * far * dir + tx * along * 0.4
      to[i * 3 + 1] = 0.05
      to[i * 3 + 2] = p.z + p.nz * far * dir + tz * along * 0.4
      seed[i] = random()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(from, 3))
    g.setAttribute('aTo', new BufferAttribute(to, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    g.computeBoundingSphere()
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uPhase: { value: 0 }, uAlpha: { value: 0 }, uPx: { value: 1 }, cInk: { value: srgbVec3(PALETTE.charcoal) } },
        vertexShader: /* glsl */ `
          attribute vec3 aTo;
          attribute float aSeed;
          uniform float uPhase, uPx;
          varying float vA;
          void main() {
            float t = fract(aSeed + uPhase * (0.8 + aSeed * 0.5));
            vA = sin(3.14159 * t);
            vec3 p = mix(position, aTo, t);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (1.6 + aSeed * 1.4) * uPx * (130.0 / max(1.0, -mv.z));
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAlpha;
          uniform vec3 cInk;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.2, d) * vA * uAlpha;
            if (a < 0.01) discard;
            gl_FragColor = vec4(cInk, a * 0.8);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const { timeline } = cinematic.get()
    const s = openingState(timeline, frame.progress)
    const range = timeline.chapterRange('partition')
    const end = timeline.chapterRange('migration').end
    material.uniforms.uPhase.value = seg(s.u, range.start, end) * 3
    material.uniforms.uAlpha.value = s.flows
    material.uniforms.uPx.value = dpr
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />
}
