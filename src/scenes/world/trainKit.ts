import { BoxGeometry, CanvasTexture, ClampToEdgeWrapping, CylinderGeometry, ExtrudeGeometry, LatheGeometry, SRGBColorSpace, Shape, TorusGeometry, Vector2, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '@/scenes/shared/sampleLines'

/**
 * Parts and painted surfaces for the 1947 train (Train.tsx, Locomotive.tsx, CarriageInterior.tsx).
 * Everything here is an illustration of a North Western Railway broad-gauge train of the period,
 * drawn from the archive's photographs in general terms: varnished teak panelling with beaded
 * mouldings, an arched roof with ventilators, four-wheel bogies with spoked wheels, wooden slatted
 * third-class benches. Weathered, not ruined: dust at the sills, soot low on the panels.
 */

/** Rail top on the station track (Station.tsx: rails 0.11 high on y 0.12). */
export const RAIL_TOP = 0.23

/* ── Painted surfaces (canvas textures, palette mixes) ───────────────────────────────────── */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d')! }
}

function finish(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  t.wrapS = ClampToEdgeWrapping
  t.wrapT = ClampToEdgeWrapping
  return t
}

/** Wood grain: long faint strokes of darker and lighter varnish. */
function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, vertical = false, alpha = 0.08) {
  const r = rng(seed)
  const n = Math.round((vertical ? w : h) / 3)
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = r() < 0.5 ? `rgba(40,30,18,${alpha * (0.5 + r())})` : `rgba(255,236,200,${alpha * 0.6 * r()})`
    ctx.lineWidth = 0.6 + r() * 1.4
    ctx.beginPath()
    if (vertical) {
      const gx = x + r() * w
      ctx.moveTo(gx, y)
      ctx.bezierCurveTo(gx + (r() - 0.5) * 6, y + h * 0.3, gx + (r() - 0.5) * 6, y + h * 0.7, gx + (r() - 0.5) * 4, y + h)
    } else {
      const gy = y + r() * h
      ctx.moveTo(x, gy)
      ctx.bezierCurveTo(x + w * 0.3, gy + (r() - 0.5) * 5, x + w * 0.7, gy + (r() - 0.5) * 5, x + w, gy + (r() - 0.5) * 3)
    }
    ctx.stroke()
  }
}

/** A raised beaded moulding: light on the top-left edge, shadow on the bottom-right. */
function bead(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, width = 3) {
  ctx.lineWidth = width
  ctx.strokeStyle = 'rgba(255,232,190,0.28)'
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(30,22,12,0.45)'
  ctx.beginPath()
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.stroke()
}

export interface SideSpec {
  /** Coach length and body height (m). */
  length: number
  height: number
  /** Window centres (local x, m), width/height and centre height (m). */
  windows: { x: number; w: number; h: number }[]
  windowY: number
  /** Doors (local x of centre, m): a painted door with a droplight and a brass handle. */
  doors: number[]
  /** Real door opening (the hollow carriage): leave it bare, the hole is in the geometry. */
  openDoor?: number
  seed: number
}

