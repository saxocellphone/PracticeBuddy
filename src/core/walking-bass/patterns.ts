import type { WalkingBassPattern } from './types.ts'

/**
 * Walking bass patterns — each defines 4 intervals per beat per chord quality.
 * `null` entries are approach notes computed from the next chord's root.
 */
export const WALKING_BASS_PATTERNS: WalkingBassPattern[] = [
  // Level 1: Foundation
  {
    id: 'ascending-chord-tones',
    name: '1-3-5-7',
    description: 'Chord tones ascending — the fundamental pattern',
    intervals: {
      maj7: [0, 4, 7, 11],
      dom7: [0, 4, 7, 10],
      min7: [0, 3, 7, 10],
      m7b5: [0, 3, 6, 10],
    },
    approachBeats: [],
  },
  {
    id: 'descending-chord-tones',
    name: '1-7-5-3',
    description: 'Chord tones descending — beat 4 lands near next root',
    intervals: {
      maj7: [0, 11, 7, 4],
      dom7: [0, 10, 7, 4],
      min7: [0, 10, 7, 3],
      m7b5: [0, 10, 6, 3],
    },
    approachBeats: [],
  },

  // Level 2: Scalar & 6th
  {
    id: 'scalar-ascending',
    name: '1-2-3-5',
    description: 'Stepwise scalar motion — smooth and melodic',
    intervals: {
      maj7: [0, 2, 4, 7],
      dom7: [0, 2, 4, 7],
      min7: [0, 2, 3, 7],
      m7b5: [0, 2, 3, 6],
    },
    approachBeats: [],
  },
  {
    id: 'chord-tones-sixth',
    name: '1-3-5-6',
    description: 'Chord tones with 6th — classic jazz/swing pattern',
    intervals: {
      maj7: [0, 4, 7, 9],
      dom7: [0, 4, 7, 9],
      min7: [0, 3, 7, 9],
      m7b5: [0, 3, 6, 9],
    },
    approachBeats: [],
  },

  // Level 3: Chromatic & Approach
  {
    id: 'root-fifth-octave-approach',
    name: '1-5-8-App',
    description: 'Root, 5th, octave, then approach to next chord',
    intervals: {
      maj7: [0, 7, 12, null],
      dom7: [0, 7, 12, null],
      min7: [0, 7, 12, null],
      m7b5: [0, 6, 12, null],
    },
    approachBeats: [3],
  },
  {
    id: 'chromatic-passing',
    name: '1-3-#4-5',
    description: 'Chromatic passing tone between 3rd and 5th',
    intervals: {
      maj7: [0, 4, 6, 7],
      dom7: [0, 4, 6, 7],
      min7: [0, 3, 6, 7],
      m7b5: [0, 3, 5, 6],
    },
    approachBeats: [],
  },
  {
    id: 'descending-from-octave',
    name: '8-7-6-5',
    description: 'Descending from octave — creates register contrast',
    intervals: {
      maj7: [12, 11, 9, 7],
      dom7: [12, 10, 9, 7],
      min7: [12, 10, 9, 7],
      m7b5: [12, 10, 8, 6],
    },
    approachBeats: [],
  },

  // Level 4: Dominant & Multi-beat Approach
  {
    id: 'dominant-descent',
    name: '1-b7-5-App',
    description: 'Dominant descent — strongly implies Mixolydian',
    intervals: {
      maj7: [0, 11, 7, null],
      dom7: [0, 10, 7, null],
      min7: [0, 10, 7, null],
      m7b5: [0, 10, 6, null],
    },
    approachBeats: [3],
  },
  {
    id: 'enclosure',
    name: 'Enclosure',
    description: 'Beats 3-4 surround next root from above and below',
    intervals: {
      maj7: [0, 4, null, null],
      dom7: [0, 4, null, null],
      min7: [0, 3, null, null],
      m7b5: [0, 3, null, null],
    },
    approachBeats: [2, 3],
  },
  {
    id: 'double-chromatic',
    name: 'Double Chromatic',
    description: 'Two chromatic half-steps into the next root',
    intervals: {
      maj7: [0, 7, null, null],
      dom7: [0, 7, null, null],
      min7: [0, 7, null, null],
      m7b5: [0, 6, null, null],
    },
    approachBeats: [2, 3],
  },
]

export function getPatternById(id: string): WalkingBassPattern | undefined {
  return WALKING_BASS_PATTERNS.find(p => p.id === id)
}
