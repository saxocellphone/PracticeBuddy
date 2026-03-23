import { noteFromName, noteFromMidi } from '@core/wasm/noteUtils.ts'
import { getArpeggioIntervals } from '@core/arpeggio/types.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioStep, ArpeggioDirection } from '@core/arpeggio/types.ts'

import { BASS_MIN_MIDI, BASS_MAX_MIDI } from './scaleBuilder.ts'

// Roots that conventionally use sharp spellings
const SHARP_ROOTS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#'])

const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
}

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
}

// Intervals (in semitones) that should always use flat spelling in jazz:
// b3 (3), b5 (6), b7 (10)
const FLAT_INTERVALS = new Set([3, 6, 10])

/** Respell a note using jazz conventions:
 *  b3, b5, b7 always use flats; other notes follow root convention */
function respellNote(note: Note, rootPitchClass: string, intervalFromRoot?: number): Note {
  // Force flat spelling for b3, b5, b7 intervals
  if (intervalFromRoot !== undefined) {
    const semitoneClass = ((intervalFromRoot % 12) + 12) % 12
    if (FLAT_INTERVALS.has(semitoneClass)) {
      const flat = SHARP_TO_FLAT[note.pitchClass]
      if (flat) return { ...note, pitchClass: flat, name: `${flat}${note.octave}` }
      return note
    }
  }

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
 * automatically adjusting octave to stay within the instrument range.
 *
 * @param range Optional MIDI range override. Defaults to bass guitar (E1–G4).
 */
export function buildArpeggioNotes(
  step: ArpeggioStep,
  direction: ArpeggioDirection,
  numOctaves = 1,
  range?: { minMidi: number; maxMidi: number },
): { notes: Note[]; octaveShift: number } {
  const minMidi = range?.minMidi ?? BASS_MIN_MIDI
  const maxMidi = range?.maxMidi ?? BASS_MAX_MIDI
  const intervals = getArpeggioIntervals(step.arpeggioType)

  let octave = step.rootOctave
  let octaveShift = 0

  const buildNotes = (startOctave: number): Note[] => {
    if (numOctaves <= 1) {
      const root = noteFromName(`${step.root}${startOctave}`)
      const ascending = intervals.map((interval) => {
        const note = interval === 0 ? root : noteFromMidi(root.midi + interval)
        return respellNote(note, step.root, interval)
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
        return respellNote(note, step.root, interval)
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

  // Shift down if notes exceed range
  while (notes.some((n) => n.midi > maxMidi) && octave > 1) {
    octave -= 1
    octaveShift -= 1
    notes = buildNotes(octave)
  }

  // Shift up if notes are below range
  while (notes.some((n) => n.midi < minMidi) && octave < 6) {
    octave += 1
    octaveShift += 1
    notes = buildNotes(octave)
  }

  return { notes, octaveShift }
}

/**
 * Check whether an arpeggio fits within the instrument range after auto-adjustment.
 *
 * @param range Optional MIDI range override. Defaults to bass guitar (E1–G4).
 */
export function isArpeggioPlayable(
  step: ArpeggioStep,
  direction: ArpeggioDirection,
  numOctaves = 1,
  range?: { minMidi: number; maxMidi: number },
): boolean {
  const minMidi = range?.minMidi ?? BASS_MIN_MIDI
  const maxMidi = range?.maxMidi ?? BASS_MAX_MIDI
  try {
    const { notes } = buildArpeggioNotes(step, direction, numOctaves, range)
    return notes.every(n => n.midi >= minMidi && n.midi <= maxMidi)
  } catch {
    return false
  }
}
