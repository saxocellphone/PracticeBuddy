import { noteFromName } from '@core/wasm/noteUtils.ts'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { MeasureLabel } from '@core/notation/MeasureStaff.tsx'
import type { WalkingBassStep } from '@core/walking-bass/types.ts'
import type { JazzStandard, JazzStandardMeasure } from './types.ts'

export interface MelodyMeasureData {
  notes: Array<{ note: Note; duration: NoteDuration }>
  labels: MeasureLabel[]
  restIndices: Set<number>
  /** If true, this is a pickup measure — rendered narrower and exempt from 4-per-line grouping */
  pickup?: boolean
}

/**
 * Convert a JazzStandard's measures into notation-ready data.
 * Each MelodyNote is resolved to a full Note via WASM noteFromName().
 * ChordChange entries become MeasureLabel[] for chord symbol display.
 * MelodyRest events produce a rest placeholder note with the rest index tracked.
 */
export function standardToMelodyMeasures(
  standard: JazzStandard,
): MelodyMeasureData[] {
  return standard.measures.map((measure) => {
    const notes: Array<{ note: Note; duration: NoteDuration }> = []
    const restIndices = new Set<number>()

    for (const event of measure.melody) {
      const index = notes.length
      if (event.type === 'rest') {
        // Use a placeholder note for rest positioning; mark as rest
        const placeholder = noteFromName('B3')
        notes.push({ note: placeholder, duration: event.duration })
        restIndices.add(index)
      } else {
        const note = noteFromName(`${event.pitchClass}${event.octave}`)
        notes.push({ note, duration: event.duration })
      }
    }

    const labels = chordChangesToLabels(measure)

    return { notes, labels, restIndices, pickup: measure.pickup }
  })
}

/**
 * Map chord changes to MeasureLabel[] by matching beat positions to note indices.
 * Each chord's beat is mapped to the note index whose cumulative beat position
 * aligns with (or is closest to) the chord beat.
 */
function chordChangesToLabels(measure: JazzStandardMeasure): MeasureLabel[] {
  if (measure.chords.length === 0) return []

  // Build cumulative beat positions for each melody event
  const beatPositions: number[] = []
  let beat = 1
  for (const event of measure.melody) {
    beatPositions.push(beat)
    beat += NOTE_DURATION_BEATS[event.duration]
  }

  return measure.chords.map((chord) => {
    // Find the note index at or just after this chord's beat
    let noteIndex = 0
    for (let i = 0; i < beatPositions.length; i++) {
      if (beatPositions[i] <= chord.beat) {
        noteIndex = i
      }
    }
    return { noteIndex, text: chord.symbol }
  })
}

/**
 * Convert a JazzStandard's chord changes into WalkingBassStep[] for the
 * existing walking bass engine. Measures with multiple chords produce
 * one step per chord.
 */
export function standardToWalkingBassSequence(
  standard: JazzStandard,
  rootOctave: number,
): WalkingBassStep[] {
  const steps: WalkingBassStep[] = []

  for (const measure of standard.measures) {
    for (const chord of measure.chords) {
      steps.push({
        root: chord.root,
        rootOctave,
        quality: chord.quality,
        chordSymbol: chord.symbol,
      })
    }
  }

  return steps
}