/** Exterior side of a coach: varnished teak panels, mouldings around windows and doors, weathering. */
export function coachSideTexture(s: SideSpec): CanvasTexture {
  const PX = 110
  const W = Math.round(s.length * PX)
  const H = Math.round(s.height * PX)
  const { c, ctx } = canvas(W, H)
  const X = (x: number) => (x + s.length / 2) * PX
  const Y = (y: number) => H - y * PX
  // Teak, lighter where the sun has bleached the upper panels.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#7d6648')
  g.addColorStop(0.45, '#735e42')
  g.addColorStop(1, '#5e4c35')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  grain(ctx, 0, 0, W, H, s.seed, false, 0.07)
  // Panel rows: lower panels, the waist band, the window row, the top (cant) panels.
  const rows: [number, number][] = [
    [0.12, s.windowY - s.windows[0].h / 2 - 0.2],
    [s.windowY + s.windows[0].h / 2 + 0.16, s.height - 0.12],
  ]
  for (const [y0, y1] of rows) {
    // Panels between the windows, each a beaded rectangle.
    const edges = [-s.length / 2 + 0.15, ...s.windows.flatMap((w) => [w.x - w.w / 2 - 0.12, w.x + w.w / 2 + 0.12]), s.length / 2 - 0.15]
    for (let i = 0; i < edges.length - 1; i += 1) {
      const a = edges[i] + 0.06
      const b = edges[i + 1] - 0.06
      if (b - a < 0.25) continue
      bead(ctx, X(a), Y(y1), (b - a) * PX, (y1 - y0) * PX)
    }
  }
  // Mouldings around each window, and a darker recess inside the frame.
  for (const w of s.windows) {
    const x0 = X(w.x - w.w / 2 - 0.09)
    const y0 = Y(s.windowY + w.h / 2 + 0.09)
    ctx.fillStyle = 'rgba(40,30,18,0.35)'
    ctx.fillRect(x0, y0, (w.w + 0.18) * PX, (w.h + 0.18) * PX)
    bead(ctx, x0, y0, (w.w + 0.18) * PX, (w.h + 0.18) * PX, 4)
    // Dust gathered on the sill, running down a little.
    const r = rng(Math.round(w.x * 100) + s.seed)
    for (let k = 0; k < 18; k++) {
      ctx.strokeStyle = `rgba(150,130,100,${0.06 + r() * 0.08})`
      ctx.lineWidth = 1 + r() * 2
      const sx = x0 + r() * (w.w + 0.18) * PX
      const sy = Y(s.windowY - w.h / 2 - 0.09)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + (r() - 0.5) * 3, sy + 10 + r() * 40)
      ctx.stroke()
    }
  }
  // Doors: a beaded door, a droplight (dark glass, half lowered) and a brass handle.
  for (const d of s.doors) {
    const dw = 0.86
    bead(ctx, X(d - dw / 2), Y(2.15), dw * PX, 2.05 * PX, 4)
    ctx.fillStyle = 'rgba(28,26,22,0.85)'
    ctx.fillRect(X(d - 0.27), Y(1.95), 0.54 * PX, 0.5 * PX)
    bead(ctx, X(d - 0.3), Y(1.98), 0.6 * PX, 0.56 * PX, 3)
    ctx.fillStyle = '#b39760'
    ctx.beginPath()
    ctx.arc(X(d + 0.31), Y(1.15), 4.5, 0, Math.PI * 2)
    ctx.fill()
    // Grab rails either side of the door.
    ctx.strokeStyle = 'rgba(60,59,54,0.9)'
    ctx.lineWidth = 3
    for (const gx of [d - dw / 2 - 0.08, d + dw / 2 + 0.08]) {
      ctx.beginPath()
      ctx.moveTo(X(gx), Y(1.7))
      ctx.lineTo(X(gx), Y(0.6))
      ctx.stroke()
    }
  }
  if (s.openDoor !== undefined) {
    ctx.strokeStyle = 'rgba(60,59,54,0.9)'
    ctx.lineWidth = 3
    for (const gx of [s.openDoor - 0.53, s.openDoor + 0.53]) {
      ctx.beginPath()
      ctx.moveTo(X(gx), Y(1.7))
      ctx.lineTo(X(gx), Y(0.6))
      ctx.stroke()
    }
  }
  // Waist rail shadow line and the solebar shadow at the foot.
  ctx.fillStyle = 'rgba(30,22,12,0.35)'
  ctx.fillRect(0, Y(s.windowY - s.windows[0].h / 2 - 0.16), W, 3)
  // Soot and brake dust low on the panels, rising unevenly.
  const soot = ctx.createLinearGradient(0, H, 0, H - 0.75 * PX)
  soot.addColorStop(0, 'rgba(45,40,33,0.55)')
  soot.addColorStop(1, 'rgba(45,40,33,0)')
  ctx.fillStyle = soot
  ctx.fillRect(0, H - 0.75 * PX, W, 0.75 * PX)
  const r = rng(s.seed + 7)
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(60,50,38,${0.03 + r() * 0.05})`
    const bx = r() * W
    ctx.fillRect(bx, H - r() * 0.9 * PX, 2 + r() * 10, 1 + r() * 2)
  }
  // Fine rain streaks from the roof.
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(55,45,32,${0.04 + r() * 0.05})`
    ctx.lineWidth = 1
    const sx = r() * W
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx + (r() - 0.5) * 2, 10 + r() * 60)
    ctx.stroke()
  }
  return finish(c)
}

