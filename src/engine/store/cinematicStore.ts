import { create } from 'zustand'
import { detectQuality, prefersReducedMotion, type QualityProfile } from '@/engine/quality/quality'
import type { Beat, Timeline } from '@/engine/timeline/timeline'
import { staticStoryProvider } from '@/data/story/provider'

/**
 * Per-frame values live in a plain mutable object, NOT in React state.
 * Scenes read `frame` inside useFrame; nothing re-renders because of scrolling.
 */
export interface FrameState {
  /** Damped cinematic progress 0..1. The one value that drives everything. */
  progress: number
  /** Raw scroll-derived target progress 0..1. */
  target: number
  /** d(progress)/dt in progress units per second (signed). */
  velocity: number
  /** Seconds since boot (monotonic, from the render loop). */
  time: number
  /** Last frame delta in seconds (clamped). */
  dt: number
}

export const frame: FrameState = {
  progress: 0,
  target: 0,
  velocity: 0,
  time: 0,
  dt: 1 / 60,
}

export type ArchiveCategory = 'photographs' | 'newspapers' | 'documents' | 'maps' | 'sources'

/** Secondary layers of the website, opened over the film. */
export type OverlayId = 'menu' | 'timeline' | 'archive' | 'sources' | 'about'

/** 'free': the visitor scrolls. 'judges': the ~2-minute Judges' Cut plays (and can be paused). */
export type PlayMode = 'free' | 'judges'

/** Coarse, reactive state. Only changes on discrete events, never per frame. */
export interface CinematicState {
  ready: boolean
  bootProgress: number
  /** The visitor has passed the entry screen. */
  entered: boolean
  timeline: Timeline
  beatId: string
  beatIndex: number
  /** The year at rest of the active beat (for a11y, the archive and the timeline). */
  year: number
  hasScrolled: boolean
  overlay: OverlayId | null
  archiveCategory: ArchiveCategory
  /** Asset id to focus when the archive opens (e.g. clicked a print in the scene). */
  archiveFocusId: string | null
  /** Storyboard event whose records the archive shows (null = the whole archive). */
  archiveEventId: string | null
  mode: PlayMode
  playing: boolean
  soundEnabled: boolean
  audioUnlocked: boolean
  quality: QualityProfile
  reducedMotion: boolean
  debug: boolean

  setReady: (ready: boolean) => void
  setBootProgress: (p: number) => void
  enter: () => void
  setTimeline: (t: Timeline) => void
  setBeat: (b: Beat) => void
  setHasScrolled: () => void
  openOverlay: (o: OverlayId) => void
  closeOverlay: () => void
  openArchive: (opts?: { category?: ArchiveCategory; focusId?: string | null; eventId?: string | null }) => void
  closeArchive: () => void
  setArchiveCategory: (c: ArchiveCategory) => void
  setArchiveEvent: (id: string | null) => void
  setMode: (m: PlayMode) => void
  setPlaying: (on: boolean) => void
  toggleSound: () => void
  setSoundEnabled: (on: boolean) => void
  setAudioUnlocked: () => void
  setQuality: (q: QualityProfile) => void
}

const initialQuality = detectQuality()
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const debug = params.has('debug')
const initialTimeline = staticStoryProvider.timeline()

export const useCinematicStore = create<CinematicState>()((set) => ({
  ready: false,
  bootProgress: 0,
  // `?enter` skips the entry screen (verification, kiosk setups).
  entered: params.has('enter'),
  timeline: initialTimeline,
  beatId: initialTimeline.beats[0].id,
  beatIndex: 0,
  year: initialTimeline.beats[0].year,
  hasScrolled: false,
  overlay: null,
  archiveCategory: 'photographs',
  archiveFocusId: null,
  archiveEventId: null,
  mode: 'free',
  playing: false,
  soundEnabled: false,
  audioUnlocked: false,
  quality: initialQuality,
  reducedMotion: prefersReducedMotion(),
  debug,

  setReady: (ready) => set({ ready }),
  setBootProgress: (bootProgress) => set({ bootProgress }),
  enter: () => set({ entered: true }),
  setTimeline: (timeline) => set({ timeline }),
  setBeat: (b) => set((s) => (s.beatId === b.id ? s : { beatId: b.id, beatIndex: b.index, year: b.year })),
  setHasScrolled: () => set((s) => (s.hasScrolled ? s : { hasScrolled: true })),
  openOverlay: (overlay) => set({ overlay, playing: false }),
  closeOverlay: () => set({ overlay: null, archiveFocusId: null }),
  openArchive: (opts) =>
    set((s) => ({
      overlay: 'archive',
      playing: false,
      archiveCategory: opts?.category ?? s.archiveCategory,
      archiveFocusId: opts?.focusId ?? null,
      archiveEventId: opts?.eventId === undefined ? s.archiveEventId : opts.eventId,
    })),
  closeArchive: () => set({ overlay: null, archiveFocusId: null }),
  setArchiveCategory: (archiveCategory) => set({ archiveCategory }),
  setArchiveEvent: (archiveEventId) => set({ archiveEventId, archiveFocusId: null }),
  setMode: (mode) => set({ mode }),
  setPlaying: (playing) => set({ playing }),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setAudioUnlocked: () => set({ audioUnlocked: true }),
  setQuality: (quality) => set({ quality }),
}))

/** Non-hook accessor for use inside the render loop or vanilla modules. */
export const cinematic = {
  get: useCinematicStore.getState,
  set: useCinematicStore.setState,
  subscribe: useCinematicStore.subscribe,
}
