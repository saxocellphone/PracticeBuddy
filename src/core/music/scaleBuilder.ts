import { buildScale, getScaleType } from '@core/wasm/scales.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ScaleStep } from '@core/endless/types.ts'

// Bass range: E1 (MIDI 28) to roughly G4 (MIDI 67)
export const BASS_MIN_MIDI = 28
export const BASS_MAX_MIDI = 67

/**
 * Build scale notes for a given step, automatically adjusting the octave
 * to stay within the instrument range.
 *
 * @param range Optional MIDI range override. Defaults to bass guitar (E1–G4).
 */
export function buildScaleNotes(
  step: ScaleStep,
  direction: string,
  numOctaves = 1,
  range?: { minMidi: number; maxMidi: number },
): { notes: Note[]; octaveShift: number } {
  const minMidi = range?.minMidi ?? BASS_MIN_MIDI
  const maxMidi = range?.maxMidi ?? BASS_MAX_MIDI
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

  // Shift down if notes exceed range
  while (notes.some((n) => n.midi > maxMidi) && octave > 1) {
    octave -= 1
    octaveShift -= 1
    notes = buildMultiOctave(octave)
  }

  // Shift up if notes are below range
  while (notes.some((n) => n.midi < minMidi) && octave < 6) {
    octave += 1
    octaveShift += 1
    notes = buildMultiOctave(octave)
  }

  return { notes, octaveShift }
}

/**
 * Check whether a scale fits within the instrument range after auto-adjustment.
 *
 * @param range Optional MIDI range override. Defaults to bass guitar (E1–G4).
 */
export function isScalePlayable(
  step: ScaleStep,
  direction: string,
  numOctaves = 1,
  range?: { minMidi: number; maxMidi: number },
): boolean {
  const minMidi = range?.minMidi ?? BASS_MIN_MIDI
  const maxMidi = range?.maxMidi ?? BASS_MAX_MIDI
  try {
    const { notes } = buildScaleNotes(step, direction, numOctaves, range)
    return notes.every(n => n.midi >= minMidi && n.midi <= maxMidi)
  } catch {
    return false
  }
}
