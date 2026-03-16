import type { PresetTemplate, ScaleSequence, ScaleStep } from './types.ts'

const PITCH_CLASSES_SHARP = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

const PITCH_CLASSES_FLAT = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

/** Scale type index constants matching the Rust ScaleType enum order */
const SCALE = {
  Major: 0,
  NaturalMinor: 1,
  HarmonicMinor: 2,
  MelodicMinor: 3,
  Dorian: 4,
  Phrygian: 5,
  Lydian: 6,
  Mixolydian: 7,
  Locrian: 8,
  MajorPentatonic: 9,
  MinorPentatonic: 10,
  Blues: 11,
} as const

/** Scale type display names */
const SCALE_NAMES: Record<number, string> = {
  [SCALE.Major]: 'Major',
  [SCALE.NaturalMinor]: 'Natural Minor',
  [SCALE.HarmonicMinor]: 'Harmonic Minor',
  [SCALE.MelodicMinor]: 'Melodic Minor',
  [SCALE.Dorian]: 'Dorian',
  [SCALE.Phrygian]: 'Phrygian',
  [SCALE.Lydian]: 'Lydian',
  [SCALE.Mixolydian]: 'Mixolydian',
  [SCALE.Locrian]: 'Locrian',
  [SCALE.MajorPentatonic]: 'Maj Pentatonic',
  [SCALE.MinorPentatonic]: 'Min Pentatonic',
  [SCALE.Blues]: 'Blues',
}

/**
 * Transpose a pitch class by a number of semitones.
 * Returns the new pitch class and any octave offset.
 */
/** Convert any pitch class (sharp or flat) to a semitone index 0-11 */
function pitchToIndex(note: string): number {
  let idx = PITCH_CLASSES_SHARP.indexOf(note as (typeof PITCH_CLASSES_SHARP)[number])
  if (idx === -1) idx = PITCH_CLASSES_FLAT.indexOf(note as (typeof PITCH_CLASSES_FLAT)[number])
  return idx
}

export function transpose(
  rootNote: string,
  rootOctave: number,
  semitones: number
): { pitchClass: string; octave: number } {
  const rootIndex = pitchToIndex(rootNote)
  if (rootIndex === -1) return { pitchClass: rootNote, octave: rootOctave }

  const newIndex = rootIndex + semitones
  const pitchClass = PITCH_CLASSES_FLAT[((newIndex % 12) + 12) % 12]
  const octaveOffset = Math.floor(newIndex / 12)
  let octave = rootOctave + octaveOffset
  // Clamp to playable range (1-4) by wrapping
  const MIN_OCT = 1
  const MAX_OCT = 4
  const range = MAX_OCT - MIN_OCT + 1
  octave = MIN_OCT + (((octave - MIN_OCT) % range) + range) % range
  return { pitchClass, octave }
}

function makeStep(
  rootNote: string,
  rootOctave: number,
  semitones: number,
  scaleTypeIndex: number,
  label?: string
): ScaleStep {
  const { pitchClass, octave } = transpose(rootNote, rootOctave, semitones)
  const autoLabel = `${pitchClass}${octave} ${SCALE_NAMES[scaleTypeIndex] ?? 'Scale'}`
  return {
    rootNote: pitchClass,
    rootOctave: octave,
    scaleTypeIndex,
    label: label ?? autoLabel,
  }
}

/** Get a display label for a scale step */
export function getStepLabel(step: ScaleStep, ignoreOctave = false): string {
  if (step.label) {
    // Strip octave digits from custom labels when ignoring octave
    return ignoreOctave ? step.label.replace(/\d/g, '').trim() : step.label
  }
  const scaleName = SCALE_NAMES[step.scaleTypeIndex] ?? 'Scale'
  return ignoreOctave
    ? `${step.rootNote} ${scaleName}`
    : `${step.rootNote}${step.rootOctave} ${scaleName}`
}

// ---- Preset Templates ----

