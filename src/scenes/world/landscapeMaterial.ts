import { Color, MeshLambertMaterial, type IUniform } from 'three'
import { WORLD_UNIFORMS } from './materials'

/**
 * Landscape materials: like the diorama (they rise out of the map with the station), plus a
 * scroll. Departure is the world sliding past a still train (spec §13): each INSTANCE is
 * shifted by −offset and wrapped inside [min, min+span], so a few hundred cut-outs make an
 * endless Punjab and scrolling back runs it in reverse. Whole instances wrap, never split.
 */
export const LAND_UNIFORMS: { uOffset: IUniform<number> } = { uOffset: { value: 0 } }

const cache = new Map<string, MeshLambertMaterial>()

export function landscape(hex: string, min: number, span: number): MeshLambertMaterial {
  const key = `${hex}|${min}|${span}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = new MeshLambertMaterial({ color: new Color(hex) })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRise = WORLD_UNIFORMS.uRise
    shader.uniforms.uOffset = LAND_UNIFORMS.uOffset
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uRise;\nuniform float uOffset;`)
      .replace(
        '#include <project_vertex>',
        `vec4 wpos = vec4(transformed, 1.0);
         float shift = 0.0;
         #ifdef USE_INSTANCING
           wpos = instanceMatrix * wpos;
           float ix = instanceMatrix[3].x;
           shift = (${min.toFixed(2)} + mod(ix - uOffset - (${min.toFixed(2)}), ${span.toFixed(2)})) - ix;
         #endif
         wpos.x += shift;
         wpos = modelMatrix * wpos;
         float rk = clamp(uRise / 0.45 - 0.6, 0.0, 1.0);
         wpos.y *= max(rk * rk * (3.0 - 2.0 * rk), 0.001);
         vec4 mvPosition = viewMatrix * wpos;
         gl_Position = projectionMatrix * mvPosition;`,
      )
  }
  m.customProgramCacheKey = () => key
  cache.set(key, m)
  return m
}

export function disposeLandscapeMaterials(): void {
  for (const m of cache.values()) m.dispose()
  cache.clear()
}