/** The compartment's walls inside: a varnished teak dado below, cream-painted boards above, wear at the sills. */
export function interiorWallTexture(length: number, height: number, windowY: number, windowH: number): CanvasTexture {
  const PX = 100
  const W = Math.round(length * PX)
  const H = Math.round(height * PX)
  const { c, ctx } = canvas(W, H)
  const Y = (y: number) => H - y * PX
  const dado = windowY - windowH / 2 - 0.05
  // Upper: painted boards, a little yellowed, grimier toward the ceiling lamps' smoke.
  const up = ctx.createLinearGradient(0, 0, 0, Y(dado))
  up.addColorStop(0, '#a99c83')
  up.addColorStop(1, '#bfb299')
  ctx.fillStyle = up
  ctx.fillRect(0, 0, W, Y(dado))
  ctx.strokeStyle = 'rgba(80,66,46,0.16)'
  ctx.lineWidth = 1.5
  for (let x = 0; x < W; x += 0.16 * PX) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, Y(dado))
    ctx.stroke()
  }
  // Lower: varnished teak, tongue-and-groove boards, scuffed by luggage and feet.
  const lo = ctx.createLinearGradient(0, Y(dado), 0, H)
  lo.addColorStop(0, '#6e5639')
  lo.addColorStop(1, '#58442d')
  ctx.fillStyle = lo
  ctx.fillRect(0, Y(dado), W, H - Y(dado))
  grain(ctx, 0, Y(dado), W, H - Y(dado), 31, true, 0.09)
  ctx.strokeStyle = 'rgba(30,22,12,0.35)'
  ctx.lineWidth = 2
  for (let x = 0; x < W; x += 0.11 * PX) {
    ctx.beginPath()
    ctx.moveTo(x, Y(dado))
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  // Dado rail.
  ctx.fillStyle = '#4e3d28'
  ctx.fillRect(0, Y(dado) - 5, W, 9)
  ctx.fillStyle = 'rgba(255,232,190,0.25)'
  ctx.fillRect(0, Y(dado) - 5, W, 2)
  const r = rng(77)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '200,185,150' : '40,30,20'},${0.04 + r() * 0.07})`
    ctx.fillRect(r() * W, Y(0.05 + r() * 0.5), 3 + r() * 18, 1 + r() * 3)
  }
  return finish(c)
}

/** Floorboards along the carriage, worn pale down the middle, dust in the joints. */
export function floorTexture(length: number, width: number): CanvasTexture {
  const PX = 90
  const W = Math.round(length * PX)
  const H = Math.round(width * PX)
  const { c, ctx } = canvas(W, H)
  ctx.fillStyle = '#5d4b35'
  ctx.fillRect(0, 0, W, H)
  const board = 0.12 * PX
  const r = rng(5)
  for (let y = 0; y < H; y += board) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,236,200' : '30,22,12'},${0.03 + r() * 0.05})`
    ctx.fillRect(0, y, W, board)
    ctx.fillStyle = 'rgba(25,18,10,0.5)'
    ctx.fillRect(0, y, W, 1.5)
    for (let x = r() * 3 * PX; x < W; x += (2.5 + r() * 2) * PX) ctx.fillRect(x, y, 1.5, board)
  }
  grain(ctx, 0, 0, W, H, 9, false, 0.08)
  // A worn path along the aisle, lighter and dustier.
  const wear = ctx.createLinearGradient(0, 0, 0, H)
  wear.addColorStop(0.35, 'rgba(190,170,130,0)')
  wear.addColorStop(0.62, 'rgba(190,170,130,0.16)')
  wear.addColorStop(0.9, 'rgba(190,170,130,0)')
  ctx.fillStyle = wear
  ctx.fillRect(0, 0, W, H)
  return finish(c)
}

