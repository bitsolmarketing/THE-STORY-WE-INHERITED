import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2, ShaderMaterial, NormalBlending, DoubleSide } from 'three'
import { srgbVec3 } from '@/engine/assets/color'

/**
 * The ink system: every drawn line in the film (the Radcliffe line, rivers, routes, dams,
 * signatures, constitutions…) is a ribbon or a fill in ONE geometry with ONE material per motif.
 *
 * Strokes draw on along their length inside their own time window (inkSpread), with a wet,
 * slightly heavier leading edge. Fills rise along an axis (a dam rising, water spreading).
 * Everything is a pure function of `uT` (motif-local 0..1), so it un-draws when scrolling back.
 */
export type XZ = [number, number]

export interface InkStroke {
  points: XZ[]
  /** World units. */
  width: number
  color: string
  alpha?: number
  /** Motif-local time window over which the stroke draws on. */
  window: [number, number]
  /** Dash period in world units (0 / undefined = solid). */
  dash?: number
  /** Taper the last 15% (brush lift). */
  taper?: boolean
}

export interface InkFill {
  polygon: XZ[]
  color: string
  alpha?: number
  window: [number, number]
  /** Direction the fill rises in (local XZ unit vector). Default: from −Z (top) to +Z. */
  rise?: XZ
}

export interface InkDrawing {
  strokes: InkStroke[]
  fills?: InkFill[]
}

const STRIDE = { pos: 3, dist: 1, side: 1, win: 2, col: 4, mode: 1, len: 1, dash: 1 }

export function buildInkGeometry(d: InkDrawing): BufferGeometry {
  const pos: number[] = []
  const dist: number[] = []
  const side: number[] = []
  const win: number[] = []
  const col: number[] = []
  const mode: number[] = []
  const len: number[] = []
  const dash: number[] = []
  const index: number[] = []
  let base = 0
  const c = { x: 0, y: 0, z: 0 }

  const push = (x: number, z: number, d: number, s: number, w: [number, number], rgba: number[], m: number, l: number, ds: number) => {
    pos.push(x, 0, z)
    dist.push(d)
    side.push(s)
    win.push(w[0], w[1])
    col.push(rgba[0], rgba[1], rgba[2], rgba[3])
    mode.push(m)
    len.push(l)
    dash.push(ds)
  }

  for (const s of d.strokes) {
    const pts = s.points
    if (pts.length < 2) continue
    const v = srgbVec3(s.color)
    c.x = v.x
    c.y = v.y
    c.z = v.z
    const rgba = [c.x, c.y, c.z, s.alpha ?? 1]
    // Cumulative length.
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    const total = cum[cum.length - 1] || 1
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      let tx = b[0] - a[0]
      let tz = b[1] - a[1]
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      const nx = -tz
      const nz = tx
      const f = cum[i] / total
      const taper = s.taper ? Math.min(1, (1 - f) / 0.15 + 0.15) : 1
      const hw = (s.width / 2) * taper
      push(p[0] + nx * hw, p[1] + nz * hw, f, 1, s.window, rgba, 0, cum[i], s.dash ?? 0)
      push(p[0] - nx * hw, p[1] - nz * hw, f, -1, s.window, rgba, 0, cum[i], s.dash ?? 0)
      if (i > 0) {
        const i0 = base + (i - 1) * 2
        index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2)
      }
    }
    base += pts.length * 2
  }

  for (const fl of d.fills ?? []) {
    const poly = fl.polygon
    if (poly.length < 3) continue
    const v = srgbVec3(fl.color)
    const rgba = [v.x, v.y, v.z, fl.alpha ?? 1]
    const r = fl.rise ?? [0, 1]
    const proj = poly.map((p) => p[0] * r[0] + p[1] * r[1])
    const lo = Math.min(...proj)
    const hi = Math.max(...proj)
    const tris = ShapeUtils.triangulateShape(poly.map((p) => new Vector2(p[0], p[1])), [])
    poly.forEach((p, i) => push(p[0], p[1], (proj[i] - lo) / (hi - lo || 1), 0, fl.window, rgba, 1, 0, 0))
    for (const t of tris) index.push(base + t[0], base + t[1], base + t[2])
    base += poly.length
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), STRIDE.pos))
  g.setAttribute('aDist', new BufferAttribute(new Float32Array(dist), STRIDE.dist))
  g.setAttribute('aSide', new BufferAttribute(new Float32Array(side), STRIDE.side))
  g.setAttribute('aWindow', new BufferAttribute(new Float32Array(win), STRIDE.win))
  g.setAttribute('aColor', new BufferAttribute(new Float32Array(col), STRIDE.col))
  g.setAttribute('aMode', new BufferAttribute(new Float32Array(mode), STRIDE.mode))
  g.setAttribute('aLen', new BufferAttribute(new Float32Array(len), STRIDE.len))
  g.setAttribute('aDash', new BufferAttribute(new Float32Array(dash), STRIDE.dash))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

const vertex = /* glsl */ `
  attribute float aDist;
  attribute float aSide;
  attribute vec2 aWindow;
  attribute vec4 aColor;
  attribute float aMode;
  attribute float aLen;
  attribute float aDash;
  varying float vDist;
  varying float vSide;
  varying vec2 vWindow;
  varying vec4 vColor;
  varying float vMode;
  varying float vLen;
  varying float vDash;
  varying vec2 vXZ;
  void main() {
    vDist = aDist; vSide = aSide; vWindow = aWindow; vColor = aColor; vMode = aMode; vLen = aLen; vDash = aDash;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const fragment = /* glsl */ `
  uniform float uT;
  uniform float uOpacity;
  uniform float uGrain;
  varying float vDist;
  varying float vSide;
  varying vec2 vWindow;
  varying vec4 vColor;
  varying float vMode;
  varying float vLen;
  varying float vDash;
  varying vec2 vXZ;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    float r = clamp((uT - vWindow.x) / max(vWindow.y - vWindow.x, 1e-4), 0.0, 1.0);
    float a = vColor.a * uOpacity;
    if (vMode < 0.5) {
      // Stroke: drawn up to r, with a soft wet leading edge.
      float ahead = vDist - r;
      if (r <= 0.0 || ahead > 0.004) discard;
      float wet = 1.0 - smoothstep(0.0, 0.035, -ahead);
      float across = abs(vSide);
      float edge = 1.0 - smoothstep(0.62 - 0.25 * wet, 1.0, across);
      float fiber = vnoise(vXZ * 9.0 + vLen * 0.6);
      a *= edge * mix(1.0, 0.72 + 0.4 * fiber, uGrain);
      a *= 0.9 + 0.25 * wet;
      if (vDash > 0.0 && fract(vLen / vDash) > 0.56) discard;
    } else {
      // Fill: rises along its axis up to r, with a feathered front.
      float front = smoothstep(r + 0.002, r - 0.04, vDist);
      if (front <= 0.0) discard;
      float n = vnoise(vXZ * 3.0);
      a *= front * mix(1.0, 0.82 + 0.3 * n, uGrain);
    }
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor.rgb, a);
  }
`

/** One material per drawing; `uT` and `uOpacity` are driven from progress. */
export function createInkMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uT: { value: 0 }, uOpacity: { value: 1 }, uGrain: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
}
