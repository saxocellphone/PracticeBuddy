import type { Note } from '@core/wasm/types.ts'
import type { ScaleSequence } from '@core/scales/types.ts'
import type { StepBoundary } from '@core/rhythm/types.ts'
import type { WalkingBassSequence, WalkingBassPattern } from './types.ts'
import { buildWalkingBassNotes } from './builder.ts'
import { getPatternById, WALKING_BASS_PATTERNS } from './patterns.ts'

/**
 * Build notes for ALL steps in a walking bass sequence.
 * Each step produces exactly 4 quarter notes (one measure in 4/4).
 * No rest padding needed — each chord fills a complete measure.
 */
export function buildAllWalkingBassStepsNotes(
  sequence: WalkingBassSequence,
  range?: { minMidi: number; maxMidi: number },
): { allNotes: Note[]; boundaries: StepBoundary[] } {
  const allNotes: Note[] = []
  const boundaries: StepBoundary[] = []

  const pattern: WalkingBassPattern = sequence.patternId
    ? (getPatternById(sequence.patternId) ?? WALKING_BASS_PATTERNS[0])
    : WALKING_BASS_PATTERNS[0]

  for (let i = 0; i < sequence.steps.length; i++) {
    const step = sequence.steps[i]
    const nextStep = i < sequence.steps.length - 1
      ? sequence.steps[i + 1]
      : sequence.steps[0] // wrap to first chord for approach note on last chord

    const startIndex = allNotes.length
    const notes = buildWalkingBassNotes(step, pattern, nextStep, sequence.approachType, range)
    allNotes.push(...notes)

    boundaries.push({
      step: {
        rootNote: step.root,
        rootOctave: step.rootOctave,
        scaleTypeIndex: 0,
        label: step.label ?? step.chordSymbol,
        chordSymbol: step.chordSymbol,
      },
      label: step.chordSymbol,
      startNoteIndex: startIndex,
      endNoteIndex: allNotes.length,
    })
  }

  return { allNotes, boundaries }
}

/**
 * Adapt a WalkingBassSequence into a ScaleSequence shape for the rhythm engine.
 * This allows reuse of useRhythmPractice and RhythmPracticeView.
 */
export function walkingBassToScaleSequence(
  sequence: WalkingBassSequence,
): ScaleSequence {
  return {
    id: sequence.id,
    name: sequence.name,
    description: sequence.description,
    direction: 'ascending',
    numOctaves: 1,
    shiftSemitones: 0,
    skipTransition: true,
    steps: sequence.steps.map(step => ({
      rootNote: step.root,
      rootOctave: step.rootOctave,
      scaleTypeIndex: 0,
      label: step.label ?? step.chordSymbol,
      chordSymbol: step.chordSymbol,
    })),
  }
}
