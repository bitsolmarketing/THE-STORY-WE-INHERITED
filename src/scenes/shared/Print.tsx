import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ShaderMaterial, Vector2, type Group, type Mesh, type Texture } from 'three'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { srgbVec3 } from '@/engine/assets/color'
import { ease, seg } from '@/engine/progress/ranges'
import { PALETTE } from '@/scenes/world/layout'
import type { MaterialClass } from '@/data/archive/types'
import { acquireTexture, releaseTexture } from './textureCache'

/** The minimum a print needs (an ArchiveAsset or a FilmPrint both satisfy it). */
export interface PrintAsset {
  id: string
  filmPath?: string
  filmHiPath?: string
  width?: number
  height?: number
  year: number
  materialClass: MaterialClass
  eventIds: string[]
}

/**
 * An archival photograph as a physical print lying on the paper (imageReveal, spec §21):
 * white border, contact shadow, and the image "developing" out of the paper as it appears.
 * Historical black-and-white prints get a warm duotone in the shader (the file is never altered).
 * Clicking a print opens the archive on that record, with its full source and rights.
 */
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap, uReveal, uOpacity, uTone, uLift, uBorder, uMargin, uWipe, uWipeMode, uGrainAmt;
  uniform vec2 uPhoto;
  uniform vec3 cPaper, cIvory, cParch, cInk;
  varying vec2 vUv;
  float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  void main() {
    vec2 total = uPhoto + vec2(2.0 * (uBorder + uMargin));
    vec2 p = (vUv - 0.5) * total;
    vec2 halfPrint = uPhoto * 0.5 + uBorder;
    // Masked reveals: unfold (the print opens from its top edge like folded paper) or shutter
    // (a railway-carriage window blind opening from the middle). Soft edged, never a hard wipe.
    if (uWipeMode > 0.5) {
      float k = uWipeMode < 1.5 ? (halfPrint.y - p.y) / (2.0 * halfPrint.y) : abs(p.y) / halfPrint.y;
      float edge = uWipeMode < 1.5 ? uWipe * 1.08 : uWipe * 1.06;
      if (k > edge) discard;
    }
    float sd = sdBox(p - vec2(0.12, -0.2) * (0.4 + uLift), halfPrint);
    float shadow = (1.0 - smoothstep(-0.05, uMargin * (0.7 + uLift), sd)) * 0.3 * uOpacity;
    float pd = sdBox(p, halfPrint);
    if (pd > 0.0) {
      if (shadow < 0.004) discard;
      gl_FragColor = vec4(cInk, shadow);
      return;
    }
    vec3 col = mix(cPaper, cIvory, 0.35);
    vec2 puv = (p + uPhoto * 0.5) / uPhoto;
    if (all(greaterThanEqual(puv, vec2(0.0))) && all(lessThanEqual(puv, vec2(1.0)))) {
      vec3 img = uHasMap > 0.5 ? texture2D(uMap, puv).rgb : cParch;
      float lum = dot(img, vec3(0.299, 0.587, 0.114));
      // A warm silver print: shadows are warm charcoal on paper, never black; mids open slightly.
      vec3 duo = mix(mix(cInk, cParch, 0.14), cIvory, pow(smoothstep(0.0, 1.0, lum), 0.8));
      img = mix(img, mix(img, cParch, 0.1), step(0.5, uTone) * (1.0 - lum) * 0.5);
      img = mix(img, duo, uTone);
      // One shared silver grain over every print (display only; the file is never altered), fixed
      // to the print so it never crawls. It unifies restored and modern images into one exhibition
      // and keeps enlarged originals from reading as smooth digital surfaces.
      vec2 gp = floor(puv * vec2(1400.0, 1400.0 * uPhoto.y / uPhoto.x));
      float g = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      img += g * uGrainAmt * (0.6 + 0.4 * (1.0 - abs(lum - 0.5) * 2.0));
      // Develop: contrast and density rise out of the paper.
      float dev = uReveal * uHasMap;
      img = mix(cParch, img, smoothstep(0.0, 1.0, dev));
      col = img;
    }
    // Edge of the paper print catches the light.
    col *= 1.0 - 0.06 * smoothstep(-0.25, 0.0, pd);
    gl_FragColor = vec4(col, uOpacity);
  }
