import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, type Group } from 'three'
import { srgbVec3 } from '@/engine/assets/color'
import { PALETTE } from '@/scenes/world/layout'
import { spineFrame, spinePoint, type ChronicleLayout } from './layout'
import { RAIL } from './railway'

/**
 * A period train on the chronicle's railway: a broad-gauge steam locomotive, its tender and three
 * teak coaches of the 1940s, seen from above like a model on a surveyor's table. It is a design
 * element (drawn here, never a photograph) and it travels with the film: always a little ahead of
 * the frame the camera rests on, pulling the line into the next year.
 *
 * It lies flat on the paper and renders beneath the photographs and labels, so it can pass under a
 * frame but never cover one.
 */

/** World units along the track. */
const VEHICLES = [
  { kind: 'loco', length: 1.55 },
  { kind: 'tender', length: 0.85 },
  { kind: 'coach', length: 1.65 },
  { kind: 'coach', length: 1.65 },
  { kind: 'coach', length: 1.65 },
] as const
const GAP = 0.09
const WIDTH = 0.62
/** How far ahead of the camera's focus the locomotive's buffers run (clear of the frame's prints). */
const LEAD = 12.4
/** Spacing of the smoke puffs left along the line, and how long (in track distance) each lingers. */
const PUFF_STEP = 0.75
const PUFF_LIFE = 3.6

const PX = 160 // canvas pixels per world unit
const PAD = 14

type Kind = (typeof VEHICLES)[number]['kind']
const SPRITES: Record<Kind, { x0: number; len: number }> = {
  loco: { x0: 0, len: 1.55 },
  tender: { x0: 1.55, len: 0.85 },
  coach: { x0: 2.4, len: 1.65 },
}
const ATLAS_LEN = 1.55 + 0.85 + 1.65

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** Teak, iron and roof tones, mixed only from the palette. */
const TONE = {
  iron: PALETTE.charcoal,
  ironLight: mixHex(PALETTE.charcoal, PALETTE.taupe, 0.3),
  frame: mixHex(PALETTE.charcoal, PALETTE.taupe, 0.45),
  teak: mixHex(PALETTE.brass, PALETTE.charcoal, 0.42),
  teakDark: mixHex(PALETTE.brass, PALETTE.charcoal, 0.62),
  roof: mixHex(PALETTE.taupe, PALETTE.charcoal, 0.28),
  roofRib: mixHex(PALETTE.taupe, PALETTE.charcoal, 0.45),
  brass: PALETTE.brass,
  coal: mixHex(PALETTE.charcoal, PALETTE.taupe, 0.12),
}

function drawAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.ceil(ATLAS_LEN * PX + PAD * 6)
  c.height = Math.ceil(WIDTH * PX + PAD * 2)
  const ctx = c.getContext('2d')!
  const W = WIDTH * PX
  const y0 = PAD
  const cy = y0 + W / 2

  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }
  const shadow = (x: number, len: number) => {
    ctx.save()
    ctx.filter = 'blur(5px)'
    ctx.fillStyle = 'rgba(60,59,54,0.28)'
    rr(x + 5, y0 + 7, len, W - 2, 10)
    ctx.fill()
    ctx.restore()
  }

  // ── Locomotive (front to the right) ─────────────────────────────────────────────────────────
  {
    const x = PAD + SPRITES.loco.x0 * PX
    const L = SPRITES.loco.len * PX
    shadow(x, L)
    ctx.fillStyle = TONE.frame
    rr(x, y0 + W * 0.06, L, W * 0.88, 6)
    ctx.fill()
    // Cab (rear) with a brass-lined roof.
    ctx.fillStyle = TONE.iron
    rr(x + 2, y0, L * 0.27, W, 8)
    ctx.fill()
    ctx.strokeStyle = TONE.brass
    ctx.lineWidth = 2
    rr(x + 8, y0 + 6, L * 0.27 - 12, W - 12, 6)
    ctx.stroke()
    // Boiler: a cylinder lit along its crown.
    const bx = x + L * 0.27
    const bl = L * 0.7
    const bw = W * 0.56
    const g = ctx.createLinearGradient(0, cy - bw / 2, 0, cy + bw / 2)
    g.addColorStop(0, TONE.iron)
    g.addColorStop(0.45, TONE.ironLight)
    g.addColorStop(1, TONE.iron)
    ctx.fillStyle = g
    rr(bx, cy - bw / 2, bl, bw, bw / 2)
    ctx.fill()
    ctx.strokeStyle = TONE.brass
    ctx.lineWidth = 2.5
    for (const k of [0.18, 0.46, 0.74]) {
      ctx.beginPath()
      ctx.moveTo(bx + bl * k, cy - bw / 2 + 2)
      ctx.lineTo(bx + bl * k, cy + bw / 2 - 2)
      ctx.stroke()
    }
    // Steam dome (brass), safety valve, chimney (front).
    ctx.fillStyle = TONE.brass
    ctx.beginPath()
    ctx.arc(bx + bl * 0.42, cy, bw * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(bx + bl * 0.12, cy, bw * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = TONE.iron
    ctx.strokeStyle = TONE.frame
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(bx + bl * 0.86, cy, bw * 0.24, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Buffer beam and buffers.
    ctx.fillStyle = TONE.teakDark
    ctx.fillRect(x + L - 7, y0 + W * 0.08, 7, W * 0.84)
    ctx.fillStyle = TONE.brass
    for (const k of [0.2, 0.8]) {
      ctx.beginPath()
      ctx.arc(x + L, y0 + W * k, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── Tender: coal heaped in the bunker ───────────────────────────────────────────────────────
  {
    const x = PAD * 3 + SPRITES.tender.x0 * PX
    const L = SPRITES.tender.len * PX
    shadow(x, L)
    ctx.fillStyle = TONE.iron
    rr(x, y0 + 2, L, W - 4, 7)
    ctx.fill()
    ctx.fillStyle = TONE.coal
    rr(x + 10, y0 + 12, L * 0.62, W - 24, 5)
    ctx.fill()
    // Lumps of coal: a deterministic stipple.
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    ctx.fillStyle = TONE.ironLight
    for (let i = 0; i < 90; i++) {
      ctx.beginPath()
      ctx.arc(x + 14 + rnd() * (L * 0.62 - 8), y0 + 16 + rnd() * (W - 32), 1.2 + rnd() * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = TONE.brass
    ctx.beginPath()
    ctx.arc(x + L * 0.84, cy, W * 0.11, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Coach: teak body, arched roof with rain strips, ribs and torpedo ventilators ────────────
  {
    const x = PAD * 5 + SPRITES.coach.x0 * PX
    const L = SPRITES.coach.len * PX
    shadow(x, L)
    ctx.fillStyle = TONE.teak
    rr(x, y0, L, W, 6)
    ctx.fill()
    const g = ctx.createLinearGradient(0, y0 + 6, 0, y0 + W - 6)
    g.addColorStop(0, TONE.roofRib)
    g.addColorStop(0.5, TONE.roof)
    g.addColorStop(1, TONE.roofRib)
    ctx.fillStyle = g
    rr(x + 6, y0 + 6, L - 12, W - 12, 12)
    ctx.fill()
    ctx.strokeStyle = TONE.roofRib
    ctx.lineWidth = 1.2
    for (let k = x + 20; k < x + L - 14; k += 18) {
      ctx.beginPath()
      ctx.moveTo(k, y0 + 8)
      ctx.lineTo(k, y0 + W - 8)
      ctx.stroke()
    }
    // Rain strips along both eaves.
    ctx.strokeStyle = TONE.teakDark
    ctx.lineWidth = 2
    for (const k of [0.2, 0.8]) {
      ctx.beginPath()
      ctx.moveTo(x + 10, y0 + W * k)
      ctx.lineTo(x + L - 10, y0 + W * k)
      ctx.stroke()
    }
    ctx.fillStyle = TONE.iron
    for (let k = x + 34; k < x + L - 24; k += 44) {
      ctx.beginPath()
      ctx.ellipse(k, cy, 7, 4.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // End gangways.
    ctx.fillStyle = TONE.teakDark
    ctx.fillRect(x - 2, cy - W * 0.18, 6, W * 0.36)
    ctx.fillRect(x + L - 4, cy - W * 0.18, 6, W * 0.36)
  }
  return c
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float a = c.a * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`

/** A plane in the XZ plane whose UVs cover one sprite of the atlas (length along +X). */
function vehicleGeometry(kind: Kind, atlasW: number, atlasH: number): PlaneGeometry {
  const s = SPRITES[kind]
  const padIndex = kind === 'loco' ? 0 : kind === 'tender' ? 2 : 4
  const u0 = (PAD + padIndex * PAD + s.x0 * PX - 8) / atlasW
  const u1 = (PAD + padIndex * PAD + (s.x0 + s.len) * PX + 12) / atlasW
  const lenW = s.len + 20 / PX
  const widW = atlasH / PX
  const g = new PlaneGeometry(lenW, widW)
  g.rotateX(-Math.PI / 2)
  // Re-centre so the vehicle body (not the shadow padding) sits on the track.
  g.translate((4 / PX) * 0.5, 0, 0)
  const uv = g.attributes.uv as BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) < 0.5 ? u0 : u1)
  uv.needsUpdate = true
  return g
}

export function ChronicleTrain({ layout, focus }: { layout: ChronicleLayout; focus: () => number }) {
  const group = useRef<Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  // Portrait screens see further up the table (wider FOV) and set the year high on the screen:
  // run the train further ahead there so it never sits behind the year or the photographs.
  const lead = useThree((s) => (s.size.width / Math.max(1, s.size.height) < 0.8 ? LEAD + 7 : LEAD))

  const { texture, material, geometries } = useMemo(() => {
    const canvas = drawAtlas()
    const tex = new CanvasTexture(canvas)
    tex.generateMipmaps = true
    tex.minFilter = LinearMipmapLinearFilter
    tex.magFilter = LinearFilter
    tex.anisotropy = 8
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uMap: { value: tex }, uOpacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
    const geos = { loco: vehicleGeometry('loco', canvas.width, canvas.height), tender: vehicleGeometry('tender', canvas.width, canvas.height), coach: vehicleGeometry('coach', canvas.width, canvas.height) }
    return { texture: tex, material: mat, geometries: geos }
  }, [])
  const meshes = useMemo(
    () =>
      VEHICLES.map((v) => {
        const m = new Mesh(geometries[v.kind], material)
        m.renderOrder = 3
        m.frustumCulled = false
        return m
      }),
    [geometries, material],
  )

  // Smoke left along the line: one puff per step of track, each a pure function of how far the
  // chimney has travelled past it (it billows, drifts aside and fades). Reverse-scrolling un-smokes.
  const smoke = useMemo(() => {
    const p = { x: 0, z: 0 }
    const f = { tx: 1, tz: 0, nx: 0, nz: 1 }
    const list: number[] = []
    const side: number[] = []
    const sAt: number[] = []
    for (let s = -RAIL.lead; s <= layout.length + RAIL.lead + LEAD + 8; s += PUFF_STEP) {
      spinePoint(s, p)
      spineFrame(s, f)
      list.push(p.x, 0.03, p.z)
      side.push(f.nx, f.nz)
      sAt.push(s)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(list), 3))
    g.setAttribute('aNormal', new BufferAttribute(new Float32Array(side), 2))
    g.setAttribute('aS', new BufferAttribute(new Float32Array(sAt), 1))
    g.computeBoundingSphere()
    const m = new ShaderMaterial({
      uniforms: { uChimney: { value: 0 }, uLife: { value: PUFF_LIFE }, uPx: { value: 1 }, cSmoke: { value: srgbVec3(PALETTE.taupe) } },
      vertexShader: /* glsl */ `
        attribute vec2 aNormal;
        attribute float aS;
        uniform float uChimney, uLife, uPx;
        varying float vA;
        void main() {
          float age = (uChimney - aS) / uLife;
          vA = age > 0.0 && age < 1.0 ? smoothstep(0.0, 0.08, age) * (1.0 - age) : 0.0;
          float drift = sin(aS * 12.9898) * 0.35 * age;
          vec3 p = position + vec3(aNormal.x, 0.0, aNormal.y) * drift;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          // Puff diameter grows from ~0.4 to ~1.3 world units (≈1400 px per unit at unit depth).
          gl_PointSize = vA > 0.0 ? (0.4 + age * 0.9) * 1400.0 * uPx / max(1.0, -mv.z) : 0.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 cSmoke;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vA * 0.32;
          if (a < 0.004) discard;
          gl_FragColor = vec4(cSmoke, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
    return { geometry: g, material: m }
  }, [layout])

  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
      Object.values(geometries).forEach((g) => g.dispose())
      smoke.geometry.dispose()
      smoke.material.dispose()
    },
    [texture, material, geometries, smoke],
  )

  const pt = useMemo(() => ({ x: 0, z: 0 }), [])
  const fr = useMemo(() => ({ tx: 1, tz: 0, nx: 0, nz: 1 }), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    // Each vehicle sits on the curve at its own centre, so the train bends with the line.
    let s = focus() + lead
    smoke.material.uniforms.uChimney.value = s - 0.2
    smoke.material.uniforms.uPx.value = dpr
    g.children.forEach((child, i) => {
      const v = VEHICLES[i]
      if (!v) return
      const mid = s - v.length / 2
      spinePoint(mid, pt)
      spineFrame(mid, fr)
      child.position.set(pt.x, 0.022, pt.z)
      child.rotation.set(0, Math.atan2(-fr.tz, fr.tx), 0)
      s -= v.length + GAP
    })
  })

  return (
    <>
      <group ref={group}>
        {meshes.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
      <points geometry={smoke.geometry} material={smoke.material} renderOrder={3} frustumCulled={false} />
    </>
  )
}
