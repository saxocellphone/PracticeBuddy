import type { AccidentalType } from './types.ts'

/**
 * Determine whether a pitch class has a sharp or flat accidental.
 * Returns null for natural notes.
 */
export function getAccidental(pitchClass: string): AccidentalType {
  if (pitchClass.includes('#')) return 'sharp'
  if (pitchClass.includes('b') && pitchClass.length > 1) return 'flat'
  return null
}
