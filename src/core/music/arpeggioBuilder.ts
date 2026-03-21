import { noteFromName, noteFromMidi } from '@core/wasm/noteUtils.ts'
import { getArpeggioIntervals } from '@core/arpeggio/types.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioStep, ArpeggioDirection } from '@core/arpeggio/types.ts'

// Bass range: E1 (MIDI 28) to roughly G4 (MIDI 67)
const BASS_MIN_MIDI = 28
const BASS_MAX_MIDI = 67

// Roots that conventionally use sharp spellings
const SHARP_ROOTS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#'])

const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
}

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
}

/** Respell a note's pitch class to match the root's accidental convention */
function respellNote(note: Note, rootPitchClass: string): Note {
  const useSharp = SHARP_ROOTS.has(rootPitchClass)

  if (useSharp) {
    const sharp = FLAT_TO_SHARP[note.pitchClass]
    if (!sharp) return note
    return { ...note, pitchClass: sharp, name: `${sharp}${note.octave}` }
  } else {
    const flat = SHARP_TO_FLAT[note.pitchClass]
    if (!flat) return note
    return { ...note, pitchClass: flat, name: `${flat}${note.octave}` }
  }
}

/**
 * Build arpeggio notes for a given step and direction,
 * automatically adjusting octave to stay within bass guitar range.
 */
export function buildArpeggioNotes(
  step: ArpeggioStep,
  direction: ArpeggioDirection,
  numOctaves = 1,
): { notes: Note[]; octaveShift: number } {
  const intervals = getArpeggioIntervals(step.arpeggioType)

  let octave = step.rootOctave
  let octaveShift = 0

  const buildNotes = (startOctave: number): Note[] => {
    if (numOctaves <= 1) {
      const root = noteFromName(`${step.root}${startOctave}`)
      const ascending = intervals.map((interval) => {
        const note = interval === 0 ? root : noteFromMidi(root.midi + interval)
        return respellNote(note, step.root)
      })

      if (direction === 'ascending') return ascending
      if (direction === 'descending') return [...ascending].reverse()
      const descending = [...ascending].reverse().slice(1)
      return [...ascending, ...descending]
    }

    // Build ascending notes across octaves
    const ascendingNotes: Note[] = []
    for (let i = 0; i < numOctaves; i++) {
      const root = noteFromName(`${step.root}${startOctave + i}`)
      const octNotes = intervals.map((interval) => {
        const note = interval === 0 ? root : noteFromMidi(root.midi + interval)
        return respellNote(note, step.root)
      })
      if (i === 0) {
        ascendingNotes.push(...octNotes)
      } else {
        // Skip the root (it duplicates the last note of previous octave's top)
        ascendingNotes.push(...octNotes.slice(1))
      }
    }
    // Add the final octave's root to complete the span
    const finalRoot = noteFromName(`${step.root}${startOctave + numOctaves}`)
    ascendingNotes.push(respellNote(finalRoot, step.root))

    if (direction === 'ascending') return ascendingNotes
    if (direction === 'descending') return [...ascendingNotes].reverse()
    // ascendingDescending: up then down, skip repeated top note
    const descending = [...ascendingNotes].reverse().slice(1)
    return [...ascendingNotes, ...descending]
  }

  let notes = buildNotes(octave)

  // Shift down if notes exceed bass range
  while (notes.some((n) => n.midi > BASS_MAX_MIDI) && octave > 1) {
    octave -= 1
    octaveShift -= 1
    notes = buildNotes(octave)
  }

  // Shift up if notes are below bass range
  while (notes.some((n) => n.midi < BASS_MIN_MIDI) && octave < 4) {
    octave += 1
    octaveShift += 1
    notes = buildNotes(octave)
  }

  return { notes, octaveShift }
}
