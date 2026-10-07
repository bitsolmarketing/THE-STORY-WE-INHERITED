import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, LinearFilter, NormalBlending, ShaderMaterial, type Group } from 'three'
import { frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { srgbVec3 } from '@/engine/assets/color'
import { ease, seg } from '@/engine/progress/ranges'
import type { Timeline } from '@/engine/timeline/timeline'
import { PALETTE } from '@/scenes/world/layout'
import { buildInkGeometry, createInkMaterial, type XZ } from '@/scenes/shared/ink'
import { Print, type PrintReveal } from '@/scenes/shared/Print'
import type { StoryEvent } from '@/data/story/types'
import { type ChronicleLayout, type ChronicleSlot } from './layout'
import { generateMotif } from './motifs'
import type { MotifDots, MotifLabel, UV } from './motifs/types'
import { filmPrintsFor } from './filmPrints'
import { plateToWorld, plateTransform, printSlots } from './plateFrame'

/** Plate space (u right, v forward) → plate-local XZ. */
const toXZ = ([u, v]: UV): XZ => [u, -v]

/** Film seconds before/after a frame's beat during which its plate stays mounted. */
const MOUNT_LEAD_S = 3.2
const MOUNT_TAIL_S = 3.0

/**
 * Mounts only the storyboard frames near the camera (typically 2–3 at a time) and lays each one
 * beside the spine. Everything inside a plate is a pure function of its beat-local progress:
 * the motif draws during the event's DEVELOP phase and stays drawn through the HOLD.
 */
export function Plates({ layout }: { layout: ChronicleLayout }) {
  const timeline = useCinematicStore((s) => s.timeline)
  const events = useMemo(() => layout.slots.filter((s) => s.beat.kind === 'event'), [layout])
  const [visible, setVisible] = useState<string>('')

  useFrame(() => {
    const p = frame.progress
    const lead = MOUNT_LEAD_S / timeline.totalSeconds
    const tail = MOUNT_TAIL_S / timeline.totalSeconds
    const key = events
      .filter((s) => p >= s.beat.start - lead && p <= s.beat.end + tail)
      .map((s) => s.beat.id)
      .join(',')
    if (key !== visible) setVisible(key)
  })

  const ids = new Set(visible.split(',').filter(Boolean))
  return (
    <>
      {events
        .filter((s) => ids.has(s.beat.id))
        .map((s) => (
          <Plate key={s.beat.id} slot={s} timeline={timeline} />
        ))}
    </>
  )
}

function Plate({ slot, timeline }: { slot: ChronicleSlot; timeline: Timeline }) {
  const event = slot.beat.event!
  const motif = useMemo(() => generateMotif(event), [event])
  const geometry = useMemo(
    () =>
      buildInkGeometry({
        strokes: motif.strokes.map((s) => ({ ...s, points: s.points.map(toXZ) })),
        fills: (motif.fills ?? []).map((f) => ({ ...f, polygon: f.polygon.map(toXZ), rise: f.rise ? toXZ(f.rise) : [0, -1] })),
      }),
    [motif],
  )
  const material = useMemo(() => createInkMaterial(), [])
  const xf = useMemo(() => plateTransform(slot), [slot])
  const prints = useMemo(() => filmPrintsFor(event), [event])
  const slots = useMemo(() => printSlots(event, prints.length), [event, prints.length])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Beat-local time (unclamped) and the motif clock (0 → 1 across the develop phase).
  const clocks = useMemo(() => {
    const beat = slot.beat
    const ph = timeline.phases(beat)
    const local = (p: number) => (p - beat.start) / (beat.end - beat.start)
    const a = ph.arrive * 0.55
    const motif = (p: number) => (local(p) - a) / (ph.develop - a)
    return { local, motif }
  }, [slot, timeline])

  useFrame(() => {
    const t = clocks.motif(frame.progress)
    material.uniforms.uT.value = t
    material.uniforms.uOpacity.value = ease.outQuad(seg(clocks.local(frame.progress), -0.5, 0.05))
  })

  return (
    <>
      <group position={xf.position} quaternion={xf.quaternion}>
        <mesh geometry={geometry} material={material} position-y={0.015} renderOrder={2} />
        {(motif.labels ?? []).map((l, i) => (
          <PlateLabel key={i} label={l} t={clocks.motif} />
        ))}
        {(motif.dots ?? []).map((d, i) => (
          <PlateDots key={i} dots={d} t={clocks.motif} />
        ))}
      </group>
      {prints.map((asset, i) => {
        const spec = slots[i]
        const world = plateToWorld(slot, spec.at)
        const vis = (p: number) => seg(clocks.local(p), spec.enter, spec.enter + 0.14)
        return (
          <Print
            key={asset.id}
            asset={asset}
            position={[world.x, 0.04 + i * 0.012, world.z]}
            yaw={xf.printYaw + spec.angle}
            width={spec.width * panoramaScale(asset)}
            visibility={vis}
            // The hero lies on top; the others are tucked under it.
            renderOrder={i === 0 ? 6 + prints.length : 6 + i}
            reveal={revealFor(event, i)}
          />
        )
      })}
    </>
  )
}

/**
 * Wide panoramas laid at the slot width read as thin strips (the 1967 Mangla panorama was a sliver
 * on the table): widen them so every print keeps a similar presence, up to 1.6×.
 */
function panoramaScale(asset: { width?: number; height?: number }): number {
  const aspect = asset.width && asset.height ? asset.height / asset.width : 0.75
  return aspect >= 0.6 ? 1 : Math.min(1.6, Math.sqrt(0.6 / aspect))
}

/**
 * One visual language, several gestures. The hero keeps the 2005 frame's "develop" for the weight
 * of losses, disasters and founding moments; documents of state unfold, diplomacy opens like a
 * carriage blind, achievements are set down, and works of building are passed across the table.
 * Supporting prints rotate through the gestures so neighbours never arrive the same way.
 */
const HERO_REVEAL: Partial<Record<StoryEvent['type'], PrintReveal>> = {
  constitution: 'unfold',
  politics: 'unfold',
  diplomacy: 'shutter',
  sport: 'drop',
  science: 'drop',
  infrastructure: 'slide',
}
const SUPPORT_REVEAL: PrintReveal[] = ['slide', 'drop', 'develop', 'shutter']

function revealFor(event: StoryEvent, index: number): PrintReveal {
  if (index === 0) return HERO_REVEAL[event.type] ?? 'develop'
  const offset = event.id.charCodeAt(event.id.length - 1)
  return SUPPORT_REVEAL[(index + offset) % SUPPORT_REVEAL.length]
}

/* ── Labels: one small canvas per label, flat on the table, faded in by its window ───────────── */

const FONTS: Record<NonNullable<MotifLabel['font']>, string> = {
  mono: '400 {px}px "JetBrains Mono", ui-monospace, monospace',
  display: '500 {px}px "Cormorant Garamond", Georgia, serif',
  italic: 'italic 500 {px}px "Cormorant Garamond", Georgia, serif',
  sans: '500 {px}px Inter, system-ui, sans-serif',
}

function PlateLabel({ label, t }: { label: MotifLabel; t: (p: number) => number }) {
  const group = useRef<Group>(null)
  const { texture, width, height, material } = useMemo(() => {
    const px = 64
    const font = FONTS[label.font ?? 'mono'].replace('{px}', String(px))
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')!
    const ctxT = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
    const tracking = (label.tracking ?? (label.font === 'mono' || !label.font ? 0.12 : 0.02)) * px
    ctx.font = font
    ctxT.letterSpacing = `${tracking}px`
    const w = Math.ceil(ctx.measureText(label.text).width + px * 0.5)
    const h = Math.ceil(px * 1.5)
    c.width = Math.max(4, w)
    c.height = h
    ctx.font = font
    ctxT.letterSpacing = `${tracking}px`
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(label.text, px * 0.25, h / 2 + px * 0.04)
    const tex = new CanvasTexture(c)
    tex.minFilter = LinearFilter
    tex.generateMipmaps = false
    const unitsPerPx = label.size / (px * 0.7)
    const mat = new ShaderMaterial({
      uniforms: { uMap: { value: tex }, uOpacity: { value: 0 }, cInk: { value: srgbVec3(label.color ?? PALETTE.charcoal) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform sampler2D uMap; uniform float uOpacity; uniform vec3 cInk; varying vec2 vUv; void main(){ float a = texture2D(uMap, vUv).r * uOpacity; if (a < 0.01) discard; gl_FragColor = vec4(cInk, a); }',
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    })
    return { texture: tex, width: c.width * unitsPerPx, height: h * unitsPerPx, material: mat }
  }, [label])

  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  useFrame(() => {
    const v = ease.outQuad(seg(t(frame.progress), label.window[0], label.window[1]))
    material.uniforms.uOpacity.value = v
    if (group.current) group.current.visible = v > 0.003
  })

  const align = label.align ?? 'left'
  const offsetU = align === 'left' ? width / 2 - width * 0.03 : align === 'right' ? -width / 2 + width * 0.03 : 0
  const [x, z] = toXZ(label.at)
  return (
    <group ref={group} position={[x, 0.03, z]} rotation-y={label.angle ?? 0}>
      <mesh rotation-x={-Math.PI / 2} position-x={offsetU} material={material} renderOrder={4}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  )
}

/* ── Dots: crowds, flows, lights ─────────────────────────────────────────────────────────────── */

function PlateDots({ dots, t }: { dots: MotifDots; t: (p: number) => number }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const { geometry, material } = useMemo(() => {
    const n = dots.from.length
    const from = new Float32Array(n * 3)
    const to = new Float32Array(n * 3)
    const delay = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const [fx, fz] = toXZ(dots.from[i])
      const [tx, tz] = toXZ(dots.to[i] ?? dots.from[i])
      from.set([fx, 0.04, fz], i * 3)
      to.set([tx, 0.04, tz], i * 3)
      delay[i] = dots.delay?.[i] ?? 0
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(from, 3))
    g.setAttribute('aTo', new BufferAttribute(to, 3))
    g.setAttribute('aDelay', new BufferAttribute(delay, 1))
    g.computeBoundingSphere()
    const m = new ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uPx: { value: 1 },
        uSize: { value: dots.size },
        uPing: { value: dots.pingPong ? 1 : 0 },
        uGlow: { value: dots.glow ? 1 : 0 },
        cCol: { value: srgbVec3(dots.color) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aTo;
        attribute float aDelay;
        uniform float uT, uPx, uSize, uPing;
        varying float vA;
        void main() {
          float k = clamp((uT - aDelay * 0.5) / 0.5, 0.0, 1.0);
          float m = uPing > 0.5 ? sin(3.14159 * k) : k;
          m = m * m * (3.0 - 2.0 * m);
          vA = smoothstep(0.0, 0.12, uT - aDelay * 0.45);
          vec4 mv = modelViewMatrix * vec4(mix(position, aTo, m), 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPx * (16.0 / max(1.0, -mv.z));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 cCol;
        uniform float uGlow;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.3, d);
          float halo = exp(-d * d * 14.0) * 0.55;
          float a = (uGlow > 0.5 ? max(core * 0.9, halo) : core) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(cCol, a * 0.92);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
    return { geometry: g, material: m }
  }, [dots])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const w = dots.window
    material.uniforms.uT.value = (t(frame.progress) - w[0]) / Math.max(1e-4, w[1] - w[0])
    material.uniforms.uPx.value = dpr
  })

  return <points geometry={geometry} material={material} renderOrder={5} frustumCulled={false} />
}
