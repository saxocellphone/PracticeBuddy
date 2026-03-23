import { noteFromName, noteFromMidi } from '@core/wasm/noteUtils.ts'
import type { Note } from '@core/wasm/types.ts'
import type { WalkingBassStep, WalkingBassPattern, ApproachType } from './types.ts'
import { BASS_MIN_MIDI, BASS_MAX_MIDI } from '@core/music/scaleBuilder.ts'

// ---- Jazz-aware note spelling ----

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
}
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
}

// Roots that conventionally use sharp spellings
const SHARP_ROOTS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#'])

// Intervals (in semitones) that should ALWAYS be spelled as flats in jazz context:
// b3 (3), b5 (6), b7 (10) — regardless of root's sharp/flat convention
const FLAT_INTERVALS = new Set([3, 6, 10])

/**
 * Respell a note to follow jazz conventions:
 * 1. b3, b5, b7 intervals always use flat spelling (Bb not A#, Eb not D#)
 * 2. Other notes follow the root's sharp/flat convention
 */
function respellForJazz(note: Note, rootPitchClass: string, intervalFromRoot: number): Note {
  const semitoneClass = ((intervalFromRoot % 12) + 12) % 12

  // Force flat spelling for b3, b5, b7
  if (FLAT_INTERVALS.has(semitoneClass)) {
    const flat = SHARP_TO_FLAT[note.pitchClass]
    if (flat) return { ...note, pitchClass: flat, name: `${flat}${note.octave}` }
    return note
  }

  // For other intervals, follow root convention
  const useSharp = SHARP_ROOTS.has(rootPitchClass)
  if (useSharp) {
    const sharp = FLAT_TO_SHARP[note.pitchClass]
    if (sharp) return { ...note, pitchClass: sharp, name: `${sharp}${note.octave}` }
  } else {
    const flat = SHARP_TO_FLAT[note.pitchClass]
    if (flat) return { ...note, pitchClass: flat, name: `${flat}${note.octave}` }
  }
  return note
}

/**
 * Compute an approach note targeting the next chord's root.
 */
function computeApproachMidi(
  nextRootMidi: number,
  approachType: ApproachType,
  beatIndex: number,
  totalApproachBeats: number,
): number {
  if (totalApproachBeats === 1) {
    // Single approach note on beat 4
    switch (approachType) {
      case 'chromatic-below': return nextRootMidi - 1
      case 'chromatic-above': return nextRootMidi + 1
      case 'diatonic': return nextRootMidi - 2
      case 'dominant': return nextRootMidi - 5 // P4 below = dominant
    }
  }

  // Two approach beats (enclosure or double chromatic)
  if (totalApproachBeats === 2) {
    const isFirst = beatIndex === 0
    switch (approachType) {
      case 'chromatic-below':
        // Double chromatic from below: two half-steps up
        return isFirst ? nextRootMidi - 2 : nextRootMidi - 1
      case 'chromatic-above':
        // Double chromatic from above: two half-steps down
        return isFirst ? nextRootMidi + 2 : nextRootMidi + 1
      case 'diatonic':
        // Enclosure: above then below
        return isFirst ? nextRootMidi + 2 : nextRootMidi - 1
      case 'dominant':
        // Enclosure: below then above
        return isFirst ? nextRootMidi - 2 : nextRootMidi + 1
    }
  }

  return nextRootMidi - 1 // fallback
}

/**
 * Build exactly 4 notes for a single walking bass chord.
 *
 * @param step - The current chord
 * @param pattern - The walking pattern to apply
 * @param nextStep - The next chord (for approach notes). If null, approach uses own root.
 * @param approachType - How to compute approach notes
 * @param range - Instrument MIDI range for octave clamping
 */
export function buildWalkingBassNotes(
  step: WalkingBassStep,
  pattern: WalkingBassPattern,
  nextStep: WalkingBassStep | null,
  approachType: ApproachType,
  range?: { minMidi: number; maxMidi: number },
): Note[] {
  const minMidi = range?.minMidi ?? BASS_MIN_MIDI
  const maxMidi = range?.maxMidi ?? BASS_MAX_MIDI

  const rootNote = noteFromName(`${step.root}${step.rootOctave}`)
  const rootMidi = rootNote.midi

  // Determine next root for approach notes
  const nextRoot = nextStep
    ? noteFromName(`${nextStep.root}${nextStep.rootOctave}`)
    : rootNote
  const nextRootMidi = nextRoot.midi

  const intervals = pattern.intervals[step.quality]
  const approachBeatSet = new Set(pattern.approachBeats)

  // Track which approach beat index we're on (for multi-beat approaches)
  let approachIndex = 0

  const notes: Note[] = intervals.map((interval, beatIdx) => {
    if (interval === null || approachBeatSet.has(beatIdx)) {
      const midi = computeApproachMidi(
        nextRootMidi,
        approachType,
        approachIndex,
        pattern.approachBeats.length,
      )
      approachIndex++
      // Approach notes: respell based on the next chord's root
      const raw = noteFromMidi(midi)
      return respellForJazz(raw, nextStep?.root ?? step.root, midi - nextRootMidi)
    }
    const raw = noteFromMidi(rootMidi + interval)
    return respellForJazz(raw, step.root, interval)
  })

  // Octave clamping: shift all notes if any are out of range
  const midiValues = notes.map(n => n.midi)
  const minNote = Math.min(...midiValues)
  const maxNote = Math.max(...midiValues)

  let shift = 0
  if (maxNote > maxMidi) {
    shift = -12 * Math.ceil((maxNote - maxMidi) / 12)
  }
  if (minNote + shift < minMidi) {
    shift = 12 * Math.ceil((minMidi - minNote) / 12)
  }

  if (shift !== 0) {
    // Preserve pitch class spelling when shifting by octaves
    const octaveShift = shift / 12
    return notes.map(n => ({
      ...n,
      midi: n.midi + shift,
      octave: n.octave + octaveShift,
      name: `${n.pitchClass}${n.octave + octaveShift}`,
      frequency: n.frequency * Math.pow(2, octaveShift),
    }))
  }

  return notes
}
