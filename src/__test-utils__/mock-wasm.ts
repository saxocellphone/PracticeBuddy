import { vi } from 'vitest'
import type { Note, FrequencyToNoteResult, ScaleInfo } from '@core/wasm/types.ts'

// ---------------------------------------------------------------------------
// Default frequency → note mappings (standard bass range + common pitches)
// ---------------------------------------------------------------------------

/** Standard bass notes and common reference pitches */
const DEFAULT_FREQUENCY_MAP: Record<number, FrequencyToNoteResult> = {
  // Open strings (standard tuning)
  41.2: {
    note: { name: 'E1', pitchClass: 'E', octave: 1, midi: 28, frequency: 41.2 },
    centsOffset: 0,
  },
  55: {
    note: { name: 'A1', pitchClass: 'A', octave: 1, midi: 33, frequency: 55 },
    centsOffset: 0,
  },
  73.42: {
    note: { name: 'D2', pitchClass: 'D', octave: 2, midi: 38, frequency: 73.42 },
    centsOffset: 0,
  },
  98: {
    note: { name: 'G2', pitchClass: 'G', octave: 2, midi: 43, frequency: 98 },
    centsOffset: 0,
  },

  // Common bass range notes
  82.41: {
    note: { name: 'E2', pitchClass: 'E', octave: 2, midi: 40, frequency: 82.41 },
    centsOffset: 0,
  },
  87.31: {
    note: { name: 'F2', pitchClass: 'F', octave: 2, midi: 41, frequency: 87.31 },
    centsOffset: 0,
  },
  110: {
    note: { name: 'A2', pitchClass: 'A', octave: 2, midi: 45, frequency: 110 },
    centsOffset: 0,
  },
  116.54: {
    note: { name: 'Bb2', pitchClass: 'Bb', octave: 2, midi: 46, frequency: 116.54 },
    centsOffset: 0,
  },
  123.47: {
    note: { name: 'B2', pitchClass: 'B', octave: 2, midi: 47, frequency: 123.47 },
    centsOffset: 0,
  },
  130.81: {
    note: { name: 'C3', pitchClass: 'C', octave: 3, midi: 48, frequency: 130.81 },
    centsOffset: 0,
  },
  138.59: {
    note: { name: 'Db3', pitchClass: 'Db', octave: 3, midi: 49, frequency: 138.59 },
    centsOffset: 0,
  },
  146.83: {
    note: { name: 'D3', pitchClass: 'D', octave: 3, midi: 50, frequency: 146.83 },
    centsOffset: 0,
  },
  155.56: {
    note: { name: 'Eb3', pitchClass: 'Eb', octave: 3, midi: 51, frequency: 155.56 },
    centsOffset: 0,
  },
  164.81: {
    note: { name: 'E3', pitchClass: 'E', octave: 3, midi: 52, frequency: 164.81 },
    centsOffset: 0,
  },
  174.61: {
    note: { name: 'F3', pitchClass: 'F', octave: 3, midi: 53, frequency: 174.61 },
    centsOffset: 0,
  },
  185: {
    note: { name: 'F#3', pitchClass: 'F#', octave: 3, midi: 54, frequency: 185 },
    centsOffset: 0,
  },
  196: {
    note: { name: 'G3', pitchClass: 'G', octave: 3, midi: 55, frequency: 196 },
    centsOffset: 0,
  },
  207.65: {
    note: { name: 'Ab3', pitchClass: 'Ab', octave: 3, midi: 56, frequency: 207.65 },
    centsOffset: 0,
  },
  220: {
    note: { name: 'A3', pitchClass: 'A', octave: 3, midi: 57, frequency: 220 },
    centsOffset: 0,
  },
  233.08: {
    note: { name: 'Bb3', pitchClass: 'Bb', octave: 3, midi: 58, frequency: 233.08 },
    centsOffset: 0,
  },
  246.94: {
    note: { name: 'B3', pitchClass: 'B', octave: 3, midi: 59, frequency: 246.94 },
    centsOffset: 0,
  },
  261.63: {
    note: { name: 'C4', pitchClass: 'C', octave: 4, midi: 60, frequency: 261.63 },
    centsOffset: 0,
  },

  // Enharmonic equivalents (sharp spellings for the same MIDI notes)
  92.5: {
    note: { name: 'F#2', pitchClass: 'F#', octave: 2, midi: 42, frequency: 92.5 },
    centsOffset: 0,
  },
  103.83: {
    note: { name: 'G#2', pitchClass: 'G#', octave: 2, midi: 44, frequency: 103.83 },
    centsOffset: 0,
  },

  // A4 reference pitch (useful for general tests)
  440: {
    note: { name: 'A4', pitchClass: 'A', octave: 4, midi: 69, frequency: 440 },
    centsOffset: 0,
  },
}

/** Default set of scale types returned by listScaleTypes */
const DEFAULT_SCALE_TYPES: ScaleInfo[] = [
  { name: 'Major', displayName: 'Major', category: 'common' },
  { name: 'NaturalMinor', displayName: 'Natural Minor', category: 'common' },
  { name: 'HarmonicMinor', displayName: 'Harmonic Minor', category: 'common' },
  { name: 'MelodicMinor', displayName: 'Melodic Minor', category: 'common' },
  { name: 'Dorian', displayName: 'Dorian', category: 'modes' },
  { name: 'Phrygian', displayName: 'Phrygian', category: 'modes' },
  { name: 'Lydian', displayName: 'Lydian', category: 'modes' },
  { name: 'Mixolydian', displayName: 'Mixolydian', category: 'modes' },
  { name: 'Locrian', displayName: 'Locrian', category: 'modes' },
  { name: 'MajorPentatonic', displayName: 'Maj Pentatonic', category: 'pentatonic' },
  { name: 'MinorPentatonic', displayName: 'Min Pentatonic', category: 'pentatonic' },
  { name: 'Blues', displayName: 'Blues', category: 'blues' },
]

