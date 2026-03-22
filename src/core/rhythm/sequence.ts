import { buildScaleNotes } from '@core/music/scaleBuilder.ts'
import { getStepLabel } from '@core/scales/presets.ts'
import { NOTE_DURATION_BEATS } from './types.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ScaleSequence } from '@core/scales/types.ts'
import type { NoteDuration, StepBoundary, ScaleStartPosition } from './types.ts'

/**
 * Build notes for ALL steps in a sequence and concatenate them into one
 * continuous run. Returns the flat note array plus step boundaries so
 * per-step results can be extracted later.
 */
export function buildAllStepsNotes(
  sequence: ScaleSequence,
  ignoreOctave: boolean,
  noteDuration?: NoteDuration,
  scaleStartPosition: ScaleStartPosition = 'strong-beat',
  range?: { minMidi: number; maxMidi: number },
): { allNotes: Note[]; boundaries: StepBoundary[]; restIndices: Set<number> } {
  const allNotes: Note[] = []
  const boundaries: StepBoundary[] = []
  const restIndices = new Set<number>()

  const beatsPerNote = noteDuration ? NOTE_DURATION_BEATS[noteDuration] : null
  const beatsPerMeasure = 4

  // Pre-build all steps to enable look-ahead for rest placeholder notes
  const stepsData = sequence.steps.map(step => ({
    step,
    label: getStepLabel(step, ignoreOctave),
    notes: buildScaleNotes(step, sequence.direction, sequence.numOctaves, range).notes,
  }))

  for (let i = 0; i < stepsData.length; i++) {
    const { step, label, notes } = stepsData[i]
    const startIndex = allNotes.length
    allNotes.push(...notes)
    boundaries.push({
      step,
      label,
      startNoteIndex: startIndex,
      endNoteIndex: allNotes.length,
    })

    // Insert rest padding between steps based on scaleStartPosition setting.
    if (beatsPerNote && i < stepsData.length - 1 && scaleStartPosition !== 'immediately') {
      const totalBeats = allNotes.length * beatsPerNote
      const beatInMeasure = totalBeats % beatsPerMeasure

      let targetBeat: number
      if (scaleStartPosition === 'next-measure') {
        // Pad to beat 1 of the next measure
        if (beatInMeasure === 0) continue
        targetBeat = beatsPerMeasure
      } else {
        // 'strong-beat': pad to next strong beat (1 or 3)
        if (beatInMeasure === 0) continue
        targetBeat = beatInMeasure < 2 ? 2 : beatsPerMeasure
      }

      const restBeats = targetBeat - beatInMeasure
      if (restBeats > 0.001) {
        const restSlots = Math.round(restBeats / beatsPerNote)
        const placeholderNote = stepsData[i + 1].notes[0]
        for (let r = 0; r < restSlots; r++) {
          restIndices.add(allNotes.length)
          allNotes.push(placeholderNote)
        }
      }
    }
  }

  return { allNotes, boundaries, restIndices }
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
