import { LinearFilter, LinearMipmapLinearFilter, TextureLoader, type Texture } from 'three'

/**
 * Lazy, ref-counted image textures (spec §22: load only what is needed, dispose what is not).
 * Images are sampled raw (no colour-space conversion) because the shaders compute in display space.
 */
const loader = new TextureLoader()
const entries = new Map<string, { promise: Promise<Texture>; texture: Texture | null; refs: number }>()

export function acquireTexture(url: string): Promise<Texture> {
  let e = entries.get(url)
  if (!e) {
    const entry: { promise: Promise<Texture>; texture: Texture | null; refs: number } = { promise: Promise.resolve(null as unknown as Texture), texture: null, refs: 0 }
    entry.promise = loader.loadAsync(url).then((t) => {
      t.generateMipmaps = true
      t.minFilter = LinearMipmapLinearFilter
      t.magFilter = LinearFilter
      t.anisotropy = 4
      entry.texture = t
      return t
    })
    entries.set(url, entry)
    e = entry
  }
  e.refs++
  return e.promise
}

export function releaseTexture(url: string): void {
  const e = entries.get(url)
  if (!e) return
  e.refs--
  if (e.refs > 0) return
  // Keep it a moment: scrolling back and forth around a frame should not reload the image.
  setTimeout(() => {
    const now = entries.get(url)
    if (now && now.refs <= 0) {
      now.texture?.dispose()
      entries.delete(url)
    }
  }, 4000)
}
