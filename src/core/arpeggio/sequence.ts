import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'
import { getArpeggioStepLabel } from './presets.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ScaleSequence, ScaleStep } from '@core/endless/types.ts'
import type { StepBoundary } from '@core/rhythm/types.ts'
import type { ArpeggioSequence, ArpeggioStep } from './types.ts'

/**
 * Convert an ArpeggioStep into a ScaleStep-shaped object for compatibility
 * with the rhythm engine's StepBoundary type.
 */
function toScaleStep(step: ArpeggioStep, ignoreOctave: boolean): ScaleStep {
  return {
    rootNote: step.root,
    rootOctave: step.rootOctave,
    scaleTypeIndex: -1,
    label: getArpeggioStepLabel(step, ignoreOctave),
  }
}

/**
 * Build notes for ALL steps in an arpeggio sequence and concatenate them
 * into one continuous run. Returns the flat note array plus step boundaries
 * compatible with the rhythm engine.
 */
export function buildAllArpeggioStepsNotes(
  sequence: ArpeggioSequence,
  ignoreOctave: boolean,
): { allNotes: Note[]; boundaries: StepBoundary[] } {
  const allNotes: Note[] = []
  const boundaries: StepBoundary[] = []

  for (const step of sequence.steps) {
    const startIndex = allNotes.length
    const { notes } = buildArpeggioNotes(step, sequence.direction, sequence.numOctaves ?? 1)
    allNotes.push(...notes)
    boundaries.push({
      step: toScaleStep(step, ignoreOctave),
      label: getArpeggioStepLabel(step, ignoreOctave),
      startNoteIndex: startIndex,
      endNoteIndex: allNotes.length,
    })
  }

  return { allNotes, boundaries }
}

/**
 * Adapt an ArpeggioSequence into a ScaleSequence-shaped object so that
 * the rhythm hook's state types are satisfied. The adapted sequence is
 * only used for display (labels, step count) — not for note building.
 */
export function arpeggioToScaleSequence(
  sequence: ArpeggioSequence,
  ignoreOctave: boolean,
): ScaleSequence {
  return {
    id: sequence.id,
    name: sequence.name,
    description: sequence.description,
    direction: sequence.direction === 'ascendingDescending' ? 'both' : sequence.direction,
    shiftSemitones: sequence.shiftSemitones,
    skipTransition: sequence.skipTransition,
    steps: sequence.steps.map((step) => toScaleStep(step, ignoreOctave)),
  }
}
