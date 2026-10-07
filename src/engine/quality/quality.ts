/**
 * Quality tiers. Detected once at boot; may be stepped down at runtime by the PerformanceMonitor.
 * Every count/size that scales with device capability must come from here, never be hard-coded.
 */

export type QualityTier = 'high' | 'medium' | 'low'

export interface QualityProfile {
  tier: QualityTier
  /** [min, max] device pixel ratio passed to the R3F Canvas. */
  dpr: [number, number]
  antialias: boolean
  shadows: boolean
  /** Shadow map size when shadows are enabled. */
  shadowMapSize: number
  /** Square size of generated map/ink textures. */
  mapTextureSize: number
  /** Square size of generated grain textures. */
  grainTextureSize: number
  crowdCount: number
  luggageCount: number
  dustCount: number
  smokeCount: number
  /** Multiplier on landscape instance counts (trees, poles, fields). */
  landscapeDensity: number
  /** Maximum dynamic point lights in the world scene. */
  maxPointLights: number
  /** Whether the ambient idle motion (crowd sway, dust drift) runs. */
  idleMotion: boolean
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  high: {
    tier: 'high',
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    mapTextureSize: 4096,
    grainTextureSize: 512,
    crowdCount: 320,
    luggageCount: 220,
    dustCount: 1600,
    smokeCount: 500,
    landscapeDensity: 1,
    maxPointLights: 3,
    idleMotion: true,
  },
  medium: {
    tier: 'medium',
    dpr: [1, 1.5],
    antialias: true,
    shadows: false,
    shadowMapSize: 1024,
    mapTextureSize: 2048,
    grainTextureSize: 512,
    crowdCount: 160,
    luggageCount: 120,
    dustCount: 700,
    smokeCount: 250,
    landscapeDensity: 0.6,
    maxPointLights: 2,
    idleMotion: true,
  },
  low: {
    tier: 'low',
    dpr: [1, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    mapTextureSize: 2048,
    grainTextureSize: 256,
    crowdCount: 60,
    luggageCount: 50,
    dustCount: 250,
    smokeCount: 100,
    landscapeDensity: 0.35,
    maxPointLights: 1,
    idleMotion: false,
  },
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: coarse)').matches
}

/**
 * Heuristic tier detection. Deliberately conservative on mobile (spec §23).
 * `?quality=high|medium|low` in the URL forces a tier for testing.
 */
export function detectQuality(): QualityProfile {
  if (typeof window === 'undefined') return QUALITY_PROFILES.medium

  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced === 'high' || forced === 'medium' || forced === 'low') return QUALITY_PROFILES[forced]

  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const memory = nav.deviceMemory ?? 8
  const width = window.innerWidth
  const coarse = isCoarsePointer()
  const dpr = window.devicePixelRatio || 1

  let score = 0
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0
  score += width >= 1280 ? 1 : 0
  score -= coarse ? 2 : 0
  score -= dpr >= 3 ? 1 : 0

  const tier: QualityTier = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low'
  const profile = { ...QUALITY_PROFILES[tier] }
  if (prefersReducedMotion()) profile.idleMotion = false
  return profile
}

export function stepDown(profile: QualityProfile): QualityProfile {
  if (profile.tier === 'high') return { ...QUALITY_PROFILES.medium, idleMotion: profile.idleMotion }
  if (profile.tier === 'medium') return { ...QUALITY_PROFILES.low, idleMotion: profile.idleMotion }
  return profile
}
