import { ShaderMaterial, Vector2, Vector3, Vector4, type Texture } from 'three'
import { srgbVec3 } from '@/engine/assets/color'
import { PALETTE } from '@/scenes/world/layout'

/**
 * The opening's one surface (spec §07–09, ARCHITECTURE §5): paper → map → partition → ground.
 * Computed in display (sRGB) space, no colorspace_fragment (see CONVENTIONS → Colour).
 *
 *  - paper: ivory with parchment mottling; grain + fibres from a tiled height/normal texture,
 *    lit by a raking light so the sheet feels dimensional
 *  - darkness: the prologue's dim room with a soft pool of light (never pure black)
 *  - map: outline ink (dust becomes ink), then detail soaking in through a noisy front (never a crossfade)
 *  - emboss: "1947" pressed into the sheet, relief only
 *  - wash: the two wings of the new state, faint olive
 *  - split: map fragments on either side of the line drift by a hair
 *  - ground: the map becomes the earth the station stands on
 */
const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uGrainTex;
  uniform sampler2D uMapTex;
  uniform sampler2D uStateTex;
  uniform sampler2D uEmbossTex;
  uniform float uHasMap;
  uniform vec4 uMapRect;      // x0, z0, size
  uniform vec4 uEmbossRect;   // cx, cz, w, h
  uniform vec3 uLight;
  uniform vec2 uPool;         // centre of the prologue's pool of light (world XZ)
  uniform vec2 uRevealCenter;
  uniform float uDark, uCoast, uReveal, uRevealEdge, uEmboss, uWash, uSplit, uGround, uRelief, uScroll;
  uniform vec3 uFogColor;
  uniform float uFogNear, uFogFar, uFogAmount;
  uniform vec3 cIvory, cParch, cSand, cTaupe, cCharcoal, cOlive, cSage, cBrass, cSoft;
  varying vec3 vWorld;

  void main() {
    vec2 wp = vWorld.xz;
    // The earth slides under the still train during Departure (map lookups stay put).
    vec2 gp = wp + vec2(uScroll, 0.0);

    // Paper.
    // Grain scale follows the viewing distance a little, so the sheet reads as paper at map scale
    // and at the camera's closest without turning into stucco.
    float view = clamp(length(vWorld - cameraPosition) / 60.0, 0.15, 3.0);
    vec4 g1 = texture2D(uGrainTex, gp / (2.2 * view + 0.6));
    vec4 g2 = texture2D(uGrainTex, gp / (13.0 * view + 2.0) + 0.37);
    float h = g1.r * 0.6 + g2.r * 0.4;
    vec3 n = normalize(vec3((g1.g - 0.5) * 0.35 + (g2.g - 0.5) * 0.3, 1.0, (g1.b - 0.5) * 0.35 + (g2.b - 0.5) * 0.3));
    float stain = texture2D(uGrainTex, gp / 140.0 + 0.11).a;
    vec3 col = mix(cIvory, cParch, smoothstep(0.35, 0.95, stain) * 0.42 + (1.0 - h) * 0.07);

    // Map.
    vec2 muv = (wp - uMapRect.xy) / uMapRect.z;
    float inMap = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0) * uHasMap;
    vec4 st = texture2D(uStateTex, muv) * inMap;
    vec2 shift = vec2((st.g * 2.0 - 1.0) * -0.0014 * uSplit, -0.0004 * uSplit * st.g);
    vec4 m = texture2D(uMapTex, muv + shift) * inMap;
    float edgeFade = smoothstep(0.0, 0.07, muv.x) * smoothstep(1.0, 0.93, muv.x) * smoothstep(0.0, 0.07, muv.y) * smoothstep(1.0, 0.93, muv.y);
    m *= edgeFade;

    // paperReveal: a noisy front soaks outward from the subcontinent's centre.
    float rn = texture2D(uGrainTex, wp / 23.0).r * 0.6 + texture2D(uGrainTex, wp / 71.0).a * 0.4;
    float field = length(wp - uRevealCenter) / 95.0 * 0.78 + rn * 0.34;
    float front = uReveal * 1.16;
    float revealMask = 1.0 - smoothstep(front - uRevealEdge * 0.5, front, field);

    float keepMap = 1.0 - uGround * 0.82;
    col = mix(col, mix(cParch, cSand, 0.18), m.b * revealMask * 0.42 * keepMap);
    col = mix(col, mix(cSage, cOlive, 0.3), st.r * uWash * 0.36 * keepMap);
    float ink = clamp(m.r * uCoast + m.g * revealMask * 0.92, 0.0, 1.0) * keepMap;
    vec3 inkCol = mix(cCharcoal, cBrass * 0.62, 0.16);
    col = mix(col, inkCol, ink * 0.84);

    // Map becomes earth.
    float soil = texture2D(uGrainTex, gp / 11.0 + 0.5).a;
    vec3 earth = mix(cSand, cTaupe, soil * 0.55 + g1.r * 0.22);
    col = mix(col, earth, uGround * 0.86);

    // Emboss: relief only.
    vec2 euv = (wp - (uEmbossRect.xy - uEmbossRect.zw * 0.5)) / uEmbossRect.zw;
    if (uEmboss > 0.001 && euv.x > 0.0 && euv.x < 1.0 && euv.y > 0.0 && euv.y < 1.0) {
      float e = texture2D(uEmbossTex, euv).r;
      float ex = texture2D(uEmbossTex, euv + vec2(0.0025, 0.0)).r - texture2D(uEmbossTex, euv - vec2(0.0025, 0.0)).r;
      float ez = texture2D(uEmbossTex, euv + vec2(0.0, 0.006)).r - texture2D(uEmbossTex, euv - vec2(0.0, 0.006)).r;
      n = normalize(n + vec3(-ex, 0.0, -ez) * 14.0 * uEmboss);
      col = mix(col, col * 0.955, e * uEmboss * 0.5);
    }

    // Raking light across the sheet.
    float lambert = dot(n, normalize(uLight));
    col *= mix(1.0, 0.9 + 0.12 * lambert, uRelief);

    // Prologue darkness: a dim room, one soft pool of light.
    float pool = 1.0 - smoothstep(10.0, 120.0, length(wp - uPool));
    vec3 dim = col * mix(0.16, 0.42, pool) + cCharcoal * 0.07;
    col = mix(col, dim, uDark);

    // Haze toward the horizon (human scale only).
    float d = length(vWorld - cameraPosition);
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, d) * uFogAmount);

    gl_FragColor = vec4(col, 1.0);
  }
