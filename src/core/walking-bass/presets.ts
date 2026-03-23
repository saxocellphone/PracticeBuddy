import type { WalkingBassStep, WalkingBassSequence, ChordQuality } from './types.ts'
import { PITCH_CLASSES } from '../music/pitchClass.ts'

export type WalkingBassCategory = 'blues' | 'ii-v-i' | 'standards' | 'technique'

export const WALKING_BASS_CATEGORIES: Record<WalkingBassCategory, string> = {
  blues: 'Blues',
  'ii-v-i': 'ii-V-I',
  standards: 'Standards',
  technique: 'Technique',
}

export interface WalkingBassPresetTemplate {
  id: string
  name: string
  description: string
  category: WalkingBassCategory
  transposable: boolean
  generate: (rootNote: string, rootOctave: number) => WalkingBassSequence
}

// ---- Helpers ----

function transposeNote(root: string, semitones: number): string {
  const idx = PITCH_CLASSES.indexOf(root as typeof PITCH_CLASSES[number])
  if (idx < 0) return root
  return PITCH_CLASSES[((idx + semitones) % 12 + 12) % 12]
}

function step(root: string, octave: number, quality: ChordQuality, symbol?: string): WalkingBassStep {
  const suffix = quality === 'maj7' ? 'maj7' : quality === 'dom7' ? '7' : quality === 'min7' ? 'm7' : 'm7b5'
  return {
    root,
    rootOctave: octave,
    quality,
    chordSymbol: symbol ?? `${root}${suffix}`,
  }
}

function makeSequence(
  id: string,
  name: string,
  description: string,
  steps: WalkingBassStep[],
): WalkingBassSequence {
  return {
    id,
    name,
    description,
    steps,
    patternId: null,
    approachType: 'chromatic-below',
  }
}

// ---- Preset Generators ----

function makeBlues(rootNote: string, rootOctave: number, key: string): WalkingBassSequence {
  const I = rootNote
  const IV = transposeNote(rootNote, 5)
  const V = transposeNote(rootNote, 7)
  return makeSequence(
    `wb-blues-${key}`,
    `12-Bar Blues in ${key}`,
    `Standard 12-bar blues in ${key}`,
    [
      step(I, rootOctave, 'dom7'),   // bar 1
      step(IV, rootOctave, 'dom7'),  // bar 2
      step(I, rootOctave, 'dom7'),   // bar 3
      step(I, rootOctave, 'dom7'),   // bar 4
      step(IV, rootOctave, 'dom7'),  // bar 5
      step(IV, rootOctave, 'dom7'),  // bar 6
      step(I, rootOctave, 'dom7'),   // bar 7
      step(I, rootOctave, 'dom7'),   // bar 8
      step(V, rootOctave, 'dom7'),   // bar 9
      step(IV, rootOctave, 'dom7'),  // bar 10
      step(I, rootOctave, 'dom7'),   // bar 11
      step(V, rootOctave, 'dom7'),   // bar 12
    ],
  )
}

// ---- Presets ----

