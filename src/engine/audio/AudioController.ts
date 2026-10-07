import { useEffect } from 'react'
import { cinematic, frame, useCinematicStore } from '@/engine/store/cinematicStore'
import { onTick } from '@/engine/loop/ticker'
import type { Beat } from '@/engine/timeline/timeline'
import type { SoundCue } from '@/data/story/types'
import { openingState } from '@/scenes/openingCurves'

/**
 * Procedural sound (brief §20): ambience, paper, train, crowd, transitions — and silence, used on
 * purpose. Everything is synthesised with the Web Audio API from noise (no music, no assets, no
 * patriotic score). The context is created only when the visitor turns sound on; nothing plays
 * before that. Layers are mixed every frame from the same progress that drives the film.
 */
type Layer = 'room' | 'wind' | 'crowd' | 'train' | 'water'

interface Engine {
  ctx: AudioContext
  master: GainNode
  layers: Record<Layer, GainNode>
  noise: { white: AudioBuffer; brown: AudioBuffer }
  lastBeat: string
  clackPhase: number
}

let engine: Engine | null = null

function noiseBuffer(ctx: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
  const len = ctx.sampleRate * 3
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w * 0.5
    else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.2
    }
  }
  return buf
}

function loop(ctx: AudioContext, buffer: AudioBuffer, nodes: AudioNode[], out: AudioNode): void {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.loopStart = Math.random() * 1.5
  let prev: AudioNode = src
  for (const n of nodes) {
    prev.connect(n)
    prev = n
  }
  prev.connect(out)
  src.start()
}

function createEngine(): Engine {
  const ctx = new AudioContext()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 3
  comp.connect(ctx.destination)
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(comp)
  const white = noiseBuffer(ctx, 'white')
  const brown = noiseBuffer(ctx, 'brown')
  const gain = () => {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(master)
    return g
  }
  const layers: Record<Layer, GainNode> = { room: gain(), wind: gain(), crowd: gain(), train: gain(), water: gain() }

  const biquad = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const lfoGain = (rate: number, depth: number, target: AudioParam) => {
    const o = ctx.createOscillator()
    o.frequency.value = rate
    const g = ctx.createGain()
    g.gain.value = depth
    o.connect(g)
    g.connect(target)
    o.start()
  }

  // Room tone: low, warm, steady.
  loop(ctx, brown, [biquad('lowpass', 420)], layers.room)
  // Wind: band of air moving slowly.
  const windBand = biquad('bandpass', 520, 0.5)
  const windAmp = ctx.createGain()
  windAmp.gain.value = 0.6
  lfoGain(0.07, 0.35, windAmp.gain)
  lfoGain(0.05, 180, windBand.frequency)
  loop(ctx, white, [windBand, windAmp], layers.wind)
  // Crowd: murmur in the voice band, restless.
  const crowdAmp = ctx.createGain()
  crowdAmp.gain.value = 0.55
  lfoGain(3.1, 0.18, crowdAmp.gain)
  lfoGain(0.4, 0.15, crowdAmp.gain)
  loop(ctx, white, [biquad('bandpass', 850, 0.9), biquad('lowpass', 2200), crowdAmp], layers.crowd)
  // Train: heavy rumble under the floor.
  loop(ctx, brown, [biquad('lowpass', 150, 0.9)], layers.train)
  // Water: soft, broad, moving.
  const waterAmp = ctx.createGain()
  waterAmp.gain.value = 0.5
  lfoGain(0.18, 0.2, waterAmp.gain)
  loop(ctx, white, [biquad('highpass', 250), biquad('lowpass', 1400), waterAmp], layers.water)

  return { ctx, master, layers, noise: { white, brown }, lastBeat: '', clackPhase: 0 }
}