const jazzIIVI: PresetTemplate = {
  id: 'jazz-ii-v-i',
  name: 'Jazz ii-V-I',
  description: 'The essential jazz chord progression. Practice the modes that fit each chord.',
  category: 'jazz',
  transposable: true,
  generate(rootNote, rootOctave): ScaleSequence {
    return {
      id: 'jazz-ii-v-i',
      name: `Jazz ii-V-I in ${rootNote}`,
      description: `ii-V-I progression in the key of ${rootNote}`,
      direction: 'ascending',
      shiftSemitones: 7,
      steps: [
        makeStep(rootNote, rootOctave, 2, SCALE.Dorian, undefined),
        makeStep(rootNote, rootOctave, 7, SCALE.Mixolydian, undefined),
        makeStep(rootNote, rootOctave, 0, SCALE.Major, undefined),
      ],
    }
  },
}

const circleOfFifthsMajor: PresetTemplate = {
  id: 'circle-of-fifths-major',
  name: 'Circle of Fifths (Major)',
  description: 'All 12 major scales following the circle of fifths.',
  category: 'theory',
  transposable: true,
  generate(rootNote, rootOctave): ScaleSequence {
    const fifthOffsets = [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77]
    return {
      id: 'circle-of-fifths-major',
      name: `Circle of Fifths from ${rootNote}`,
      description: 'All 12 major scales around the circle of fifths',
      direction: 'ascending',
      shiftSemitones: 0,
      steps: fifthOffsets.map((offset) =>
        makeStep(rootNote, rootOctave, offset % 12, SCALE.Major)
      ),
    }
  },
}

const relativeMajorMinor: PresetTemplate = {
  id: 'relative-major-minor',
  name: 'Relative Major/Minor',
  description: 'Practice a major scale and its relative minor back to back.',
  category: 'theory',
  transposable: true,
  generate(rootNote, rootOctave): ScaleSequence {
    return {
      id: 'relative-major-minor',
      name: `${rootNote} Major & Relative Minor`,
      description: `${rootNote} Major and its relative natural minor`,
      direction: 'ascending',
      shiftSemitones: 1,
      steps: [
        makeStep(rootNote, rootOctave, 0, SCALE.Major),
        makeStep(rootNote, rootOctave, 9, SCALE.NaturalMinor),
      ],
    }
  },
}

const modeWorkout: PresetTemplate = {
  id: 'mode-workout',
  name: 'Mode Workout',
  description: 'All 7 modes from the same root note. Great for ear training.',
  category: 'technique',
  transposable: true,
  generate(rootNote, rootOctave): ScaleSequence {
    return {
      id: 'mode-workout',
      name: `Mode Workout from ${rootNote}${rootOctave}`,
      description: 'All 7 modes from the same root',
      direction: 'ascending',
      shiftSemitones: 1,
      steps: [
        makeStep(rootNote, rootOctave, 0, SCALE.Major),
        makeStep(rootNote, rootOctave, 0, SCALE.Dorian),
        makeStep(rootNote, rootOctave, 0, SCALE.Phrygian),
        makeStep(rootNote, rootOctave, 0, SCALE.Lydian),
        makeStep(rootNote, rootOctave, 0, SCALE.Mixolydian),
        makeStep(rootNote, rootOctave, 0, SCALE.NaturalMinor),
        makeStep(rootNote, rootOctave, 0, SCALE.Locrian),
      ],
    }
  },
}

const pentatonicPairs: PresetTemplate = {
  id: 'pentatonic-pairs',
  name: 'Pentatonic Pairs',
  description: 'Major and minor pentatonic from the same root.',
  category: 'technique',
  transposable: true,
  generate(rootNote, rootOctave): ScaleSequence {
    return {
      id: 'pentatonic-pairs',
      name: `${rootNote}${rootOctave} Pentatonic Pairs`,
      description: 'Major and minor pentatonic scales',
      direction: 'ascending',
      shiftSemitones: 2,
      steps: [
        makeStep(rootNote, rootOctave, 0, SCALE.MajorPentatonic),
        makeStep(rootNote, rootOctave, 0, SCALE.MinorPentatonic),
      ],
    }
  },
}

export const PRESETS: PresetTemplate[] = [
  jazzIIVI,
  circleOfFifthsMajor,
  relativeMajorMinor,
  modeWorkout,
  pentatonicPairs,
]

export const PRESET_CATEGORIES = {
  jazz: 'Jazz',
  theory: 'Theory',
  technique: 'Technique',
} as const
