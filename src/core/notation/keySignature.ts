import type { Note } from '@core/wasm/types.ts'
import type { StaffConfig } from './types.ts'
import { staffHeight } from './config.ts'

/** Standard order of sharps in a key signature. */
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const

/** Standard order of flats in a key signature. */
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const

/**
 * Staff positions for each sharp in SHARP_ORDER.
 * Expressed as diatonic steps from the bottom staff line (G2) in bass clef.
 */
export const SHARP_STEPS = [6, 3, 7, 4, 1, 5, 2] as const // F3, C3, G3, D3, A2, E3, B2

/**
 * Staff positions for each flat in FLAT_ORDER.
 * Expressed as diatonic steps from the bottom staff line (G2) in bass clef.
 */
export const FLAT_STEPS = [2, 5, 1, 4, 0, 3, 6] as const // B2, E3, A2, D3, G2, C3, F3

export interface KeySignatureInfo {
  type: 'sharp' | 'flat' | 'none'
  accidentals: string[]
  steps: number[]
}

/**
 * Extract the key signature from a set of scale notes.
 * Returns accidentals in standard order for rendering.
 * Mixed sharps/flats (exotic scales) produce no key signature.
 */
export function getKeySignature(notes: Note[]): KeySignatureInfo {
  const accidentalNotes = new Set<string>()
  for (const note of notes) {
    if (note.pitchClass.includes('#')) accidentalNotes.add(note.pitchClass.charAt(0))
    else if (note.pitchClass.includes('b') && note.pitchClass.length > 1) accidentalNotes.add(note.pitchClass.charAt(0))
  }

  if (accidentalNotes.size === 0) return { type: 'none', accidentals: [], steps: [] }

  // Check if all accidentals are sharps or all flats
  const hasSharp = notes.some((n) => n.pitchClass.includes('#'))
  const hasFlat = notes.some((n) => n.pitchClass.includes('b') && n.pitchClass.length > 1)

  if (hasSharp && !hasFlat) {
    // Collect sharps in standard order
    const accidentals: string[] = []
    const steps: number[] = []
    for (let i = 0; i < SHARP_ORDER.length; i++) {
      if (accidentalNotes.has(SHARP_ORDER[i])) {
        accidentals.push('\u266F') // ♯
        steps.push(SHARP_STEPS[i])
      }
    }
    return { type: 'sharp', accidentals, steps }
  }

  if (hasFlat && !hasSharp) {
    const accidentals: string[] = []
    const steps: number[] = []
    for (let i = 0; i < FLAT_ORDER.length; i++) {
      if (accidentalNotes.has(FLAT_ORDER[i])) {
        accidentals.push('\u266D') // ♭
        steps.push(FLAT_STEPS[i])
      }
    }
    return { type: 'flat', accidentals, steps }
  }

  // Mixed sharps/flats (exotic scales) — no key signature, use individual accidentals
  return { type: 'none', accidentals: [], steps: [] }
}

/**
 * Convert a staff-position step (from SHARP_STEPS / FLAT_STEPS) to a Y coordinate.
 * Steps are counted as diatonic half-line increments from the bottom staff line.
 */
export function stepsToY(stepsFromBottom: number, config: StaffConfig): number {
  const halfLine = config.lineSpacing / 2
  const bottom = config.staffTopMargin + staffHeight(config)
  return bottom - stepsFromBottom * halfLine
}
