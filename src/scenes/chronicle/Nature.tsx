import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, InstancedBufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { cinematic, frame } from '@/engine/store/cinematicStore'
import { PALETTE } from '@/scenes/world/layout'
import { rng } from '@/scenes/shared/sampleLines'
import { CHRONICLE, spineFrame, spinePoint, type ChronicleLayout } from './layout'
import { RAIL } from './railway'

/**
 * The country the line runs through: trees, date palms, kikar, bushes and grass, ploughed fields,
 * ponds and stones, painted from above like the train on the same table (a surveyor's illustrated
 * sheet, not a map). Nature stays out of the frames' way: never on the rails, never under a frame's
 * drawing or its photographs, never across a year's numeral.
 *
 * Each piece sprouts as the line is written toward it (a pure function of progress, so scrolling
 * back un-grows it); trees stir a little in the wind when idle motion is allowed.
 */
type Kind = 'tree' | 'treeSmall' | 'palm' | 'kikar' | 'poplar' | 'bush' | 'grass' | 'field' | 'pond' | 'stones'
const CELLS: Kind[] = ['tree', 'treeSmall', 'palm', 'kikar', 'poplar', 'bush', 'grass', 'field', 'pond', 'stones']
const COLS = 5
const ROWS = 2
const CELL = 256
/** World size of each sprite (its cell maps onto a square of this size). */
const SIZE: Record<Kind, number> = { tree: 2.6, treeSmall: 1.7, palm: 2.0, kikar: 2.4, poplar: 1.5, bush: 1.1, grass: 0.7, field: 6.5, pond: 3.2, stones: 0.9 }
const SWAY: Record<Kind, number> = { tree: 1, treeSmall: 1, palm: 1.4, kikar: 0.8, poplar: 1.2, bush: 0.5, grass: 0.8, field: 0, pond: 0, stones: 0 }

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

const LEAF = mix(PALETTE.olive, PALETTE.sage, 0.35)
const LEAF_DARK = mix(PALETTE.olive, PALETTE.charcoal, 0.25)
const LEAF_LIGHT = mix(PALETTE.sage, PALETTE.parchment, 0.25)
const SHADOW = 'rgba(60,59,54,0.24)'

function drawAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = COLS * CELL
  c.height = ROWS * CELL
  const ctx = c.getContext('2d')!
  const r = rng(4)
  const cell = (k: Kind) => {
    const i = CELLS.indexOf(k)
    return { x: (i % COLS) * CELL, y: Math.floor(i / COLS) * CELL }
  }
  const blob = (cx: number, cy: number, rad: number, fill: string) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  /** A canopy lit from the upper left: shadow cast down-right, dark masses, then light on top. */
  const canopy = (k: Kind, masses: number, radius: number, spread: number, shadowLen = 1) => {
    const { x, y } = cell(k)
    const cx = x + CELL / 2
    const cy = y + CELL / 2
    const pts = Array.from({ length: masses }, () => {
      const a = r() * Math.PI * 2
      const d = r() * spread
      return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (0.6 + r() * 0.5)] as const
    })
    ctx.save()
    ctx.filter = 'blur(6px)'
    for (const [px, py, pr] of pts) blob(px + 14 * shadowLen, py + 18 * shadowLen, pr, SHADOW)
    ctx.restore()
    for (const [px, py, pr] of pts) blob(px, py, pr, LEAF_DARK)
    for (const [px, py, pr] of pts) blob(px - pr * 0.18, py - pr * 0.2, pr * 0.8, LEAF)
    for (const [px, py, pr] of pts) {
      ctx.fillStyle = LEAF_LIGHT
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.arc(px - pr * 0.35, py - pr * 0.38, pr * 0.42, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // Leaf texture: small flecks of light and dark.
    for (let i = 0; i < masses * 26; i++) {
      const [px, py, pr] = pts[i % pts.length]
      const a = r() * Math.PI * 2
      const d = r() * pr * 0.9
      blob(px + Math.cos(a) * d, py + Math.sin(a) * d, 1.5 + r() * 3, r() < 0.5 ? 'rgba(40,52,42,0.35)' : 'rgba(230,226,200,0.25)')
    }
  }
  canopy('tree', 9, 34, 46)
  canopy('treeSmall', 6, 30, 34)
  canopy('bush', 7, 22, 30, 0.6)
  // Kikar: flat, feathery, wide and thin.
  {
    const { x, y } = cell('kikar')
    const cx = x + CELL / 2
    const cy = y + CELL / 2
    ctx.save()
    ctx.filter = 'blur(5px)'
    blob(cx + 16, cy + 20, 92, 'rgba(60,59,54,0.18)')
    ctx.restore()
    for (let i = 0; i < 420; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 96
      blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 2 + r() * 4.5, r() < 0.65 ? mix(PALETTE.sage, PALETTE.olive, 0.4) : LEAF_LIGHT)
    }
  }
  // Date palm: fronds radiating from a crown, with its shadow.
  {
    const { x, y } = cell('palm')
    const cx = x + CELL / 2
    const cy = y + CELL / 2
    const fronds = 13
    for (const pass of [0, 1]) {
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI * 2 + r() * 0.2
        const len = 82 + r() * 26
        ctx.strokeStyle = pass === 0 ? 'rgba(60,59,54,0.2)' : i % 2 ? LEAF : LEAF_DARK
        ctx.lineWidth = pass === 0 ? 10 : 7
        ctx.lineCap = 'round'
        const ox = pass === 0 ? 18 : 0
        const oy = pass === 0 ? 22 : 0
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.quadraticCurveTo(cx + ox + Math.cos(a) * len * 0.6, cy + oy + Math.sin(a) * len * 0.6 - 10, cx + ox + Math.cos(a) * len, cy + oy + Math.sin(a) * len + 8)
        ctx.stroke()
        if (pass === 1) {
          // Leaflets along the frond.
          for (let t = 0.3; t < 1; t += 0.12) {
            const px = cx + Math.cos(a) * len * t
            const py = cy + Math.sin(a) * len * t
            ctx.lineWidth = 2
            ctx.strokeStyle = LEAF_LIGHT
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px + Math.cos(a + 1.2) * 12, py + Math.sin(a + 1.2) * 12)
            ctx.moveTo(px, py)
            ctx.lineTo(px + Math.cos(a - 1.2) * 12, py + Math.sin(a - 1.2) * 12)
            ctx.stroke()
          }
        }
      }
    }
    blob(cx, cy, 9, mix(PALETTE.brass, PALETTE.charcoal, 0.4))
  }
  // Poplar from above: a small dense crown and a long shadow thrown down-right.
  {
    const { x, y } = cell('poplar')
    const cx = x + CELL / 2 - 30
    const cy = y + CELL / 2 - 30
    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = 'rgba(60,59,54,0.22)'
    ctx.beginPath()
    ctx.ellipse(cx + 62, cy + 68, 92, 20, Math.PI / 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    blob(cx, cy, 30, LEAF_DARK)
    blob(cx - 6, cy - 6, 24, LEAF)
    blob(cx - 11, cy - 12, 11, LEAF_LIGHT)
  }
  // Grass: a tuft of short strokes.
  {
    const { x, y } = cell('grass')
    const cx = x + CELL / 2
    const cy = y + CELL / 2 + 30
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.6
      const len = 30 + r() * 60
      ctx.strokeStyle = r() < 0.5 ? mix(PALETTE.sage, PALETTE.olive, 0.3) : mix(PALETTE.sage, PALETTE.taupe, 0.4)
      ctx.lineWidth = 2.5 + r() * 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      const bx = cx + (r() - 0.5) * 70
      ctx.moveTo(bx, cy)
      ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.5, bx + Math.cos(a) * len + (r() - 0.5) * 16, cy + Math.sin(a) * len)
      ctx.stroke()
    }
  }
  // A field: a softly bordered rectangle of furrows (ploughed or green with young crop).
  {
    const { x, y } = cell('field')
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x + 22, y + 46, CELL - 44, CELL - 92, 10)
    ctx.clip()
    ctx.globalAlpha = 0.62
    ctx.fillStyle = mix(PALETTE.sandstone, PALETTE.sage, 0.35)
    ctx.fillRect(x, y, CELL, CELL)
    for (let fy = y + 50; fy < y + CELL - 46; fy += 7) {
      ctx.strokeStyle = r() < 0.5 ? 'rgba(62,96,79,0.32)' : 'rgba(184,168,143,0.4)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x + 22, fy)
      ctx.lineTo(x + CELL - 22, fy + (r() - 0.5) * 2)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(122,106,79,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(x + 22, y + 46, CELL - 44, CELL - 92, 10)
    ctx.stroke()
  }
  // A pond: still water with a pale rim and reeds.
  {
    const { x, y } = cell('pond')
    const cx = x + CELL / 2
    const cy = y + CELL / 2
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const rad = 82 + Math.sin(a * 3 + 1) * 12 + Math.sin(a * 5) * 6
      const px = cx + Math.cos(a) * rad
      const py = cy + Math.sin(a) * rad * 0.72
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = mix(PALETTE.parchment, PALETTE.sandstone, 0.5)
    ctx.lineWidth = 16
    ctx.strokeStyle = mix(PALETTE.parchment, PALETTE.sandstone, 0.5)
    ctx.stroke()
    const g = ctx.createRadialGradient(cx - 20, cy - 16, 10, cx, cy, 96)
    g.addColorStop(0, mix(PALETTE.sage, PALETTE.softWhite, 0.35))
    g.addColorStop(1, mix(PALETTE.sage, PALETTE.olive, 0.25))
    ctx.fillStyle = g
    ctx.fill()
    for (let i = 0; i < 28; i++) {
      const a = r() * Math.PI * 2
      const px = cx + Math.cos(a) * 88
      const py = cy + Math.sin(a) * 64
      ctx.strokeStyle = LEAF_DARK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + (r() - 0.5) * 8, py - 14 - r() * 10)
      ctx.stroke()
    }
  }
  // Stones: a few pale rounded stones with their shadows.
  {
    const { x, y } = cell('stones')
    for (let i = 0; i < 6; i++) {
      const sx = x + CELL / 2 + (r() - 0.5) * 120
      const sy = y + CELL / 2 + (r() - 0.5) * 90
      const rad = 10 + r() * 16
      blob(sx + 6, sy + 7, rad, 'rgba(60,59,54,0.22)')
      blob(sx, sy, rad, mix(PALETTE.taupe, PALETTE.parchment, 0.35))
      blob(sx - rad * 0.25, sy - rad * 0.3, rad * 0.55, mix(PALETTE.parchment, PALETTE.softWhite, 0.4))
    }
  }
  return c
}

