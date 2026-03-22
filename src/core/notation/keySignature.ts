import type { Note } from '@core/wasm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { StaffConfig } from './types.ts'
import { staffHeight } from './config.ts'

/** Standard order of sharps in a key signature. */
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const

/** Standard order of flats in a key signature. */
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const

/**
 * Staff positions for each sharp in SHARP_ORDER — bass clef.
 * Expressed as diatonic steps from the bottom staff line (G2).
 */
export const SHARP_STEPS = [6, 3, 7, 4, 1, 5, 2] as const // F3, C3, G3, D3, A2, E3, B2

/**
 * Staff positions for each flat in FLAT_ORDER — bass clef.
 * Expressed as diatonic steps from the bottom staff line (G2).
 */
export const FLAT_STEPS = [2, 5, 1, 4, 0, 3, 6] as const // B2, E3, A2, D3, G2, C3, F3

/**
 * Staff positions for each sharp in SHARP_ORDER — treble clef.
 * Expressed as diatonic steps from the bottom staff line (E4).
 */
export const SHARP_STEPS_TREBLE = [5, 2, 6, 3, 0, 4, 1] as const // F5, C5, G5, D5, A4, E5, B4

/**
 * Staff positions for each flat in FLAT_ORDER — treble clef.
 * Expressed as diatonic steps from the bottom staff line (E4).
 */
export const FLAT_STEPS_TREBLE = [1, 4, 0, 3, -1, 2, 5] as const // B4, E5, A4, D5, G4(below), C5, F5

/** Pick the right sharp/flat step arrays for the given clef. */
function stepsForClef(clef: ClefType = 'bass'): { sharpSteps: readonly number[]; flatSteps: readonly number[] } {
  if (clef === 'treble') return { sharpSteps: SHARP_STEPS_TREBLE, flatSteps: FLAT_STEPS_TREBLE }
  return { sharpSteps: SHARP_STEPS, flatSteps: FLAT_STEPS }
}

export interface KeySignatureInfo {
  type: 'sharp' | 'flat' | 'none'
  accidentals: string[]
  steps: number[]
}

/**
 * Circle-of-fifths position for each root pitch class.
 * Positive = sharps, negative = flats.
 */
const CIRCLE_OF_FIFTHS: Record<string, number> = {
  'C': 0,
  'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
}

/**
 * Circle-of-fifths offset for each scale type relative to major.
 * E.g. Dorian from root X has the same key sig as major from 2 fifths lower.
 */
const SCALE_TYPE_OFFSET: Record<string, number> = {
  'Major': 0,
  'Natural Minor': -3,
  'Harmonic Minor': -3,
  'Melodic Minor': -3,
  'Dorian': -2,
  'Phrygian': -4,
  'Lydian': 1,
  'Mixolydian': -1,
  'Locrian': -5,
  'Major Pentatonic': 0,
  'Minor Pentatonic': -3,
  'Blues': -3,
}

/**
 * Build a KeySignatureInfo from a circle-of-fifths position.
 * Positive = sharps, negative = flats.
 */
function buildFromPosition(position: number, clef: ClefType = 'bass'): KeySignatureInfo {
  if (position === 0) return { type: 'none', accidentals: [], steps: [] }

  const { sharpSteps, flatSteps } = stepsForClef(clef)

  if (position > 0) {
    const count = Math.min(position, 7)
    return {
      type: 'sharp',
      accidentals: Array.from({ length: count }, () => '\u266F'),
      steps: sharpSteps.slice(0, count) as unknown as number[],
    }
  }

  const count = Math.min(-position, 7)
  return {
    type: 'flat',
    accidentals: Array.from({ length: count }, () => '\u266D'),
    steps: flatSteps.slice(0, count) as unknown as number[],
  }
}

/**
 * Compute the key signature from the circle of fifths using the root pitch class
 * and optional scale type name. This bypasses note analysis and handles enharmonic
 * spellings correctly (e.g. Gb major → 6 flats, not 6 sharps).
 *
 * Returns null if the root or scale type is not recognized, so the caller can
 * fall back to note-based analysis.
 */
export function getKeySignatureForScale(
  rootPitchClass: string,
  scaleType?: string,
  clef: ClefType = 'bass',
): KeySignatureInfo | null {
  const basePosition = CIRCLE_OF_FIFTHS[rootPitchClass]
  if (basePosition === undefined) return null

  const offset = scaleType ? (SCALE_TYPE_OFFSET[scaleType] ?? null) : 0
  if (offset === null) return null

  return buildFromPosition(basePosition + offset, clef)
}

/**
 * Extract the key signature from a set of scale notes.
 * Returns accidentals in standard order for rendering.
 * Mixed sharps/flats (exotic scales) produce no key signature.
 *
 * Note: This approach can produce incorrect results when WASM normalizes
 * enharmonic spellings (e.g. Cb→B). Prefer getKeySignatureForScale() when
 * the root pitch class is available.
 */
export function getKeySignature(notes: Note[], clef: ClefType = 'bass'): KeySignatureInfo {
  const accidentalNotes = new Set<string>()
  for (const note of notes) {
    if (note.pitchClass.includes('#')) accidentalNotes.add(note.pitchClass.charAt(0))
    else if (note.pitchClass.includes('b') && note.pitchClass.length > 1) accidentalNotes.add(note.pitchClass.charAt(0))
  }

  if (accidentalNotes.size === 0) return { type: 'none', accidentals: [], steps: [] }

  const { sharpSteps, flatSteps } = stepsForClef(clef)

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
        steps.push(sharpSteps[i])
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
        steps.push(flatSteps[i])
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
