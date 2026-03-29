/**
 * Tie — renders a curved arc connecting two notes of the same pitch
 * across a barline or within a measure.
 *
 * For cross-barline ties, two half-ties are drawn:
 *   - "out" tie: from the note to the right edge of the measure
 *   - "in" tie:  from the left edge of the measure to the note
 *
 * The curve direction follows standard engraving: ties curve away
 * from the staff center (up for stem-down notes, down for stem-up).
 */

import type { StaffConfig } from '../types.ts'
import { stemUp } from '../stem.ts'

interface TieProps {
  /** X of the starting note */
  x1: number
  /** X of the ending note (or measure edge) */
  x2: number
  /** Y of the note (both ends are at the same pitch) */
  y: number
  config: StaffConfig
  color?: string
}

export function Tie({ x1, x2, y, config, color }: TieProps) {
  const noteColor = color ?? config.colors.note
  const up = stemUp(y, config)

  // Tie curves away from staff center: if stem goes up, tie curves down (and vice versa)
  const curveDown = up
  const midX = (x1 + x2) / 2
  const span = Math.abs(x2 - x1)
  // Scale curve height with span, clamped to a reasonable range
  const curveHeight = Math.min(Math.max(span * 0.15, 4), 14)
  const yOffset = curveDown ? config.noteRadius + 2 : -(config.noteRadius + 2)
  const cpYOffset = curveDown ? curveHeight : -curveHeight

  const startY = y + yOffset
  const cpY = startY + cpYOffset

  const d = `M ${x1} ${startY} Q ${midX} ${cpY} ${x2} ${startY}`

  return (
    <path
      d={d}
      fill="none"
      stroke={noteColor}
      strokeWidth={1.5}
    />
  )
}