const vertex = /* glsl */ `
  attribute vec4 aRect;
  attribute vec3 aLife;
  uniform float uGrowS;
  uniform float uTime;
  uniform float uSway;
  varying vec2 vUv;
  varying float vA;
  void main() {
    float s = aLife.x;
    float g = clamp((uGrowS - s) / 2.2, 0.0, 1.0);
    // Sprout: grow with a slight overshoot, then settle.
    float grow = g < 1.0 ? g * g * (3.0 - 2.0 * g) * (1.0 + 0.12 * sin(g * 3.14159)) : 1.0;
    vA = smoothstep(0.0, 0.35, g);
    vec3 p = position * max(grow, 0.001);
    // Wind: a slow stir of the crown about its centre (trees only).
    float a = sin(uTime * 0.7 + aLife.y * 40.0) * 0.035 * aLife.z * uSway;
    p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
    vUv = aRect.xy + uv * aRect.zw;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vA;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float a = c.a * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`

interface Piece {
  kind: Kind
  s: number
  lat: number
  scale: number
  rot: number
}

/** Where nature may not go: the rails, the frames (drawing + photographs), the year numerals. */
function blocked(layout: ChronicleLayout, s: number, lat: number, radius: number): boolean {
  if (Math.abs(lat) < RAIL.sleeperHalf + 0.45 + radius) return true
  for (const slot of layout.slots) {
    if (slot.beat.kind !== 'event') continue
    const sc = slot.sMid + 1.3
    // The frame's drawing (right of the line) stays clear; its photographs lie on top of anything
    // beneath them, so trees may stand at their edges like on a real table.
    if (Math.abs(s - sc) < 5.2 + radius && lat > -1.6 - radius * 0.5 && lat < CHRONICLE.plateLateral + 7.2 + radius) return true
  }
  for (const m of layout.marks) if (Math.abs(s - m.s) < 1.1 + radius && lat < -0.3 && lat > -3.2 - radius) return true
  return false
}