/** A short filtered-noise event (paper turning, rail joint). */
function burst(e: Engine, opts: { freq: number; q: number; dur: number; gain: number; type?: BiquadFilterType }): void {
  const { ctx } = e
  const src = ctx.createBufferSource()
  src.buffer = e.noise.white
  const f = ctx.createBiquadFilter()
  f.type = opts.type ?? 'bandpass'
  f.frequency.value = opts.freq
  f.Q.value = opts.q
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(opts.gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
  src.connect(f)
  f.connect(g)
  g.connect(e.master)
  src.start(t, Math.random() * 2)
  src.stop(t + opts.dur + 0.05)
}

/** The mix wanted for a moment of the film (0..1 per layer). */
function mixFor(beat: Beat, p: number): Record<Layer, number> {
  const m: Record<Layer, number> = { room: 0.35, wind: 0, crowd: 0, train: 0, water: 0 }
  if (beat.kind === 'opening') {
    const s = openingState(cinematic.get().timeline, p)
    m.wind = 0.55 * s.dark + 0.15
    m.room = 0.3 * (1 - s.dark)
    m.crowd = Math.max(s.flows * 0.35, s.people * (1 - s.travel) * 0.7)
    m.train = s.travel > 0 ? 0.35 + 0.55 * Math.min(1, s.travel * 3) : s.people * 0.12
    return m
  }
  const cue: SoundCue | undefined = beat.event?.sound ?? (beat.kind === 'transition' ? 'room' : undefined)
  switch (cue) {
    case 'silence':
      return { room: 0.08, wind: 0, crowd: 0, train: 0, water: 0 }
    case 'crowd':
      m.crowd = 0.45
      break
    case 'wind':
      m.wind = 0.4
      break
    case 'water':
      m.water = 0.5
      break
    case 'train':
      m.train = 0.5
      break
    default:
      break
  }
  return m
}

const LEVEL: Record<Layer, number> = { room: 0.32, wind: 0.22, crowd: 0.16, train: 0.5, water: 0.18 }

export function useAudioController(): void {
  const soundEnabled = useCinematicStore((s) => s.soundEnabled)

  useEffect(() => {
    if (soundEnabled && !engine) engine = createEngine()
    if (!engine) return
    const { ctx, master } = engine
    if (soundEnabled && ctx.state === 'suspended') void ctx.resume()
    master.gain.setTargetAtTime(soundEnabled ? 0.9 : 0, ctx.currentTime, 0.4)
  }, [soundEnabled])

  useEffect(
    () =>
      onTick((f) => {
        const e = engine
        if (!e || !cinematic.get().soundEnabled) return
        const { timeline, overlay } = cinematic.get()
        const beat = timeline.beatAt(f.progress)
        const mix = mixFor(beat, f.progress)
        // Opening an archive or a page quiets the film.
        const duck = overlay ? 0.35 : 1
        const t = e.ctx.currentTime
        for (const k of Object.keys(mix) as Layer[]) e.layers[k].gain.setTargetAtTime(mix[k] * LEVEL[k] * duck, t, 0.5)

        // Paper: the film turns to a new chapter.
        if (beat.id !== e.lastBeat) {
          if (e.lastBeat && (beat.kind === 'event' || beat.kind === 'transition')) burst(e, { freq: 2600, q: 0.6, dur: 0.32, gain: 0.05, type: 'highpass' })
          e.lastBeat = beat.id
        }

        // Rail joints: clacks whose rate follows the train's speed through the departure.
        if (beat.kind === 'opening') {
          const s = openingState(timeline, f.progress)
          const speed = Math.abs(frame.velocity) * timeline.totalSeconds * (s.travel > 0 && s.travel < 1 ? 1 : 0)
          e.clackPhase += f.dt * Math.min(6, speed * 2.2)
          if (e.clackPhase >= 1) {
            e.clackPhase -= 1
            burst(e, { freq: 380, q: 2.5, dur: 0.09, gain: 0.12 })
            setTimeout(() => engine && burst(engine, { freq: 420, q: 2.5, dur: 0.08, gain: 0.09 }), 110)
          }
        }
      }),
    [],
  )
}
