import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Note, DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import type { TimingWindows, TimingResult } from './types.ts'
import { gradeTimingOffset } from './types.ts'
import type { PitchSample } from './evaluation.ts'

// ---------------------------------------------------------------------------
// Mock frequencyToNote — maps specific frequencies to known notes
// ---------------------------------------------------------------------------

const FREQ_NOTE_MAP: Record<number, FrequencyToNoteResult> = {}

function registerFrequency(freq: number, note: Note, centsOffset = 0) {
  FREQ_NOTE_MAP[freq] = { note, centsOffset }
}

vi.mock('@core/wasm/noteUtils.ts', () => ({
  frequencyToNote: vi.fn((freq: number): FrequencyToNoteResult => {
    const result = FREQ_NOTE_MAP[freq]
    if (!result) {
      throw new Error(`Unmocked frequency: ${freq}`)
    }
    return result
  }),
}))

// Import after mock so the mock is in place
import { evaluateNote, computeLiveFeedback } from './evaluation.ts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeNote(name: string, pitchClass: string, octave: number, midi: number, frequency: number): Note {
  return { name, pitchClass, octave, midi, frequency }
}

const A4 = makeNote('A4', 'A', 4, 69, 440)
const A3 = makeNote('A3', 'A', 3, 57, 220)
const E4 = makeNote('E4', 'E', 4, 64, 330)
const B4 = makeNote('B4', 'B', 4, 71, 494)

function makeSample(frequency: number, offsetMs: number, clarity = 0.9): PitchSample {
  return {
    pitch: { frequency, clarity, rms: 0.1 },
    offsetMs,
  }
}

/** Timing windows that give clear boundaries for testing:
 *  perfect: <= 50ms, good: <= 120ms, late: <= 250ms, missed: > 250ms */
const TEST_WINDOWS: TimingWindows = {
  perfectMs: 50,
  goodMs: 120,
  lateMs: 250,
}

const DEFAULT_CENTS_TOLERANCE = 50
const IGNORE_OCTAVE = false

// ---------------------------------------------------------------------------
// Setup: register frequencies before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear and re-register
  for (const key of Object.keys(FREQ_NOTE_MAP)) {
    delete FREQ_NOTE_MAP[Number(key)]
  }
  registerFrequency(440, A4, 0)       // A4 exactly
  registerFrequency(442, A4, 8)       // A4, 8 cents sharp
  registerFrequency(220, A3, 0)       // A3 exactly
  registerFrequency(330, E4, 0)       // E4 exactly
  registerFrequency(494, B4, 0)       // B4 exactly
  registerFrequency(331, E4, 5)       // E4, 5 cents sharp
})

// ===========================================================================
// evaluateNote
// ===========================================================================