export const WALKING_BASS_PRESETS: WalkingBassPresetTemplate[] = [
  // Blues
  {
    id: 'wb-blues',
    name: '12-Bar Blues',
    description: '12-bar blues — the essential jazz blues form. Select root note to change key.',
    category: 'blues',
    transposable: true,
    generate: (rootNote, rootOctave) => makeBlues(rootNote, rootOctave, rootNote),
  },

  // ii-V-I
  {
    id: 'wb-ii-v-i-major',
    name: 'ii-V-I Major',
    description: 'The most important jazz progression',
    category: 'ii-v-i',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      const ii = transposeNote(rootNote, 2)
      const V = transposeNote(rootNote, 7)
      return makeSequence('wb-ii-v-i-major', `ii-V-I in ${rootNote}`, 'Major ii-V-I', [
        step(ii, rootOctave, 'min7'),
        step(V, rootOctave, 'dom7'),
        step(rootNote, rootOctave, 'maj7'),
        step(rootNote, rootOctave, 'maj7'),
      ])
    },
  },
  {
    id: 'wb-ii-v-i-minor',
    name: 'ii-V-i Minor',
    description: 'Minor ii-V-i with half-diminished ii chord',
    category: 'ii-v-i',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      const ii = transposeNote(rootNote, 2)
      const V = transposeNote(rootNote, 7)
      return makeSequence('wb-ii-v-i-minor', `ii-V-i in ${rootNote}m`, 'Minor ii-V-i', [
        step(ii, rootOctave, 'm7b5'),
        step(V, rootOctave, 'dom7'),
        step(rootNote, rootOctave, 'min7'),
        step(rootNote, rootOctave, 'min7'),
      ])
    },
  },
  {
    id: 'wb-bird-blues',
    name: 'Bird Blues',
    description: 'Charlie Parker\'s reharmonized blues with descending ii-V chains',
    category: 'ii-v-i',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      const I = rootNote
      return makeSequence('wb-bird-blues', `Bird Blues in ${I}`, 'Parker blues changes', [
        step(I, rootOctave, 'maj7'),                                    // bar 1
        step(transposeNote(I, 4), rootOctave, 'm7b5', `${transposeNote(I, 4)}m7b5`),
                                                                        // bar 2: Em7b5 A7
        step(transposeNote(I, 2), rootOctave, 'min7'),                  // bar 3: Dm7
        step(transposeNote(I, 0), rootOctave, 'min7', `${transposeNote(I, 0)}m7`), // bar 4: Cm7 F7 — simplified
        step(transposeNote(I, 10), rootOctave, 'dom7'),                 // bar 5: Bb7
        step(transposeNote(I, 8), rootOctave, 'min7', `${transposeNote(I, 8)}m7`), // bar 6: Bbm7 Eb7
        step(transposeNote(I, 4), rootOctave, 'min7', `${transposeNote(I, 4)}m7`), // bar 7: Am7
        step(transposeNote(I, 1), rootOctave, 'dom7', `${transposeNote(I, 1)}7`),  // bar 8: Abm7 Db7
        step(transposeNote(I, 7), rootOctave, 'min7', `${transposeNote(I, 7)}m7`), // bar 9: Gm7
        step(transposeNote(I, 7), rootOctave, 'dom7', `${transposeNote(I, 0)}7`),  // bar 10: C7
        step(I, rootOctave, 'maj7'),                                    // bar 11
        step(transposeNote(I, 7), rootOctave, 'dom7', `${transposeNote(I, 7)}m7 ${transposeNote(I, 0)}7`), // bar 12: Gm7 C7
      ])
    },
  },

  // Standards
  {
    id: 'wb-rhythm-changes',
    name: 'Rhythm Changes',
    description: 'George Gershwin\'s "I Got Rhythm" — 32-bar AABA form',
    category: 'standards',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      const I = rootNote
      const vi = transposeNote(I, 9)
      const ii = transposeNote(I, 2)
      const V = transposeNote(I, 7)
      const iii = transposeNote(I, 4)
      const III7 = transposeNote(I, 4)
      const VI7 = transposeNote(I, 9)
      const II7 = transposeNote(I, 2)

      // A section (8 bars)
      const aSection: WalkingBassStep[] = [
        step(I, rootOctave, 'maj7'), step(vi, rootOctave, 'min7'),
        step(ii, rootOctave, 'min7'), step(V, rootOctave, 'dom7'),
        step(iii, rootOctave, 'min7'), step(VI7, rootOctave, 'dom7'),
        step(ii, rootOctave, 'min7'), step(V, rootOctave, 'dom7'),
      ]
      // B section / Bridge (8 bars — III7-VI7-II7-V7, 2 bars each)
      const bSection: WalkingBassStep[] = [
        step(III7, rootOctave, 'dom7'), step(III7, rootOctave, 'dom7'),
        step(VI7, rootOctave, 'dom7'), step(VI7, rootOctave, 'dom7'),
        step(II7, rootOctave, 'dom7'), step(II7, rootOctave, 'dom7'),
        step(V, rootOctave, 'dom7'), step(V, rootOctave, 'dom7'),
      ]
      return makeSequence('wb-rhythm-changes', `Rhythm Changes in ${I}`, '32-bar AABA', [
        ...aSection, ...aSection, ...bSection, ...aSection,
      ])
    },
  },
  {
    id: 'wb-so-what',
    name: 'So What',
    description: 'Miles Davis modal classic — Dm7 and Ebm7 Dorian',
    category: 'standards',
    transposable: false,
    generate: (_rootNote, rootOctave) => {
      const dm = Array(8).fill(null).map(() => step('D', rootOctave, 'min7', 'Dm7'))
      const ebm = Array(8).fill(null).map(() => step('Eb', rootOctave, 'min7', 'Ebm7'))
      return makeSequence('wb-so-what', 'So What', 'AABA — 32 bars of modal Dorian', [
        ...dm, ...dm, ...ebm, ...dm,
      ])
    },
  },
  {
    id: 'wb-autumn-leaves',
    name: 'Autumn Leaves',
    description: 'Classic standard with alternating major and minor ii-V-I\'s',
    category: 'standards',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      // Autumn Leaves in relative minor of rootNote
      // If rootNote = Bb, relative minor = Gm
      const iv = transposeNote(rootNote, 2)  // Cm7
      const bVII = transposeNote(rootNote, 7) // F7
      const I = rootNote                       // Bbmaj7
      const IV = transposeNote(rootNote, 5)   // Ebmaj7
      const vii = transposeNote(rootNote, 11) // Am7b5
      const III = transposeNote(rootNote, 4)  // D7
      const vi = transposeNote(rootNote, 9)   // Gm

      // A section (8 bars)
      const aSection: WalkingBassStep[] = [
        step(iv, rootOctave, 'min7'),
        step(bVII, rootOctave, 'dom7'),
        step(I, rootOctave, 'maj7'),
        step(IV, rootOctave, 'maj7'),
        step(vii, rootOctave, 'm7b5'),
        step(III, rootOctave, 'dom7'),
        step(vi, rootOctave, 'min7'),
        step(vi, rootOctave, 'min7'),
      ]
      return makeSequence('wb-autumn-leaves', `Autumn Leaves in ${rootNote}`, '32-bar standard', [
        ...aSection, ...aSection,
        // B section simplified
        step(vii, rootOctave, 'm7b5'), step(III, rootOctave, 'dom7'),
        step(vi, rootOctave, 'min7'), step(vi, rootOctave, 'min7'),
        step(iv, rootOctave, 'min7'), step(bVII, rootOctave, 'dom7'),
        step(I, rootOctave, 'maj7'), step(I, rootOctave, 'maj7'),
        // Final A
        step(IV, rootOctave, 'maj7'),
        step(vii, rootOctave, 'm7b5'),
        step(vi, rootOctave, 'min7'),
        step(vi, rootOctave, 'min7'),
      ])
    },
  },

  // Technique
  {
    id: 'wb-turnaround',
    name: 'I-vi-ii-V Turnaround',
    description: 'The jazz turnaround — foundation of standard harmony',
    category: 'technique',
    transposable: true,
    generate: (rootNote, rootOctave) => {
      const vi = transposeNote(rootNote, 9)
      const ii = transposeNote(rootNote, 2)
      const V = transposeNote(rootNote, 7)
      return makeSequence('wb-turnaround', `Turnaround in ${rootNote}`, 'I-vi-ii-V', [
        step(rootNote, rootOctave, 'maj7'),
        step(vi, rootOctave, 'min7'),
        step(ii, rootOctave, 'min7'),
        step(V, rootOctave, 'dom7'),
      ])
    },
  },
]
