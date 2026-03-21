import type { DetectedPitch, Note, ScaleDirection } from '@core/wasm/types.ts'
import type { TimingWindows } from '@core/rhythm/types.ts'
import type { PitchSample } from '@core/rhythm/evaluation.ts'
import type { ScaleSequence } from '@core/endless/types.ts'

// ---------------------------------------------------------------------------
// Pitch & Note factories
// ---------------------------------------------------------------------------

/**
 * Create a DetectedPitch at a given frequency with configurable clarity.
 * Defaults to clarity 0.9 (high confidence).
 */
export function makePitch(frequency: number, clarity = 0.9): DetectedPitch {
  return { frequency, clarity }
}

/**
 * Create a Note object with sensible defaults.
 * If `midi` is not provided, it is computed from the standard formula.
 */
export function makeNote(pitchClass: string, octave: number, midi?: number): Note {
  const computedMidi = midi ?? Math.round(12 * Math.log2(computeFrequency(pitchClass, octave) / 440) + 69)
  return {
    name: `${pitchClass}${octave}`,
    pitchClass,
    octave,
    midi: computedMidi,
    frequency: computeFrequency(pitchClass, octave),
  }
}

/** Pitch class → semitone offset from C */
const PITCH_CLASS_OFFSETS: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
}

/** Compute the frequency for a pitch class and octave (equal temperament) */
function computeFrequency(pitchClass: string, octave: number): number {
  const semitone = PITCH_CLASS_OFFSETS[pitchClass]
  if (semitone === undefined) return 0
  const midi = (octave + 1) * 12 + semitone
  return Number((440 * Math.pow(2, (midi - 69) / 12)).toFixed(2))
}

// ---------------------------------------------------------------------------
// PitchSample factory
// ---------------------------------------------------------------------------

/**
 * Create a PitchSample for evaluation tests.
 * `offsetMs` is the timing offset from the scheduled beat (negative = early).
 */
export function makeSample(frequency: number, offsetMs: number, clarity = 0.9): PitchSample {
  return {
    pitch: { frequency, clarity },
    offsetMs,
  }
}

// ---------------------------------------------------------------------------
// Timing windows
// ---------------------------------------------------------------------------

/**
 * Standard timing windows for testing.
 * Matches the output of `computeTimingWindows(120)` (rounded for readability):
 * - perfect: <= 40ms
 * - good: <= 90ms
 * - late: <= 200ms
 * - missed: > 200ms
 */
export const TEST_TIMING_WINDOWS: TimingWindows = {
  perfectMs: 40,
  goodMs: 90,
  lateMs: 200,
}

// ---------------------------------------------------------------------------
// Scale sequence builder
// ---------------------------------------------------------------------------

/**
 * Build a simple ScaleSequence for testing with sensible defaults.
 * Each step is a C Major scale at octave 2.
 */
export function makeTestSequence(options?: {
  steps?: number
  direction?: ScaleDirection
  skipTransition?: boolean
  shiftSemitones?: number
}): ScaleSequence {
  const stepCount = options?.steps ?? 1
  const direction = options?.direction ?? 'ascending'
  const skipTransition = options?.skipTransition ?? false
  const shiftSemitones = options?.shiftSemitones ?? 0

  const steps = Array.from({ length: stepCount }, (_, i) => ({
    rootNote: 'C',
    rootOctave: 2,
    scaleTypeIndex: 0, // Major
    label: `Step ${i + 1}`,
  }))

  return {
    id: 'test-sequence',
    name: 'Test Sequence',
    description: 'A test scale sequence',
    steps,
    direction,
    skipTransition,
    shiftSemitones,
  }
}

// ---------------------------------------------------------------------------
// Beat simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a series of metronome beat callbacks.
 *
 * Calls `callback(beat, time)` for `count` beats starting at `startTime`,
 * spaced by `beatDuration` seconds. Beat numbers are 0-indexed.
 *
 * @param callback - The beat handler (e.g., from MetronomeEngine.onBeat)
 * @param count - Number of beats to simulate
 * @param startTime - AudioContext time of the first beat (seconds)
 * @param beatDuration - Duration between beats (seconds), e.g. 0.5 for 120 BPM
 */
export function simulateBeats(
  callback: (beat: number, time: number) => void,
  count: number,
  startTime: number,
  beatDuration: number,
): void {
  for (let i = 0; i < count; i++) {
    callback(i, startTime + i * beatDuration)
  }
}
