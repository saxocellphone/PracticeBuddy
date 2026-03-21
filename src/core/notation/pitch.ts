import type { Note } from '@core/wasm/types.ts'
import type { StaffConfig } from './types.ts'
import { staffHeight, bottomLineY } from './config.ts'

/**
 * Map a pitch-class letter (ignoring accidentals) to a diatonic step index.
 * C=0, D=1, E=2, F=3, G=4, A=5, B=6
 */
export function diatonicStep(pitchClass: string): number {
  const base = pitchClass.charAt(0)
  const map: Record<string, number> = {
    C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
  }
  return map[base] ?? 0
}

/** Absolute diatonic step for G2 — the bottom line of the bass clef. */
export const BASS_CLEF_BOTTOM_STEP = 2 * 7 + 4 // G2 = octave 2, step G=4 → 18

/**
 * Convert a Note to its vertical Y position on the staff.
 * Lower Y values = higher on the SVG canvas = higher pitch.
 */
export function noteToStaffY(note: Note, config: StaffConfig): number {
  const step = note.octave * 7 + diatonicStep(note.pitchClass)
  const stepsFromBottom = step - BASS_CLEF_BOTTOM_STEP
  const halfLine = config.lineSpacing / 2
  const bottom = bottomLineY(config)
  return bottom - stepsFromBottom * halfLine
}

/**
 * Compute the Y coordinates of ledger lines needed for a note at the given Y.
 * Returns lines above or below the staff as necessary.
 */
export function getLedgerLines(noteY: number, config: StaffConfig): number[] {
  const lines: number[] = []
  const topLineY = config.staffTopMargin
  const bottom = config.staffTopMargin + staffHeight(config)

  // Ledger lines above the staff
  for (let y = topLineY - config.lineSpacing; y >= noteY - config.lineSpacing / 2 + 1; y -= config.lineSpacing) {
    lines.push(y)
  }
  // Ledger lines below the staff
  for (let y = bottom + config.lineSpacing; y <= noteY + config.lineSpacing / 2 - 1; y += config.lineSpacing) {
    lines.push(y)
  }

  // Ensure ledger lines for notes sitting ON a ledger line
  if (noteY < topLineY) {
    for (let y = topLineY - config.lineSpacing; y >= noteY - 0.5; y -= config.lineSpacing) {
      if (!lines.includes(y)) lines.push(y)
    }
  }
  if (noteY > bottom) {
    for (let y = bottom + config.lineSpacing; y <= noteY + 0.5; y += config.lineSpacing) {
      if (!lines.includes(y)) lines.push(y)
    }
  }

  return [...new Set(lines)]
}