export function Nature({ layout, focus }: { layout: ChronicleLayout; focus: () => number }) {
  const density = cinematic.get().quality.landscapeDensity
  const built = useMemo(() => {
    const r = rng(1948)
    const pieces: Piece[] = []
    const place = (kind: Kind, s: number, lat: number, scale = 1) => {
      if (blocked(layout, s, lat, (SIZE[kind] * scale) / 2)) return false
      pieces.push({ kind, s, lat, scale, rot: kind === 'field' ? (r() - 0.5) * 0.25 : r() * Math.PI * 2 })
      return true
    }
    const from = -RAIL.lead
    const to = layout.length + RAIL.lead
    const step = 1 / Math.max(0.3, density)
    for (let s = from; s < to; s += 1.05 * step) {
      // Left of the line (the open side of the table): groves, single trees, fields, ponds.
      const roll = r()
      const lat = -(2.6 + r() * 10)
      if (roll < 0.06) place('field', s, lat - 3, 0.7 + r() * 0.4)
      else if (roll < 0.14) place('pond', s, lat, 0.7 + r() * 0.4)
      else if (roll < 0.3) {
        // A grove: a few trees together.
        const n = 3 + Math.floor(r() * 4)
        for (let k = 0; k < n; k++) place(r() < 0.7 ? 'tree' : 'treeSmall', s + (r() - 0.5) * 3.5, lat + (r() - 0.5) * 3, 0.8 + r() * 0.4)
      } else if (roll < 0.42) place(r() < 0.5 ? 'kikar' : 'palm', s, lat, 0.8 + r() * 0.35)
      else if (roll < 0.62) place(r() < 0.6 ? 'treeSmall' : 'bush', s, lat, 0.8 + r() * 0.5)
      else if (roll < 0.7) place('stones', s, lat, 0.8 + r() * 0.5)
      // Poplars in a row along a field edge, now and then.
      if (r() < 0.05) for (let k = 0; k < 6; k++) place('poplar', s + k * 1.1, -4.6 - r() * 0.3, 0.9 + r() * 0.2)
      // Beside the line: grass and bushes on both sides, close in.
      if (r() < 0.55) place('grass', s + r(), (r() < 0.5 ? -1 : 1) * (1.1 + r() * 1.6), 0.7 + r() * 0.6)
      if (r() < 0.12) place('bush', s + r(), (r() < 0.5 ? -1 : 1) * (1.6 + r() * 1.5), 0.7 + r() * 0.4)
      // Right of the line, beyond the frames (and between them, where the line runs on its own).
      if (r() < 0.32) place(r() < 0.6 ? 'tree' : r() < 0.5 ? 'palm' : 'kikar', s, 2.4 + r() * 13, 0.8 + r() * 0.4)
      if (r() < 0.06) place('field', s, 6 + r() * 8, 0.8 + r() * 0.4)
    }
    // Ground pieces first (drawn beneath), then the standing ones.
    const ground: Kind[] = ['field', 'pond', 'grass', 'stones']
    pieces.sort((a, b) => Number(ground.includes(b.kind)) - Number(ground.includes(a.kind)))

    const canvas = drawAtlas()
    const tex = new CanvasTexture(canvas)
    tex.generateMipmaps = true
    tex.minFilter = LinearMipmapLinearFilter
    tex.magFilter = LinearFilter
    tex.anisotropy = 8
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uMap: { value: tex }, uGrowS: { value: -1e9 }, uTime: { value: 0 }, uSway: { value: 1 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const mesh = new InstancedMesh(plane, material, pieces.length)
    const rects = new Float32Array(pieces.length * 4)
    const life = new Float32Array(pieces.length * 3)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const up = new Vector3(0, 1, 0)
    const p = { x: 0, z: 0 }
    const f = { tx: 1, tz: 0, nx: 0, nz: 1 }
    pieces.forEach((pc, i) => {
      spinePoint(pc.s, p)
      spineFrame(pc.s, f)
      const x = p.x + f.nx * pc.lat
      const z = p.z + f.nz * pc.lat
      // Fields lie along the line; everything else turns freely (the light stays painted upper-left).
      const yaw = pc.kind === 'field' ? Math.atan2(-f.tz, f.tx) + pc.rot : 0
      q.setFromAxisAngle(up, yaw)
      const size = SIZE[pc.kind] * pc.scale
      m4.compose(new Vector3(x, 0.006, z), q, new Vector3(pc.kind === 'field' ? size * 1.6 : size, 1, size))
      mesh.setMatrixAt(i, m4)
      const c = CELLS.indexOf(pc.kind)
      // Atlas rect (u0, v0, du, dv); canvas rows run top-down, UVs bottom-up.
      rects.set([(c % COLS) / COLS, 1 - (Math.floor(c / COLS) + 1) / ROWS, 1 / COLS, 1 / ROWS], i * 4)
      life.set([pc.s, r(), SWAY[pc.kind]], i * 3)
    })
    plane.setAttribute('aRect', new InstancedBufferAttribute(rects, 4))
    plane.setAttribute('aLife', new InstancedBufferAttribute(life, 3))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.renderOrder = 1
    return { mesh, tex, material, plane }
  }, [layout, density])

  useEffect(
    () => () => {
      built.plane.dispose()
      built.material.dispose()
      built.tex.dispose()
    },
    [built],
  )

  useFrame(() => {
    const u = built.material.uniforms
    // Things sprout a little ahead of the frame the camera rests on, near the top of the screen.
    u.uGrowS.value = focus() + 15
    const { quality, reducedMotion } = cinematic.get()
    const live = quality.idleMotion && !reducedMotion
    u.uSway.value = live ? 1 : 0
    if (live) u.uTime.value = frame.time
  })

  return <primitive object={built.mesh} />
}
