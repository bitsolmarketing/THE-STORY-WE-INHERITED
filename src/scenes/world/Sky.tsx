import { useEffect, useMemo } from 'react'
import { BackSide, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { srgbVec3 } from '@/engine/assets/color'
import { LIGHT, PALETTE } from './layout'

/**
 * A paper sky: parchment haze at the horizon rising to soft white, with a warm glow toward the
 * afternoon sun. Only ever seen at human scale (the opening camera looks down at the map before).
 */
export function Sky() {
  const geometry = useMemo(() => new SphereGeometry(700, 32, 16), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSun: { value: new Vector3(...LIGHT.sunDirection).normalize() },
          cHorizon: { value: srgbVec3(PALETTE.parchment) },
          cZenith: { value: srgbVec3(PALETTE.softWhite) },
          cGlow: { value: srgbVec3('#f3e6c8') },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          uniform vec3 uSun, cHorizon, cZenith, cGlow;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 col = mix(cHorizon, cZenith, smoothstep(0.0, 0.45, h));
            float s = max(dot(normalize(vDir), uSun), 0.0);
            col = mix(col, cGlow, pow(s, 6.0) * 0.55);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
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
  return <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />
}
