import { Color, MeshLambertMaterial, type IUniform, type Texture } from 'three'

/**
 * Diorama materials: matte paper-like Lambert (palette colours display faithfully with the flat,
 * no-tone-mapping canvas; see CONVENTIONS → Colour), with a "rise" injected into the vertex
 * shader so the world folds up out of the map (mapToWorld). One shared uniform object drives
 * all of them; WorldScene writes it once per frame.
 *
 *  - architecture ('rise', world mode): world-space height is scaled, so the whole station lies
 *    flat on the map at 0 and stands at 1
 *  - people / luggage ('people', local mode, staggered): each cut-out unfolds about its own feet,
 *    one after another (per-instance `aDelay`)
 */
export const WORLD_UNIFORMS: {
  uRise: IUniform<number>
  uPeople: IUniform<number>
  /** Seconds, for the people's idle life (breathing, glances); frozen when idle motion is off. */
  uTime: IUniform<number>
  /** 0..1 amplitude of that idle life (0 under reduced motion or the low tier). */
  uIdle: IUniform<number>
} = {
  uRise: { value: 0 },
  uPeople: { value: 0 },
  uTime: { value: 0 },
  uIdle: { value: 0 },
}

/** The range of skin tones across the subcontinent, light wheat to deep brown (instance `aSkinTone` 0..1). */
const SKIN_LIGHT = new Color('#b48a63')
const SKIN_DEEP = new Color('#5b3e28')

export interface RiseOptions {
  curve?: 'rise' | 'people'
  /** Per-instance `aDelay` attribute staggers the lift (instanced meshes, local mode). */
  staggered?: boolean
  /** Opt out of rising entirely (interior, landscape: they never lie on the map). */
  still?: boolean
  /** Self-illumination 0..1 (lit windows, lamps): mixes toward the base colour unlit. */
  glow?: number
  /** Painted lettering or markings (alpha-tested), rising with the paper like everything else. */
  map?: Texture
  /**
   * Modelled figures (silhouettes.ts): vertex colours for skin, hair and shoes; the instance colour
   * dyes only the parts whose `aTint` asks for it (clothing), so a crowd varies its dress, not its skin.
   */
  figure?: boolean
}

/*
 * Figures (silhouettes.ts). Per vertex: aFig (which cloth colour dyes it, skin, part) and aPivot
 * (the joint a part turns about). Per instance: instanceColor (first cloth), aCloth2 and aLife
 * (skin tone, phase: each person keeps their own timing, so a crowd never moves in unison).
 *
 * Idle life is deliberately small and mostly still: breathing; the head holds, then now and then
 * turns to look somewhere (a window, a neighbour) and holds again; some nod as if talking; the
 * arms hang with a breath of sway. All of it is in the vertex shader: no per-frame CPU work.
 */
const FIGURE_DECL = /* glsl */ `
  // Packed: vertex attribute slots are few (16 on many GPUs; instanceMatrix alone takes 4).
  attribute vec4 aFig;
  attribute vec3 aPivot;
  #define aTint aFig.x
  #define aTint2 aFig.y
  #define aSkin aFig.z
  #define aPart aFig.w
  #ifdef USE_INSTANCING
    attribute vec3 aCloth2;
    attribute vec2 aLife;
    #define aSkinTone aLife.x
    #define aPhase aLife.y
  #endif
  uniform float uTime;
  uniform float uIdle;
  uniform vec3 uSkinLight;
  uniform vec3 uSkinDeep;
  float figHash(float n) { return fract(sin(n) * 43758.5453); }
  mat3 figRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 figRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 figPose() {
    mat3 R = mat3(1.0);
    #ifdef USE_INSTANCING
      float t = uTime * (0.82 + fract(aPhase * 13.7) * 0.36) + aPhase * 97.0;
      if (aPart > 1.5 && aPart < 2.5) {
        float k = t * 0.09;
        float s = floor(k);
        float f = fract(k);
        float a0 = figHash(s + aPhase * 31.0) - 0.5;
        float a1 = figHash(s + 1.0 + aPhase * 31.0) - 0.5;
        float yaw = mix(a0, a1, smoothstep(0.8, 1.0, f)) * 1.15;
        float talk = step(0.72, figHash(s * 3.1 + aPhase * 5.0)) * sin(t * 2.3) * 0.03;
        float nod = sin(t * 0.33) * 0.03 + talk;
        R = figRotY(yaw * uIdle) * figRotX(nod * uIdle);
      } else if (aPart > 2.5) {
        float side = aPart > 3.5 ? 1.0 : -1.0;
        R = figRotX(sin(t * 0.45 + side) * 0.025 * uIdle);
      }
    #endif
    return R;
  }
`

