import { buildScaleNotes } from '@core/music/scaleBuilder.ts'
import { getStepLabel } from '@core/endless/presets.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ScaleSequence } from '@core/endless/types.ts'
import type { StepBoundary } from './types.ts'

/**
 * Build notes for ALL steps in a sequence and concatenate them into one
 * continuous run. Returns the flat note array plus step boundaries so
 * per-step results can be extracted later.
 */
export function buildAllStepsNotes(
  sequence: ScaleSequence,
  ignoreOctave: boolean,
): { allNotes: Note[]; boundaries: StepBoundary[] } {
  const allNotes: Note[] = []
  const boundaries: StepBoundary[] = []

  for (const step of sequence.steps) {
    const startIndex = allNotes.length
    const { notes } = buildScaleNotes(step, sequence.direction, sequence.numOctaves)
    allNotes.push(...notes)
    boundaries.push({
      step,
      label: getStepLabel(step, ignoreOctave),
      startNoteIndex: startIndex,
      endNoteIndex: allNotes.length,
    })
  }

  return { allNotes, boundaries }
}

/**
 * Determine which step boundary a given note index falls within.
 */
export function getActiveStepIndex(boundaries: StepBoundary[], noteIndex: number): number {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (noteIndex >= boundaries[i].startNoteIndex) {
      return i
    }
  }
  return 0
}