/* ── Geometry ─────────────────────────────────────────────────────────────────────────────── */

/**
 * A spoked railway wheel in the XY plane (axis along Z): tyre with a flange, rim, spokes, hub;
 * drivers add a crescent counterweight and a crank boss at `crank` from the centre.
 */
export function spokedWheel(r: number, opts: { spokes?: number; thick?: number; counterweight?: boolean; crank?: number } = {}): BufferGeometry {
  const spokes = opts.spokes ?? (r > 0.7 ? 16 : 10)
  const t = opts.thick ?? 0.13
  const parts: BufferGeometry[] = []
  // Tyre (a ring) and the flange on the inner face.
  parts.push(new TorusGeometry(r - 0.035, 0.04, 6, 36).scale(1, 1, t / 0.08))
  parts.push(new TorusGeometry(r - 0.005, 0.022, 5, 36).translate(0, 0, -t * 0.42))
  parts.push(new TorusGeometry(r * 0.86, 0.025, 5, 32))
  // Spokes, tapering toward the rim.
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    const len = r * 0.72
    const s = new CylinderGeometry(0.018 + r * 0.008, 0.03 + r * 0.012, len, 5).translate(0, r * 0.17 + len / 2, 0)
    s.rotateZ(a)
    parts.push(s)
  }
  // Hub with the axle end.
  parts.push(new CylinderGeometry(r * 0.2, r * 0.22, t * 1.1, 14).rotateX(Math.PI / 2))
  parts.push(new CylinderGeometry(r * 0.08, r * 0.08, t * 1.6, 10).rotateX(Math.PI / 2))
  if (opts.counterweight) {
    const cw = new CylinderGeometry(r * 0.78, r * 0.78, t * 0.7, 20, 1, false, Math.PI * 0.62, Math.PI * 0.76).rotateX(Math.PI / 2)
    parts.push(cw)
  }
  if (opts.crank) parts.push(new CylinderGeometry(0.075, 0.075, t * 2.2, 10).rotateX(Math.PI / 2).translate(opts.crank, 0, t * 0.4))
  const g = mergeGeometries(parts.map((p) => (p.index ? p : p)))!
  parts.forEach((p) => p.dispose())
  return g
}

/** A wheelset: two wheels on an axle at the broad gauge (wheels' outer faces outward). */
export function wheelset(r: number, gaugeHalf = 0.838, opts: { spokes?: number; counterweight?: boolean } = {}): BufferGeometry {
  const a = spokedWheel(r, opts).translate(0, 0, gaugeHalf)
  const b = spokedWheel(r, opts).rotateY(Math.PI).translate(0, 0, -gaugeHalf)
  const axle = new CylinderGeometry(0.075, 0.075, gaugeHalf * 2, 10).rotateX(Math.PI / 2)
  const g = mergeGeometries([a, b, axle])!
  a.dispose()
  b.dispose()
  axle.dispose()
  return g
}