describe('evaluateNote', () => {
  it('returns missed when there are no samples', () => {
    const result = evaluateNote(
      0, A4, 1.0, [], null, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    expect(result.detectedNote).toBeNull()
    expect(result.timingResult).toBe('missed')
    expect(result.timingOffsetMs).toBe(0)
  })

  it('returns correct pitch and perfect timing for a matching sample near the beat', () => {
    const sample = makeSample(440, 20)
    const result = evaluateNote(
      0, A4, 1.0, [sample], sample, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.detectedNote).toEqual(A4)
    expect(result.timingResult).toBe('perfect')
    expect(result.timingOffsetMs).toBe(20)
  })

  it('returns correct pitch and late timing for a matching sample far from the beat', () => {
    const sample = makeSample(440, 200)
    const result = evaluateNote(
      0, A4, 1.0, [sample], sample, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingResult).toBe('late')
    expect(result.timingOffsetMs).toBe(200)
  })

  it('returns wrong pitch when no sample matches the expected note', () => {
    const sample = makeSample(330, 30) // E4, not A4
    const result = evaluateNote(
      0, A4, 1.0, [sample], sample, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    expect(result.detectedNote).toEqual(E4)
    expect(result.timingResult).toBe('perfect') // close timing but wrong note
  })

  it('uses the matching sample timing, not closestSample timing, when they diverge', () => {
    // This is the core bug scenario:
    // closestSample is a wrong-note detection at 10ms (would be "perfect")
    // correct-note detection exists at 200ms (should be "late")
    const wrongSample = makeSample(330, 10, 0.8)   // E4 at 10ms — closest to beat
    const correctSample = makeSample(440, 200, 0.9) // A4 at 200ms — the actual note

    const result = evaluateNote(
      0, A4, 1.0,
      [wrongSample, correctSample],
      wrongSample, // closestSample is the wrong note
      TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.detectedNote).toEqual(A4)
    // Timing should reflect when A4 was played (200ms), not when E4 triggered (10ms)
    expect(result.timingOffsetMs).toBe(200)
    expect(result.timingResult).toBe('late')
  })

  it('picks the closest-timed match among multiple correct detections', () => {
    const farMatch = makeSample(440, 100)   // A4 at 100ms
    const closeMatch = makeSample(442, 30)  // A4 (8 cents sharp) at 30ms

    const result = evaluateNote(
      0, A4, 1.0,
      [farMatch, closeMatch],
      closeMatch,
      TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingOffsetMs).toBe(30)
    expect(result.timingResult).toBe('perfect')
    expect(result.centsOff).toBe(8) // from the 442 Hz sample
  })

  it('uses closestSample timing when only wrong-note detections exist', () => {
    const closeSample = makeSample(330, 15, 0.7)  // E4 at 15ms
    const farSample = makeSample(494, 200, 0.9)   // B4 at 200ms — higher clarity

    const result = evaluateNote(
      0, A4, 1.0,
      [closeSample, farSample],
      closeSample,
      TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    // Should use closestSample timing (15ms), and pick highest clarity note (B4)
    expect(result.timingOffsetMs).toBe(15)
    expect(result.timingResult).toBe('perfect')
    expect(result.detectedNote).toEqual(B4) // highest clarity
  })

  it('handles negative offsets (early detections) correctly', () => {
    const sample = makeSample(440, -40) // 40ms early
    const result = evaluateNote(
      0, A4, 1.0, [sample], sample, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingOffsetMs).toBe(-40)
    expect(result.timingResult).toBe('perfect') // abs(40) <= 50
  })
})

// ===========================================================================
// computeLiveFeedback
// ===========================================================================

describe('computeLiveFeedback', () => {
  it('returns feedback on first detection (no previous feedback)', () => {
    const pitch: DetectedPitch = { frequency: 440, clarity: 0.9, rms: 0.1 }
    const result = computeLiveFeedback(
      pitch, A4, 30, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, // no previous feedback
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('perfect')
    expect(result!.noteIndex).toBe(0)
  })

  it('returns null when previous feedback already shows correct pitch for this note', () => {
    const pitch: DetectedPitch = { frequency: 440, clarity: 0.9, rms: 0.1 }
    const previousFeedback = { noteIndex: 0, pitchCorrect: true, timingResult: 'perfect' as TimingResult, timingOffsetMs: 0 }

    const result = computeLiveFeedback(
      pitch, A4, 30, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      previousFeedback,
      0,
    )

    expect(result).toBeNull()
  })

  it('upgrades from wrong to correct when a matching detection arrives', () => {
    const pitch: DetectedPitch = { frequency: 440, clarity: 0.9, rms: 0.1 }
    const previousFeedback = { noteIndex: 0, pitchCorrect: false, timingResult: 'perfect' as TimingResult, timingOffsetMs: 0 }

    const result = computeLiveFeedback(
      pitch, A4, 100, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      previousFeedback,
      0,
    )

    expect(result).not.toBeNull()
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('good') // 100ms -> good
  })

  it('returns null when previous and new detection are both wrong for the same note', () => {
    const pitch: DetectedPitch = { frequency: 330, clarity: 0.9, rms: 0.1 } // E4, wrong note
    const previousFeedback = { noteIndex: 0, pitchCorrect: false, timingResult: 'perfect' as TimingResult, timingOffsetMs: 0 }

    const result = computeLiveFeedback(
      pitch, A4, 80, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      previousFeedback,
      0,
    )

    expect(result).toBeNull()
  })

  it('returns feedback when transitioning to a new note index', () => {
    const pitch: DetectedPitch = { frequency: 330, clarity: 0.9, rms: 0.1 } // E4
    const previousFeedback = { noteIndex: 0, pitchCorrect: true, timingResult: 'perfect' as TimingResult, timingOffsetMs: 0 }

    const result = computeLiveFeedback(
      pitch, E4, 20, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      previousFeedback,
      1, // new noteIndex
    )

    expect(result).not.toBeNull()
    expect(result!.noteIndex).toBe(1)
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('perfect')
  })
})

// ===========================================================================
// Consistency: live feedback timing matches final evaluation
// ===========================================================================

describe('live feedback and evaluateNote consistency', () => {
  it('produces the same timing result when evaluateNote uses the same sample as live feedback', () => {
    // Simulate: player plays A4 at 100ms offset
    const pitch: DetectedPitch = { frequency: 440, clarity: 0.9, rms: 0.1 }
    const offsetMs = 100

    // Live feedback computation
    const liveFeedback = computeLiveFeedback(
      pitch, A4, offsetMs, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, 0,
    )

    expect(liveFeedback).not.toBeNull()

    // Final evaluation with the same sample
    const sample = makeSample(440, offsetMs)
    const finalResult = evaluateNote(
      0, A4, 1.0,
      [sample],
      sample,
      TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(finalResult.pitchCorrect).toBe(liveFeedback!.pitchCorrect)
    expect(finalResult.timingResult).toBe(liveFeedback!.timingResult)
  })

  it('produces matching timing even when a stale closest sample exists', () => {
    // The key scenario: a leftover transient is closest to the beat, but the
    // correct note arrives later. Live feedback fires on the correct note.
    const pitch: DetectedPitch = { frequency: 440, clarity: 0.9, rms: 0.1 }
    const correctOffsetMs = 180

    // Live feedback fires on the correct detection
    const liveFeedback = computeLiveFeedback(
      pitch, A4, correctOffsetMs, TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, 0,
    )

    expect(liveFeedback).not.toBeNull()
    expect(liveFeedback!.timingResult).toBe(gradeTimingOffset(Math.abs(correctOffsetMs), TEST_WINDOWS))

    // Final evaluation with both the stale transient and the correct note
    const staleSample = makeSample(330, 10, 0.5) // E4 transient at 10ms
    const correctSample = makeSample(440, correctOffsetMs, 0.9)

    const finalResult = evaluateNote(
      0, A4, 1.0,
      [staleSample, correctSample],
      staleSample, // closestSample is the stale transient
      TEST_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    // After fix: both should agree
    expect(finalResult.pitchCorrect).toBe(liveFeedback!.pitchCorrect)
    expect(finalResult.timingResult).toBe(liveFeedback!.timingResult)
    expect(finalResult.timingOffsetMs).toBe(correctOffsetMs)
  })
})
