/**
 * World coordinate frame shared by every scene module and the camera path.
 *
 * Units: 1 world unit ≈ 1 metre at human scale. The map lives on the same ground plane
 * (y = 0) at a different notional scale; see MAP below.
 *
 * Axes: +X runs along the track (the direction of travel). North on the map is −Z.
 * The platform is on the +Z side of the track; the open landscape is on the −Z side,
 * which is what the window seat looks out on.
 */

export const GROUND = {
  y: 0,
  /** Full size of the paper/ground plane (square). */
  size: 480,
} as const

/**
 * The drawn map occupies a square of this size centred on MAP.center (world XZ).
 * Lahore/Amritsar sit near the world origin (projection centre), so the station the camera
 * descends into stands on the Punjab, on the line people crossed.
 */
export const MAP = {
  size: 150,
  /** World XZ of the map square's centre (covers Peshawar → Colombo, Quetta → Chittagong). */
  center: [22, 30] as readonly [number, number],
  /** Longitude/latitude the projection is centred on (between Lahore and Amritsar). */
  centerLonLat: [74.2, 31.5] as readonly [number, number],
  /** World units per degree of latitude at the projection centre (sets geographic scale). */
  unitsPerDegree: 3.2,
} as const

/** Camera framings on the map (world XZ of the look target + camera height). */
export const MAP_FRAMES = {
  /** The whole subcontinent, Peshawar to Colombo. */
  subcontinent: { x: 9, z: 30, height: 150 },
  /** Both wings of the new state, West and East Pakistan (sits high in frame, clear of the caption). */
  wings: { x: 11, z: 13, height: 112 },
  /** The Punjab boundary between Lahore and Amritsar. */
  punjab: { x: 1, z: 0, height: 46 },
} as const

/** "1947" pressed into the paper (relief only, no ink), centred under the 'land' framing. */
export const EMBOSS = {
  center: [9, 33] as readonly [number, number],
  width: 58,
  height: 24,
} as const

export const TRACK = {
  z: 0,
  /** Indian broad gauge, 5 ft 6 in. */
  gauge: 1.676,
  railTop: 0.16,
  sleeperSpacing: 0.65,
  xMin: -140,
  xMax: 220,
} as const

export const PLATFORM = {
  y: 0.95,
  zMin: 1.75,
  zMax: 10,
  xMin: -30,
  xMax: 70,
  /** Columns along the platform. */
  columnZ: 5.5,
  columnSpacing: 7,
  roofY: 6.2,
} as const

export const TRAIN = {
  centerZ: 0,
  floorY: 1.25,
  carriage: {
    length: 19,
    width: 3.2,
    height: 3.5,
    gap: 1.1,
    count: 3,
  },
  /** X of the first (west-most) carriage's centre. */
  firstCarriageX: -4,
  /** The locomotive sits ahead (+X) of the last carriage. */
  locomotiveLength: 14,
  /** Platform-side door the protagonist boards through. */
  door: { x: 18, z: 1.6, width: 0.9, height: 2.1 },
} as const

/** The compartment the camera enters. */
export const INTERIOR = {
  /** Where the camera sits: across the compartment, far enough back for the window to read as a frame. */
  seat: { x: 20.6, y: 2.5, z: 0.35 },
  /** Centre of the window the seat looks through (in the −Z wall). */
  window: { x: 20.6, y: 2.55, z: -1.58, width: 1.3, height: 1.05 },
  /** Direction the seated camera looks (out of the window, slightly forward). */
  lookTarget: { x: 24, y: 2.3, z: -30 },
} as const

export const PROTAGONIST = {
  startX: 1,
  endX: 17.4,
  z: 4.2,
  height: 1.72,
  /** Chapter-local progress at which they are at the door. */
  reachesDoorAt: 0.92,
} as const

export const LANDSCAPE = {
  zNear: -5,
  zFar: -260,
  /** Total world distance that slides past the window across the departure chapter. */
  travelDistance: 420,
  poleSpacing: 16,
} as const

export const LIGHT = {
  /** Late-afternoon sun from the north-west, warm. */
  sunDirection: [-0.55, 0.62, -0.56] as readonly [number, number, number],
  sunColor: '#F4E3BF',
  skyColor: '#E8DDCA',
  hazeColor: '#D4C5AD',
  dawnColor: '#FCFAF5',
} as const

export const PALETTE = {
  ivory: '#F5F1E8',
  parchment: '#E8DDCA',
  sandstone: '#D4C5AD',
  taupe: '#B8A88F',
  olive: '#3E604F',
  sage: '#8FA294',
  softWhite: '#FCFAF5',
  charcoal: '#3C3B36',
  brass: '#A88B57',
} as const
