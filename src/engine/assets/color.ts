import { Color, Vector3 } from 'three'

/**
 * Colour helpers for custom shaders. See docs/CONVENTIONS.md → Colour.
 * Custom ShaderMaterials compute in display (sRGB) space, so palette hexes are passed raw.
 */
export function srgbVec3(hex: string, out = new Vector3()): Vector3 {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return out.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** A three Color holding the *linear* value of a palette hex (for standard materials, lights, fog). */
export function linearColor(hex: string): Color {
  return new Color(hex)
}

export function mixHex(a: string, b: string, t: number): string {
  const va = srgbVec3(a)
  const vb = srgbVec3(b)
  const r = Math.round((va.x + (vb.x - va.x) * t) * 255)
  const g = Math.round((va.y + (vb.y - va.y) * t) * 255)
  const bl = Math.round((va.z + (vb.z - va.z) * t) * 255)
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
