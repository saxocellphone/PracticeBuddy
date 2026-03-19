import { getWasm } from './init.ts'
import type { Note, ScaleInfo, ScaleDirection } from './types.ts'

// Roots that conventionally use sharp spellings
const SHARP_ROOTS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#'])

// Scale types (by index) that are "flat-biased" even from a sharp root
// Phrygian=5, Locrian=8, Altered=13, LocrianNatural2=14
const FLAT_BIASED_SCALE_TYPES = new Set([5, 8, 13, 14])

// Flat→Sharp enharmonic equivalents
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
}

// Sharp→Flat enharmonic equivalents
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
}

/**
 * Respell a note's pitch class based on the root key and scale type context.
 * Sharp-side roots get sharp spellings; flat-side roots get flat spellings.
 * Certain scale types (Phrygian, Locrian, Altered, LocrianNatural2) are always flat-biased.
 */
function respellNote(note: Note, rootPitchClass: string, scaleTypeIndex: number): Note {
  const useSharp = SHARP_ROOTS.has(rootPitchClass) && !FLAT_BIASED_SCALE_TYPES.has(scaleTypeIndex)

  if (useSharp) {
    // Convert any flats to sharps
    const sharp = FLAT_TO_SHARP[note.pitchClass]
    if (!sharp) return note
    return {
      ...note,
      pitchClass: sharp,
      name: `${sharp}${note.octave}`,
    }
  } else {
    // Convert any sharps to flats
    const flat = SHARP_TO_FLAT[note.pitchClass]
    if (!flat) return note
    return {
      ...note,
      pitchClass: flat,
      name: `${flat}${note.octave}`,
    }
  }
}

// Re-export ScaleType enum from WASM
export function getScaleType() {
  return getWasm().ScaleType
}

export function buildScale(
  rootNote: string,
  scaleType: number, // ScaleType enum value
  direction: ScaleDirection = 'ascending'
): Note[] {
  const notes = getWasm().buildScale(rootNote, scaleType, direction) as Note[]
  // Extract just the pitch class from the root string (e.g. "D2" → "D", "F#2" → "F#")
  const rootPitchClass = rootNote.replace(/\d+$/, '')
  return notes.map(note => respellNote(note, rootPitchClass, scaleType))
}

export function listScaleTypes(): ScaleInfo[] {
  return getWasm().listScaleTypes() as ScaleInfo[]
}