`

export interface PrintProps {
  asset: PrintAsset
  /** World position of the print centre (on the surface). */
  position: [number, number, number]
  /** Rotation about Y (radians): which way the top of the image faces. */
  yaw?: number
  /** Photo width in world units (height follows the image aspect). */
  width: number
  /** 0..1 visibility for the current frame (pure function of progress). */
  visibility: (p: number) => number
  renderOrder?: number
  /** How the print arrives on the table (all variations on the 2005 frame's "develop"). */
  reveal?: PrintReveal
}

/**
 * develop  the image rises out of the paper while the print lifts a hair (the reference)
 * slide    pushed onto the table from the side, like a photograph passed across a desk
 * drop     set down from above, settling with a last small turn
 * unfold   opens from its top edge, as a folded document is opened
 * shutter  opens from the middle, like a carriage window blind
 */
export type PrintReveal = 'develop' | 'slide' | 'drop' | 'unfold' | 'shutter'

export function Print({ asset, position, yaw = 0, width, visibility, renderOrder = 6, reveal = 'develop' }: PrintProps) {
  const aspect = asset.width && asset.height ? asset.height / asset.width : 0.75
  const photo = useMemo(() => new Vector2(width, width * aspect), [width, aspect])
  const border = width * 0.045
  const margin = width * 0.12
  const total: [number, number] = [photo.x + 2 * (border + margin), photo.y + 2 * (border + margin)]
  const group = useRef<Group>(null)
  const inner = useRef<Mesh>(null)
  const [texture, setTexture] = useState<Texture | null>(null)
  const historical = asset.year < 1990 && asset.materialClass === 'historical'

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uMap: { value: null },
          uHasMap: { value: 0 },
          uReveal: { value: 0 },
          uOpacity: { value: 0 },
          uTone: { value: historical ? 0.9 : 0.42 },
          uLift: { value: 0 },
          uWipe: { value: 1 },
          uGrainAmt: { value: historical ? 0.045 : 0.022 },
          uWipeMode: { value: 0 },
          uBorder: { value: border },
          uMargin: { value: margin },
          uPhoto: { value: photo },
          cPaper: { value: srgbVec3(PALETTE.softWhite) },
          cIvory: { value: srgbVec3(PALETTE.ivory) },
          cParch: { value: srgbVec3(PALETTE.parchment) },
          cInk: { value: srgbVec3(PALETTE.charcoal) },
        },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      }),
    [border, margin, photo, historical],
  )

  useEffect(() => {
    // High tier: the 2048 px print, so a cutaway that fills the screen stays sharp on dense displays.
    const url = cinematic.get().quality.tier === 'high' && asset.filmHiPath ? asset.filmHiPath : asset.filmPath
    if (!url) return
    let alive = true
    acquireTexture(url).then((t) => alive && setTexture(t))
    return () => {
      alive = false
      releaseTexture(url)
    }
  }, [asset.filmPath, asset.filmHiPath])

  useEffect(() => {
    material.uniforms.uMap.value = texture
    material.uniforms.uHasMap.value = texture ? 1 : 0
  }, [texture, material])

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const v = visibility(frame.progress)
    const u = material.uniforms
    // Reduced motion: every reveal becomes a still fade-and-develop (no travel, no masks).
    const mode = cinematic.get().reducedMotion ? 'develop' : reveal
    const arrive = ease.outCubic(seg(v, 0, 0.7))
    u.uOpacity.value = ease.outQuad(seg(v, 0, mode === 'unfold' || mode === 'shutter' ? 0.15 : 0.35))
    u.uReveal.value = ease.outCubic(seg(v, 0.15, 1))
    u.uLift.value = Math.sin(Math.PI * Math.min(1, v)) * 0.6
    u.uWipeMode.value = mode === 'unfold' ? 1 : mode === 'shutter' ? 2 : 0
    u.uWipe.value = mode === 'unfold' || mode === 'shutter' ? ease.inOutSine(seg(v, 0.02, 0.75)) : 1
    const g = group.current
    if (g) {
      g.visible = v > 0.002
      g.position.y = position[1] + u.uLift.value * 0.04 + (mode === 'drop' ? (1 - arrive) * width * 0.9 : 0)
      g.rotation.y = yaw + (mode === 'drop' ? (1 - arrive) * 0.14 : 0)
    }
    const mesh = inner.current
    // Slide: travels in along the image's own horizontal, from the side away from the spine.
    if (mesh) mesh.position.x = mode === 'slide' ? -(1 - arrive) * width * 0.55 : 0
  })

  return (
    <group ref={group} position={position} rotation-y={yaw}>
      <mesh
        ref={inner}
        rotation-x={-Math.PI / 2}
        material={material}
        renderOrder={renderOrder}
        onClick={(e) => {
          e.stopPropagation()
          cinematic.get().openArchive({ focusId: asset.id, eventId: asset.eventIds[0] ?? null })
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={total} />
      </mesh>
    </group>
  )
}