// ---------------------------------------------------------------------------
// Mock controls
// ---------------------------------------------------------------------------

/**
 * Controls returned by `setupWasmMocks()` for configuring mock behavior
 * and accessing mock functions for assertions.
 */
export interface WasmMockControls {
  /** Configure frequencyToNote to return specific notes for specific frequencies */
  setFrequencyMap(map: Record<number, { note: Note; centsOffset: number }>): void
  /** Configure buildScale to return specific notes */
  setScaleNotes(notes: Note[]): void
  /** Access the underlying mock functions for assertions */
  mocks: {
    frequencyToNote: ReturnType<typeof vi.fn>
    buildScale: ReturnType<typeof vi.fn>
    getScaleType: ReturnType<typeof vi.fn>
    listScaleTypes: ReturnType<typeof vi.fn>
    initWasm: ReturnType<typeof vi.fn>
    getWasm: ReturnType<typeof vi.fn>
  }
}

// ---------------------------------------------------------------------------
// Module-level mock state (shared across vi.mock factory closures)
// ---------------------------------------------------------------------------

let frequencyMap: Record<number, FrequencyToNoteResult> = { ...DEFAULT_FREQUENCY_MAP }
let scaleNotes: Note[] = []

// ---------------------------------------------------------------------------
// vi.mock declarations — these MUST be at the module top level
// (Vitest hoists them regardless of where they appear)
// ---------------------------------------------------------------------------

vi.mock('@core/wasm/noteUtils.ts', () => ({
  frequencyToNote: vi.fn((freq: number): FrequencyToNoteResult => {
    const result = frequencyMap[freq]
    if (!result) {
      // Fallback: return a generic note rather than throwing, so tests
      // that don't pre-register every frequency don't blow up.
      return {
        note: {
          name: `?${freq}`,
          pitchClass: '?',
          octave: 0,
          midi: 0,
          frequency: freq,
        },
        centsOffset: 0,
      }
    }
    return result
  }),
  midiToFrequency: vi.fn((midi: number) => 440 * Math.pow(2, (midi - 69) / 12)),
  frequencyToMidi: vi.fn((freq: number) => Math.round(12 * Math.log2(freq / 440) + 69)),
  centsDistance: vi.fn((a: number, b: number) => 1200 * Math.log2(a / b)),
  noteFromName: vi.fn((name: string): Note => ({
    name,
    pitchClass: name.replace(/\d+$/, ''),
    octave: Number(name.match(/\d+$/)?.[0] ?? 0),
    midi: 0,
    frequency: 0,
  })),
  noteFromMidi: vi.fn((midi: number): Note => ({
    name: `note${midi}`,
    pitchClass: '?',
    octave: Math.floor(midi / 12) - 1,
    midi,
    frequency: 440 * Math.pow(2, (midi - 69) / 12),
  })),
}))

vi.mock('@core/wasm/scales.ts', () => ({
  buildScale: vi.fn((): Note[] => scaleNotes),
  getScaleType: vi.fn(() => ({})),
  listScaleTypes: vi.fn((): ScaleInfo[] => DEFAULT_SCALE_TYPES),
}))

vi.mock('@core/wasm/init.ts', () => ({
  initWasm: vi.fn(async () => ({})),
  getWasm: vi.fn(() => ({})),
}))

// ---------------------------------------------------------------------------
// Setup function
// ---------------------------------------------------------------------------

/**
 * Set up WASM mocks that intercept all `@core/wasm/*` imports.
 *
 * Call in `beforeEach` to reset state between tests. The returned controls
 * let you configure frequency mappings, scale notes, and access mock
 * functions for assertions.
 *
 * @example
 * ```ts
 * let wasm: WasmMockControls
 * beforeEach(() => {
 *   wasm = setupWasmMocks()
 *   wasm.setScaleNotes([makeNote('C', 3), makeNote('D', 3)])
 * })
 * ```
 */
export function setupWasmMocks(): WasmMockControls {
  // Reset to defaults
  frequencyMap = { ...DEFAULT_FREQUENCY_MAP }
  scaleNotes = []

  // Grab the mocked module references so callers can assert on them
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const noteUtils = require('@core/wasm/noteUtils.ts') as Record<string, ReturnType<typeof vi.fn>>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const scales = require('@core/wasm/scales.ts') as Record<string, ReturnType<typeof vi.fn>>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const init = require('@core/wasm/init.ts') as Record<string, ReturnType<typeof vi.fn>>

  // Clear call history
  for (const fn of Object.values(noteUtils)) {
    if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear()
  }
  for (const fn of Object.values(scales)) {
    if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear()
  }
  for (const fn of Object.values(init)) {
    if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear()
  }

  return {
    setFrequencyMap(map: Record<number, { note: Note; centsOffset: number }>) {
      frequencyMap = { ...DEFAULT_FREQUENCY_MAP, ...map }
    },

    setScaleNotes(notes: Note[]) {
      scaleNotes = notes
    },

    mocks: {
      frequencyToNote: noteUtils.frequencyToNote,
      buildScale: scales.buildScale,
      getScaleType: scales.getScaleType,
      listScaleTypes: scales.listScaleTypes,
      initWasm: init.initWasm,
      getWasm: init.getWasm,
    },
  }
}
