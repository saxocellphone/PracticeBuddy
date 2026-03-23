/** The 12 chromatic pitch classes using flats (the standard display set). */
export const PITCH_CLASSES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

/**
 * Compare pitch classes by semitone value, treating enharmonic
 * equivalents (e.g., C# and Db) as equal. This mirrors the Rust
 * `are_enharmonic` function without requiring a WASM call.
 */

const PITCH_CLASS_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
}

export function pitchClassesMatch(a: string, b: string): boolean {
  const semitoneA = PITCH_CLASS_TO_SEMITONE[a]
  const semitoneB = PITCH_CLASS_TO_SEMITONE[b]
  if (semitoneA === undefined || semitoneB === undefined) return false
  return semitoneA === semitoneB
}
