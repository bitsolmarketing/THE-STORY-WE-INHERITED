import type { InkStroke, XZ } from '@/scenes/shared/ink'
import { PALETTE } from '@/scenes/world/layout'
import { spineFrame, spinePoint, type ChronicleLayout } from './layout'

/**
 * The chronicle's spine as a railway line (the journey that began on a 1947 platform): two rails,
 * sleepers laid exactly as the line is written ahead of the camera, and every year a milepost.
 *
 * Drawn as ink on the paper table, like a line on a surveyor's sheet, never as a 3D model.
 */
export const RAIL = {
  /** Half the drawn gauge (world units). */
  half: 0.19,
  sleeperHalf: 0.32,
  sleeperSpacing: 0.5,
  /** The line starts this far before the first frame and runs this far past the last. */
  lead: 40,
} as const

/** The motif-local time at which the written line reaches spine distance s (see ChronicleScene). */
export function railTimeAt(s: number, layout: ChronicleLayout): number {
  return (s + RAIL.lead) / (layout.length + RAIL.lead * 2)
}

export function railwayStrokes(layout: ChronicleLayout): InkStroke[] {
  const p = { x: 0, z: 0 }
  const f = { tx: 1, tz: 0, nx: 0, nz: 1 }
  const left: XZ[] = []
  const right: XZ[] = []
  for (let s = -RAIL.lead; s <= layout.length + RAIL.lead; s += 1.5) {
    spinePoint(s, p)
    spineFrame(s, f)
    left.push([p.x - f.nx * RAIL.half, p.z - f.nz * RAIL.half])
    right.push([p.x + f.nx * RAIL.half, p.z + f.nz * RAIL.half])
  }
  const strokes: InkStroke[] = [
    { points: left, width: 0.026, color: PALETTE.charcoal, alpha: 0.42, window: [0, 1] },
    { points: right, width: 0.026, color: PALETTE.charcoal, alpha: 0.42, window: [0, 1] },
  ]

  // Sleepers: each one appears the moment the rails reach it.
  const lay = (s: number, half: number, width: number, color: string, alpha: number, offset = 0) => {
    spinePoint(s, p)
    spineFrame(s, f)
    const w = railTimeAt(s, layout)
    strokes.push({
      points: [
        [p.x - f.nx * (half - offset), p.z - f.nz * (half - offset)],
        [p.x + f.nx * (half + offset), p.z + f.nz * (half + offset)],
      ],
      width,
      color,
      alpha,
      window: [w, w + 0.0008],
    })
  }
  for (let s = -RAIL.lead; s <= layout.length + RAIL.lead; s += RAIL.sleeperSpacing) lay(s, RAIL.sleeperHalf, 0.075, PALETTE.taupe, 0.55)

  // Mileposts: a heavier sleeper for every year, reaching out toward its numeral (left of the
  // line); decades reach further and are set in charcoal.
  for (const m of layout.marks) {
    const decade = m.year % 10 === 0
    lay(m.s, decade ? 0.5 : 0.42, decade ? 0.05 : 0.035, decade ? PALETTE.charcoal : PALETTE.brass, decade ? 0.6 : 0.7, decade ? -0.16 : -0.13)
  }
  return strokes
}
