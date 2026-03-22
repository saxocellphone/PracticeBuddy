import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { NoteLayout, StaffConfig } from './types.ts'
import { noteToStaffY } from './pitch.ts'

export interface MeasureFormatOptions {
  /** X offset for clef, time signature, etc. */
  leftPad: number
  /** Total width available for notes (SVG units). */
  availableWidth: number
  /** Beats per measure (e.g. 4 for 4/4 time). */
  beatsPerMeasure: number
  /** Beat value of each note (e.g. 1 for quarter, 0.5 for eighth). */
  noteDurationBeats: number
}

/**
 * Lay out notes within a single measure for rhythm practice.
 *
 * Uses fixed spacing based on the beat grid so notes align with scroll speed.
 * Partial measures keep the same spacing with empty space at the end, rather
 * than stretching to fill — this prevents the playhead from drifting.
 */
export function formatMeasureNotes(
  notes: Array<{ note: Note; duration: NoteDuration }>,
  config: StaffConfig,
  options: MeasureFormatOptions,
): NoteLayout[] {
  if (notes.length === 0) return []

  const { leftPad, availableWidth, beatsPerMeasure, noteDurationBeats } = options
  const expectedNotesPerMeasure = Math.round(beatsPerMeasure / noteDurationBeats)
  const noteSpacing = availableWidth / expectedNotesPerMeasure

  return notes.map(({ note, duration }, index) => {
    const x = leftPad + noteSpacing * (index + 0.5)
    const y = noteToStaffY(note, config)
    return { note, duration, x, y, index }
  })
}

export interface ScaleFormatOptions {
  /** X offset for the first note (after clef + key signature). */
  leftMargin: number
  /** Horizontal distance between note centers. */
  noteSpacing: number
  /** Duration to assign to each note (default: 'quarter'). */
  duration?: NoteDuration
}

/**
 * Lay out notes for a scale display (scale practice mode).
 *
 * Spacing is uniform. Duration defaults to quarter notes but can
 * be overridden to render different note head styles.
 */
export function formatScaleNotes(
  notes: Note[],
  config: StaffConfig,
  options: ScaleFormatOptions,
): NoteLayout[] {
  const { leftMargin, noteSpacing, duration = 'quarter' } = options
  return notes.map((note, index) => {
    const x = leftMargin + index * noteSpacing
    const y = noteToStaffY(note, config)
    return { note, duration, x, y, index }
  })
}
