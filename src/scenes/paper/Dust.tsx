import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { srgbVec3 } from '@/engine/assets/color'
import { GEO } from '@/data/geo/geo'
import { PALETTE } from '@/scenes/world/layout'
import { openingState } from '@/scenes/openingCurves'
import { rng, sampleLines } from '@/scenes/shared/sampleLines'

/**
 * PROLOGUE — darkness and dust gather into the outline of the land.
 * Each mote drifts in the dim light, then settles onto a point of the coast or a frontier; the
 * outline ink appears exactly where the dust lands (PaperMaterial uCoast). Pure function of
 * progress (+ a slow drift on the clock while it is still airborne).
 */
export function Dust({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const geometry = useMemo(() => {
    const random = rng(1947)
    const targets = sampleLines([...GEO.coast, ...GEO.contextSafe], count, random, (_x, z) => (z > 88 ? 0.2 : 1))
    const start = new Float32Array(count * 3)
    const target = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      start[i * 3] = -60 + random() * 160
      start[i * 3 + 1] = 2 + random() * random() * 70
      start[i * 3 + 2] = -35 + random() * 135
      target[i * 3] = targets[i].x + (random() - 0.5) * 0.25
      target[i * 3 + 1] = 0.06
      target[i * 3 + 2] = targets[i].z + (random() - 0.5) * 0.25
      seed[i] = random()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(target, 3))
    g.setAttribute('aStart', new BufferAttribute(start, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    g.computeBoundingSphere()
    g.boundingSphere!.radius = 400
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uGather: { value: 0 },
          uAlpha: { value: 1 },
          uDark: { value: 1 },
          uTime: { value: 0 },
          uPx: { value: 1 },
          uPool: { value: new Vector2() },
          cLight: { value: srgbVec3(PALETTE.parchment) },
          cBrass: { value: srgbVec3(PALETTE.brass) },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aStart;
          attribute float aSeed;
          uniform float uGather, uTime, uPx;
          uniform vec2 uPool;
          varying float vSeed;
          varying float vSettled;
          varying float vLit;
          void main() {
            vSeed = aSeed;
            // Motes settle at slightly different moments: the outline assembles, it does not snap.
            float g = clamp((uGather - aSeed * 0.38) / 0.62, 0.0, 1.0);
            g = g * g * (3.0 - 2.0 * g);
            vSettled = g;
            vec3 drift = vec3(sin(uTime * 0.21 + aSeed * 40.0), sin(uTime * 0.17 + aSeed * 17.0) * 0.6, cos(uTime * 0.19 + aSeed * 23.0)) * (1.0 - g) * 1.8;
            vec3 p = mix(aStart + drift, position, g);
            // Dust is only seen where the light falls: motes glow inside the pool, fade outside it.
            vLit = mix(1.0 - smoothstep(14.0, 78.0, length(p.xz - uPool)), 1.0, g * g);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            // Airborne motes near the lens are soft and large; settled ones are fine grains.
            float size = mix(1.8 + aSeed * aSeed * 7.0, 1.5, g);
            gl_PointSize = size * uPx * (170.0 / max(1.0, -mv.z));
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAlpha, uDark;
          uniform vec3 cLight, cBrass;
          varying float vSeed;
          varying float vSettled;
          varying float vLit;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float a = smoothstep(0.5, 0.0, d) * mix(0.55, 1.0, vSettled);
            float twinkle = 0.45 + 0.55 * fract(vSeed * 91.7);
            vec3 col = mix(cLight, cBrass, 0.35 + vSeed * 0.5);
            gl_FragColor = vec4(col * a * twinkle * vLit * uAlpha * mix(0.55, 1.0, uDark) * 0.85, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
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
    const { timeline, quality } = cinematic.get()
    const s = openingState(timeline, frame.progress)
    const u = material.uniforms
    u.uGather.value = s.dustGather
    // Additive light only reads on the dark paper: it fades as the light comes up.
    u.uAlpha.value = s.dustAlpha * (0.25 + 0.75 * s.dark)
    u.uDark.value = s.dark
    if (quality.idleMotion) u.uTime.value = frame.time
    u.uPx.value = dpr
    // Same pool of light as the paper (PaperScene drifts it while the dust gathers).
    u.uPool.value.set(-30 + 60 * s.dustGather, 10 + 30 * s.dustGather)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
}
