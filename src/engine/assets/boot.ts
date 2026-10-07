/**
 * Boot gate: the Loader waits until the first scene that mounts has generated its textures
 * (or a safety timeout passes), so the first frame the visitor sees is the real one.
 */
let resolveScene: (() => void) | null = null
const sceneReady = new Promise<void>((r) => (resolveScene = r))

export function markSceneReady(): void {
  resolveScene?.()
  resolveScene = null
}

export function waitForScene(timeoutMs = 9000): Promise<void> {
  return Promise.race([sceneReady, new Promise<void>((r) => setTimeout(r, timeoutMs))])
}

/** Fonts used inside canvases must be loaded before painting, or the map letters fall back. */
let fonts: Promise<void> | null = null
export function fontsReady(): Promise<void> {
  fonts ??= (async () => {
    try {
      await Promise.all([
        document.fonts.load('500 64px "Cormorant Garamond"'),
        document.fonts.load('italic 500 32px "Cormorant Garamond"'),
        document.fonts.load('400 32px "Cormorant Garamond"'),
        document.fonts.load('italic 400 32px "Cormorant Garamond"'),
        document.fonts.load('400 16px "JetBrains Mono"'),
      ])
      await document.fonts.ready
    } catch {
      /* fall back to system serif; never block the film on a font */
    }
  })()
  return fonts
}