const FIGURE_COLOR = /* glsl */ `
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
    vColor = vec4( 1.0 );
  #endif
  #ifdef USE_COLOR
    vColor.rgb *= color.rgb;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor.xyz = mix( vColor.xyz, vColor.xyz * instanceColor.xyz, aTint );
    vColor.xyz = mix( vColor.xyz, vColor.xyz * aCloth2, aTint2 );
    vColor.xyz = mix( vColor.xyz, mix( uSkinLight, uSkinDeep, aSkinTone ), aSkin );
  #endif
`

const FIGURE_NORMAL = /* glsl */ `
  #include <beginnormal_vertex>
  mat3 figR = figPose();
  objectNormal = figR * objectNormal;
`

const FIGURE_POSE = /* glsl */ `
  transformed = figR * (transformed - aPivot) + aPivot;
  #ifdef USE_INSTANCING
    if (aPart > 0.5 && aPart < 1.5) {
      float br = sin(uTime * 1.6 * (0.82 + fract(aPhase * 13.7) * 0.36) + aPhase * 97.0) * 0.011 * uIdle;
      transformed.x *= 1.0 + br;
      transformed.z *= 1.0 + br * 1.5;
    }
  #endif
`

const cache = new Map<string, MeshLambertMaterial>()

export function diorama(hex: string, opts: RiseOptions = {}): MeshLambertMaterial {
  const key = `${hex}|${opts.curve ?? 'rise'}|${opts.staggered ? 1 : 0}|${opts.still ? 1 : 0}|${opts.glow ?? 0}|${opts.map?.uuid ?? ''}|${opts.figure ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const color = new Color(hex)
  const m = new MeshLambertMaterial({ color })
  if (opts.map) {
    m.map = opts.map
    m.alphaTest = 0.5
  }
  if (opts.glow) {
    m.emissive = color.clone()
    m.emissiveIntensity = opts.glow
  }
  if (opts.figure) m.vertexColors = true
  if (!opts.still || opts.figure) {
    const curve = opts.curve === 'people' ? 'uPeople' : 'uRise'
    const local = opts.staggered || opts.curve === 'people'
    m.onBeforeCompile = (shader) => {
      if (!opts.still) applyRise(shader)
      if (opts.figure) {
        shader.uniforms.uTime = WORLD_UNIFORMS.uTime
        shader.uniforms.uIdle = WORLD_UNIFORMS.uIdle
        shader.uniforms.uSkinLight = { value: SKIN_LIGHT }
        shader.uniforms.uSkinDeep = { value: SKIN_DEEP }
        // Pose first (inserted right after begin_vertex, so ahead of the rise), then colour.
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${FIGURE_DECL}`)
          .replace('#include <color_vertex>', FIGURE_COLOR)
          .replace('#include <beginnormal_vertex>', FIGURE_NORMAL)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FIGURE_POSE}`)
      }
    }
    const applyRise = (shader: Parameters<NonNullable<MeshLambertMaterial['onBeforeCompile']>>[0]) => {
      shader.uniforms.uRise = WORLD_UNIFORMS.uRise
      shader.uniforms.uPeople = WORLD_UNIFORMS.uPeople
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uRise;
           uniform float uPeople;
           ${opts.staggered ? 'attribute float aDelay;' : ''}`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float rk = clamp((${curve} - ${opts.staggered ? 'aDelay' : '0.0'} * 0.55) / 0.45, 0.0, 1.0);
           rk = max(rk * rk * (3.0 - 2.0 * rk), 0.001);
           ${local ? 'transformed.y *= rk;' : ''}`,
        )
      if (!local) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `vec4 wpos = vec4(transformed, 1.0);
           #ifdef USE_INSTANCING
             wpos = instanceMatrix * wpos;
           #endif
           wpos = modelMatrix * wpos;
           wpos.y *= rk;
           vec4 mvPosition = viewMatrix * wpos;
           gl_Position = projectionMatrix * mvPosition;`,
        )
      }
    }
  }
  m.customProgramCacheKey = () => key
  cache.set(key, m)
  return m
}

export function disposeDioramaMaterials(): void {
  for (const m of cache.values()) m.dispose()
  cache.clear()
}