/** A four-wheel bogie frame (without wheels): side frames, bolster, axle boxes and leaf springs. */
export function bogieFrame(wheelbase: number, wheelR: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  const y = wheelR
  for (const z of [-1.0, 1.0]) {
    parts.push(new BoxGeometry(wheelbase + 0.9, 0.16, 0.07).translate(0, y + 0.05, z))
    parts.push(new BoxGeometry(wheelbase + 0.5, 0.06, 0.07).translate(0, y - 0.16, z))
    for (const x of [-wheelbase / 2, wheelbase / 2]) {
      // Axle box and its leaf spring above.
      parts.push(new BoxGeometry(0.26, 0.24, 0.16).translate(x, y, z))
      for (let k = 0; k < 4; k++) parts.push(new BoxGeometry(0.7 - k * 0.12, 0.022, 0.1).translate(x, y + 0.2 + k * 0.026, z))
    }
  }
  parts.push(new BoxGeometry(0.4, 0.22, 2.1).translate(0, y + 0.12, 0))
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/** Arched roof cross-section (z across, y up) at x along the coach. */
export const ROOF = { half: 1.78, rise: 0.4, thick: 0.06 }
export const roofArc = (z: number) => ROOF.rise * Math.cos((Math.min(1, Math.abs(z) / ROOF.half) * Math.PI) / 2)
/** Coach body height above the floor, and where the roof shell sits (its underside meets the wall tops). */
export const COACH_BODY_H = 2.75
export const ROOF_BASE = COACH_BODY_H - 0.01 - roofArc(1.6)
/** Height of the roof's outer surface above the coach floor at z (for people and bundles riding on it). */
export const roofTopAt = (z: number) => ROOF_BASE + roofArc(z) + ROOF.thick

/** The roof shell, extruded along X, centred on x = 0, its lowest underside at y = 0 for |z| = ROOF.half. */
export function arcRoof(length: number, half = ROOF.half, thick = ROOF.thick): BufferGeometry {
  const s = new Shape()
  const n = 24
  for (let i = 0; i <= n; i++) {
    const z = -half + (2 * half * i) / n
    const y = roofArc(z) + thick
    if (i === 0) s.moveTo(z, y)
    else s.lineTo(z, y)
  }
  for (let i = n; i >= 0; i--) {
    const z = -half + (2 * half * i) / n
    s.lineTo(z, roofArc(z))
  }
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  return g
}

/** A torpedo ventilator on the roof crown. */
export function ventilator(): BufferGeometry {
  const body = new LatheGeometry([new Vector2(0, -0.22), new Vector2(0.06, -0.18), new Vector2(0.08, -0.05), new Vector2(0.08, 0.1), new Vector2(0.05, 0.2), new Vector2(0, 0.24)], 10).rotateZ(Math.PI / 2).translate(0, 0.09, 0)
  const stem = new CylinderGeometry(0.03, 0.04, 0.08, 8).translate(0, 0.03, 0)
  const g = mergeGeometries([body, stem])!
  body.dispose()
  stem.dispose()
  return g
}

/** A wooden slatted third-class bench with a slatted back and cast-iron ends, facing +X. */
export function slattedBench(length: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < 5; i++) parts.push(new BoxGeometry(0.075, 0.028, length).translate(-0.2 + i * 0.09, 0.44, 0))
  for (let i = 0; i < 4; i++) parts.push(new BoxGeometry(0.026, 0.075, length).translate(-0.27 - i * 0.012, 0.6 + i * 0.13, 0))
  for (const z of [-length / 2 + 0.05, length / 2 - 0.05]) {
    parts.push(new BoxGeometry(0.5, 0.05, 0.04).translate(-0.05, 0.42, z))
    parts.push(new BoxGeometry(0.04, 0.42, 0.04).translate(0.16, 0.21, z))
    parts.push(new BoxGeometry(0.04, 1.02, 0.04).translate(-0.3, 0.51, z))
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/** A luggage rack: iron brackets and three rods along X, depth along −Z from the wall. */
export function luggageRack(length: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const dz of [0.08, 0.2, 0.32]) parts.push(new CylinderGeometry(0.012, 0.012, length, 6).rotateZ(Math.PI / 2).translate(0, 0, dz))
  for (const x of [-length / 2 + 0.1, 0, length / 2 - 0.1]) parts.push(new BoxGeometry(0.03, 0.03, 0.4).translate(x, 0, 0.2), new BoxGeometry(0.03, 0.22, 0.03).translate(x, 0.1, 0.02))
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}
