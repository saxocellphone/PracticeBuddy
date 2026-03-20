import { buildScale, getScaleType } from '@core/wasm/scales.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ScaleStep } from '@core/endless/types.ts'

// Bass range: E1 (MIDI 28) to roughly G4 (MIDI 67)
const BASS_MIN_MIDI = 28
const BASS_MAX_MIDI = 67

/**
 * Build scale notes for a given step, automatically adjusting the octave
 * to stay within the bass guitar range (E1–G4).
 *
 * Shared by both the endless practice and rhythm practice hooks.
 */
export function buildScaleNotes(
  step: ScaleStep,
  direction: string,
  numOctaves = 1,
): { notes: Note[]; octaveShift: number } {
  const ScaleType = getScaleType()
  const scaleTypeValues = Object.values(ScaleType).filter(
    (v) => typeof v === 'number',
  ) as number[]
  const scaleType = scaleTypeValues[step.scaleTypeIndex] ?? 0
  const dir = direction as 'ascending' | 'descending' | 'both'

  let octave = step.rootOctave
  let octaveShift = 0

  const buildMultiOctave = (startOctave: number): Note[] => {
    if (numOctaves <= 1) {
      return buildScale(`${step.rootNote}${startOctave}`, scaleType, dir)
    }

    // Build ascending notes across octaves, then apply direction
    const ascendingNotes: Note[] = []
    for (let i = 0; i < numOctaves; i++) {
      const octNotes = buildScale(
        `${step.rootNote}${startOctave + i}`,
        scaleType,
        'ascending',
      )
      if (i === 0) {
        ascendingNotes.push(...octNotes)
      } else {
        // Skip the root (it duplicates the last note of previous octave)
        ascendingNotes.push(...octNotes.slice(1))
      }
    }

    if (dir === 'ascending') return ascendingNotes
    if (dir === 'descending') return [...ascendingNotes].reverse()
    // 'both': ascending then descending, skip repeated top note
    const descending = [...ascendingNotes].reverse().slice(1)
    return [...ascendingNotes, ...descending]
  }

  let notes = buildMultiOctave(octave)

  // Shift down if notes exceed bass range
  while (notes.some((n) => n.midi > BASS_MAX_MIDI) && octave > 1) {
    octave -= 1
    octaveShift -= 1
    notes = buildMultiOctave(octave)
  }

  // Shift up if notes are below bass range
  while (notes.some((n) => n.midi < BASS_MIN_MIDI) && octave < 4) {
    octave += 1
    octaveShift += 1
    notes = buildMultiOctave(octave)
  }

  return { notes, octaveShift }
}