`

export interface PaperUniformTextures {
  grain: Texture
  map?: Texture
  state?: Texture
  emboss?: Texture
}

export function createPaperMaterial(): ShaderMaterial {
  const c = (hex: string) => ({ value: srgbVec3(hex) })
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uGrainTex: { value: null },
      uMapTex: { value: null },
      uStateTex: { value: null },
      uEmbossTex: { value: null },
      uHasMap: { value: 0 },
      uMapRect: { value: new Vector4() },
      uEmbossRect: { value: new Vector4() },
      uLight: { value: new Vector3(0.3, 0.8, 0.2) },
      uPool: { value: new Vector2() },
      uRevealCenter: { value: new Vector2() },
      uDark: { value: 0 },
      uCoast: { value: 0 },
      uReveal: { value: 0 },
      uRevealEdge: { value: 0.1 },
      uEmboss: { value: 0 },
      uWash: { value: 0 },
      uSplit: { value: 0 },
      uGround: { value: 0 },
      uRelief: { value: 1 },
      uScroll: { value: 0 },
      // Same haze as the world's scene.fog (WorldScene), so ground and cut-outs fade together.
      uFogColor: c(PALETTE.parchment),
      uFogNear: { value: 30 },
      uFogFar: { value: 230 },
      uFogAmount: { value: 0 },
      cIvory: c(PALETTE.ivory),
      cParch: c(PALETTE.parchment),
      cSand: c(PALETTE.sandstone),
      cTaupe: c(PALETTE.taupe),
      cCharcoal: c(PALETTE.charcoal),
      cOlive: c(PALETTE.olive),
      cSage: c(PALETTE.sage),
      cBrass: c(PALETTE.brass),
      cSoft: c(PALETTE.softWhite),
    },
  })
}
