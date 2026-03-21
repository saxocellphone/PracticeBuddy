/**
 * NoteLabel — renders a small monospace text label below (or at) a given position,
 * typically used to display the note name underneath the staff.
 *
 * Extracted from StaffNotation.tsx's per-note label rendering.
 */

import type { Note } from '@core/wasm/types.ts'

interface NoteLabelProps {
  x: number
  y: number
  note: Note
  color: string
  fontWeight?: number
  /** When true, display only the pitch class (e.g. "C#") instead of the full name (e.g. "C#3"). */
  ignoreOctave?: boolean
}

export function NoteLabel({
  x,
  y,
  note,
  color,
  fontWeight = 400,
  ignoreOctave = false,
}: NoteLabelProps) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={9}
      fontFamily="'JetBrains Mono', 'Fira Code', monospace"
      fontWeight={fontWeight}
      textAnchor="middle"
    >
      {ignoreOctave ? note.pitchClass : note.name}
    </text>
  )
}
