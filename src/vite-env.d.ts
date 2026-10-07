/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the archive API. When unset, the mock repository is used. */
  readonly VITE_ARCHIVE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Debug/verification hooks exposed on window (see src/engine/debug/expose.ts). */
interface Window {
  __CINEMA_READY__?: boolean
  __CINEMA__?: {
    frame: import('@/engine/store/cinematicStore').FrameState
    store: typeof import('@/engine/store/cinematicStore').useCinematicStore
    scrollToProgress: (p: number, behavior?: ScrollBehavior) => void
    renderer?: import('three').WebGLRenderer
    scene?: import('three').Scene
    camera?: import('three').Camera
    stats?: () => { calls: number; triangles: number; textures: number; geometries: number; programs: number }
  }
}
