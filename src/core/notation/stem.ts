import type { NoteDuration } from '@core/rhythm/types.ts'
import type { StaffConfig } from './types.ts'
import { middleLineY } from './config.ts'

/** Returns true if the note's stem should point up (note is on or below the middle line). */
export function stemUp(noteY: number, config: StaffConfig): boolean {
  return noteY >= middleLineY(config)
}

/**
 * X coordinate of the stem for a note at the given position.
 * Stem-up notes attach at the right side of the note head; stem-down at the left.
 */
export function stemX(noteX: number, noteY: number, config: StaffConfig): number {
  return stemUp(noteY, config) ? noteX + config.noteRadius : noteX - config.noteRadius
}

/** Y coordinate of the stem tip (the end farthest from the note head). */
export function stemTipY(noteY: number, config: StaffConfig): number {
  const length = stemLength(config)
  return stemUp(noteY, config) ? noteY - length : noteY + length
}

/** Whether a given note duration has a stem. Whole notes do not. */
export function hasStem(duration: NoteDuration): boolean {
  return duration !== 'whole'
}

/** Stem length computed from config (lineSpacing * stemLengthMultiplier). */
export function stemLength(config: StaffConfig): number {
  return config.stemLengthMultiplier * config.lineSpacing
}
