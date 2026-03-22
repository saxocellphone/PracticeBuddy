import type { ArpeggioSequence, ArpeggioStep, ArpeggioType } from './types.ts'
import { ARPEGGIO_TYPE_LABELS } from './types.ts'
import { transpose } from '@core/scales/presets.ts'

// ---- Helpers ----

function makeArpeggioStep(
  rootNote: string,
  rootOctave: number,
  semitones: number,
  arpeggioType: ArpeggioType,
  label?: string,
): ArpeggioStep {
  const { pitchClass, octave } = transpose(rootNote, rootOctave, semitones)
  const autoLabel = `${pitchClass}${octave}${ARPEGGIO_TYPE_LABELS[arpeggioType]}`
  return {
    root: pitchClass,
    rootOctave: octave,
    arpeggioType,
    label: label ?? autoLabel,
  }
}

/** Get a display label for an arpeggio step (e.g., "Cmaj7", "Dm7") */
export function getArpeggioStepLabel(step: ArpeggioStep, ignoreOctave = false): string {
  // Always use structured root + suffix when ignoring octave to avoid
  // stripping digits that are part of the chord quality (e.g., "7" in "E27")
  if (ignoreOctave) {
    const suffix = ARPEGGIO_TYPE_LABELS[step.arpeggioType]
    return `${step.root}${suffix}`
  }
  if (step.label) return step.label
  const suffix = ARPEGGIO_TYPE_LABELS[step.arpeggioType]
  return `${step.root}${step.rootOctave}${suffix}`
}

// ---- Preset Template ----

export interface ArpeggioPresetTemplate {
  id: string
  name: string
  description: string
  category: 'triads' | 'seventh' | 'jazz'
  generate: (rootNote: string, rootOctave: number) => ArpeggioSequence
}

/** Generate a single-quality preset with one step (loop shift handles key cycling) */
function makeSingleQualityPreset(
  id: string,
  name: string,
  description: string,
  category: 'triads' | 'seventh',
  arpeggioType: ArpeggioType,
): ArpeggioPresetTemplate {
  return {
    id,
    name,
    description,
    category,
    generate(rootNote, rootOctave): ArpeggioSequence {
      return {
        id,
        name: `${name} from ${rootNote}`,
        description,
        direction: 'ascending',
        shiftSemitones: 0,
        steps: [makeArpeggioStep(rootNote, rootOctave, 0, arpeggioType)],
      }
    },
  }
}

// ---- Single-quality presets ----

const majorTriads = makeSingleQualityPreset(
  'arp-major-triads',
  'Major Triads',
  'Practice major triad arpeggios. Use loop shift to cycle through keys.',
  'triads',
  'Major',
)

const minorTriads = makeSingleQualityPreset(
  'arp-minor-triads',
  'Minor Triads',
  'Practice minor triad arpeggios. Use loop shift to cycle through keys.',
  'triads',
  'Minor',
)

const dominant7ths = makeSingleQualityPreset(
  'arp-dominant-7',
  'Dominant 7th',
  'Practice dominant 7th arpeggios. Use loop shift to cycle through keys.',
  'seventh',
  'Dominant7',
)

const major7ths = makeSingleQualityPreset(
  'arp-major-7',
  'Major 7th',
  'Practice major 7th arpeggios. Use loop shift to cycle through keys.',
  'seventh',
  'Major7',
)

const minor7ths = makeSingleQualityPreset(
  'arp-minor-7',
  'Minor 7th',
  'Practice minor 7th arpeggios. Use loop shift to cycle through keys.',
  'seventh',
  'Minor7',
)

// ---- Progression presets ----

const iiVI: ArpeggioPresetTemplate = {
  id: 'arp-ii-v-i',
  name: 'ii-V-I Major',
  description: 'The essential jazz progression as arpeggios: m7 → dom7 → maj7, cycling through all keys.',
  category: 'jazz',
  generate(rootNote, rootOctave): ArpeggioSequence {
    return {
      id: 'arp-ii-v-i',
      name: `ii-V-I in ${rootNote}`,
      description: `ii-V-I arpeggio progression in the key of ${rootNote}`,
      direction: 'ascending',
      shiftSemitones: 5,
      skipTransition: true,
      steps: [
        makeArpeggioStep(rootNote, rootOctave, 2, 'Minor7'),
        makeArpeggioStep(rootNote, rootOctave, 7, 'Dominant7'),
        makeArpeggioStep(rootNote, rootOctave, 0, 'Major7'),
      ],
    }
  },
}

const iiViMinor: ArpeggioPresetTemplate = {
  id: 'arp-ii-v-i-minor',
  name: 'ii-V-i Minor',
  description: 'Minor ii-V-i as arpeggios: m7b5 → dom7 → m7, cycling through all keys.',
  category: 'jazz',
  generate(rootNote, rootOctave): ArpeggioSequence {
    return {
      id: 'arp-ii-v-i-minor',
      name: `ii-V-i minor in ${rootNote}`,
      description: `Minor ii-V-i arpeggio progression in the key of ${rootNote}`,
      direction: 'ascending',
      shiftSemitones: 5,
      skipTransition: true,
      steps: [
        makeArpeggioStep(rootNote, rootOctave, 2, 'HalfDiminished7'),
        makeArpeggioStep(rootNote, rootOctave, 7, 'Dominant7'),
        makeArpeggioStep(rootNote, rootOctave, 0, 'Minor7'),
      ],
    }
  },
}

// ---- Exports ----

export const ARPEGGIO_PRESETS: ArpeggioPresetTemplate[] = [
  majorTriads,
  minorTriads,
  dominant7ths,
  major7ths,
  minor7ths,
  iiVI,
  iiViMinor,
]

export const ARPEGGIO_PRESET_CATEGORIES = {
  triads: 'Triads',
  seventh: 'Seventh Chords',
  jazz: 'Jazz Progressions',
} as const
