/**
 * Integration tests for the rhythm evaluation and scoring pipeline.
 *
 * These tests verify that the full pipeline — from BPM-based timing windows
 * through pitch evaluation, scoring, live feedback, and cumulative stats —
 * produces consistent, correct results end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FrequencyToNoteResult } from '@core/wasm/types.ts'
import type { TimingResult } from '../types.ts'
import {
  makeNote,
  makePitch,
  makeSample,
  TEST_TIMING_WINDOWS,
} from '../../../__test-utils__/helpers.ts'

// ---------------------------------------------------------------------------
// Mock frequencyToNote — maps specific frequencies to known notes
// ---------------------------------------------------------------------------

const FREQ_NOTE_MAP: Record<number, FrequencyToNoteResult> = {}

function registerFrequency(
  freq: number,
  pitchClass: string,
  octave: number,
  centsOffset = 0,
) {
  const note = makeNote(pitchClass, octave)
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
import { evaluateNote, computeLiveFeedback } from '../evaluation.ts'
import {
  computeTimingWindows,
  gradeTimingOffset,
  scoreNote,
  scoreLabel,
} from '../types.ts'
import { computeTimingStats, computeRhythmCumulativeStats } from '../stats.ts'
import type { RhythmNoteEvent, RhythmScaleRunResult } from '../types.ts'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const A2 = makeNote('A', 2)
const E2 = makeNote('E', 2)
const G2 = makeNote('G', 2)

const DEFAULT_CENTS_TOLERANCE = 50
const IGNORE_OCTAVE = false

// ---------------------------------------------------------------------------
// Setup: register frequencies before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  for (const key of Object.keys(FREQ_NOTE_MAP)) {
    delete FREQ_NOTE_MAP[Number(key)]
  }
  registerFrequency(110, 'A', 2, 0)    // A2 exactly
  registerFrequency(112, 'A', 2, 8)    // A2, 8 cents sharp
  registerFrequency(82.41, 'E', 2, 0)  // E2 exactly
  registerFrequency(98, 'G', 2, 0)     // G2 exactly
})

// ===========================================================================
// 1. Timing Windows (computeTimingWindows)
// ===========================================================================

describe('computeTimingWindows', () => {
  it('scenario 1: at 120 BPM produces ~40ms perfect, ~90ms good, ~200ms late', () => {
    const w = computeTimingWindows(120)
    // beatMs = 60000/120 = 500
    // perfectMs = clamp(500*0.08, 25, 75) = clamp(40, 25, 75) = 40
    // goodMs    = clamp(500*0.18, 50, 150) = clamp(90, 50, 150) = 90
    // lateMs    = clamp(500*0.40, 100, 300) = clamp(200, 100, 300) = 200
    expect(w.perfectMs).toBe(40)
    expect(w.goodMs).toBe(90)
    expect(w.lateMs).toBe(200)
  })

  it('scenario 2: at 60 BPM hits ceilings (75, 150, 300)', () => {
    const w = computeTimingWindows(60)
    // beatMs = 1000
    // perfectMs = clamp(80, 25, 75) = 75
    // goodMs    = clamp(180, 50, 150) = 150
    // lateMs    = clamp(400, 100, 300) = 300
    expect(w.perfectMs).toBe(75)
    expect(w.goodMs).toBe(150)
    expect(w.lateMs).toBe(300)
  })

  it('scenario 3: at 200 BPM hits floors (25, ~54, ~120)', () => {
    const w = computeTimingWindows(200)
    // beatMs = 300
    // perfectMs = clamp(24, 25, 75) = 25
    // goodMs    = clamp(54, 50, 150) = 54
    // lateMs    = clamp(120, 100, 300) = 120
    expect(w.perfectMs).toBe(25)
    expect(w.goodMs).toBe(54)
    expect(w.lateMs).toBe(120)
  })

  it('scenario 4: at 30 BPM all values are ceiling-clamped', () => {
    const w = computeTimingWindows(30)
    // beatMs = 2000
    // perfectMs = clamp(160, 25, 75) = 75
    // goodMs    = clamp(360, 50, 150) = 150
    // lateMs    = clamp(800, 100, 300) = 300
    expect(w.perfectMs).toBe(75)
    expect(w.goodMs).toBe(150)
    expect(w.lateMs).toBe(300)
  })
})

// ===========================================================================
// 2. Timing Grading (gradeTimingOffset)
// ===========================================================================

describe('gradeTimingOffset', () => {
  it('scenario 5: 0ms offset is perfect', () => {
    expect(gradeTimingOffset(0, TEST_TIMING_WINDOWS)).toBe('perfect')
  })

  it('scenario 6: exactly at perfectMs boundary is perfect', () => {
    expect(gradeTimingOffset(TEST_TIMING_WINDOWS.perfectMs, TEST_TIMING_WINDOWS)).toBe('perfect')
  })

  it('scenario 7: just over perfectMs is good', () => {
    expect(gradeTimingOffset(TEST_TIMING_WINDOWS.perfectMs + 0.01, TEST_TIMING_WINDOWS)).toBe('good')
  })

  it('scenario 8: exactly at lateMs is late', () => {
    expect(gradeTimingOffset(TEST_TIMING_WINDOWS.lateMs, TEST_TIMING_WINDOWS)).toBe('late')
  })

  it('scenario 9: just over lateMs is missed', () => {
    expect(gradeTimingOffset(TEST_TIMING_WINDOWS.lateMs + 0.01, TEST_TIMING_WINDOWS)).toBe('missed')
  })
})

// ===========================================================================
// 3. Unified Scoring (scoreNote + scoreLabel)
// ===========================================================================

describe('scoreNote and scoreLabel', () => {
  const cases: Array<{
    pitchCorrect: boolean
    timingResult: TimingResult
    expectedPoints: number
    expectedLabel: string
  }> = [
    { pitchCorrect: true,  timingResult: 'perfect', expectedPoints: 10, expectedLabel: 'Great' },
    { pitchCorrect: true,  timingResult: 'good',    expectedPoints: 8,  expectedLabel: 'Good' },
    { pitchCorrect: true,  timingResult: 'late',    expectedPoints: 5,  expectedLabel: 'OK' },
    { pitchCorrect: true,  timingResult: 'missed',  expectedPoints: 2,  expectedLabel: 'Late' },
    { pitchCorrect: false, timingResult: 'perfect', expectedPoints: 1,  expectedLabel: 'Wrong note' },
    { pitchCorrect: false, timingResult: 'good',    expectedPoints: 1,  expectedLabel: 'Wrong note' },
    { pitchCorrect: false, timingResult: 'late',    expectedPoints: 0,  expectedLabel: 'Missed' },
    { pitchCorrect: false, timingResult: 'missed',  expectedPoints: 0,  expectedLabel: 'Missed' },
  ]

  it('scenario 10: all 8 pitch x timing combinations produce correct points', () => {
    for (const { pitchCorrect, timingResult, expectedPoints } of cases) {
      const points = scoreNote(pitchCorrect, timingResult)
      expect(points, `pitch=${pitchCorrect}, timing=${timingResult}`).toBe(expectedPoints)
    }
  })

  it('scenario 11: scoreLabel maps each point value to the correct label', () => {
    for (const { expectedPoints, expectedLabel } of cases) {
      const label = scoreLabel(expectedPoints)
      expect(label, `points=${expectedPoints}`).toBe(expectedLabel)
    }
  })
})

// ===========================================================================
// 4. evaluateNote (with mocked frequencyToNote)
// ===========================================================================

describe('evaluateNote', () => {
  it('scenario 12: no samples returns missed with pitchCorrect=false', () => {
    const result = evaluateNote(
      0, A2, 1.0, [], null,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    expect(result.detectedNote).toBeNull()
    expect(result.timingResult).toBe('missed')
    expect(result.timingOffsetMs).toBe(0)
  })

  it('scenario 13: single correct sample at 20ms is pitchCorrect=true, timing=perfect', () => {
    const sample = makeSample(110, 20)
    const result = evaluateNote(
      0, A2, 1.0, [sample], sample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.detectedNote).toEqual(A2)
    expect(result.timingResult).toBe('perfect')
    expect(result.timingOffsetMs).toBe(20)
  })

  it('scenario 14: single correct sample at 250ms is pitchCorrect=true, timing=missed', () => {
    // 250ms > lateMs (200) for TEST_TIMING_WINDOWS, so should be 'missed'
    const sample = makeSample(110, 250)
    const result = evaluateNote(
      0, A2, 1.0, [sample], sample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingResult).toBe('missed')
    expect(result.timingOffsetMs).toBe(250)
  })

  it('scenario 15: single wrong sample returns pitchCorrect=false', () => {
    const sample = makeSample(82.41, 30) // E2, not A2
    const result = evaluateNote(
      0, A2, 1.0, [sample], sample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    expect(result.detectedNote).toEqual(E2)
  })

  it('scenario 16: mixed wrong-early + correct-late uses timing from the correct sample, not the early one', () => {
    const wrongEarly = makeSample(82.41, 10, 0.8)   // E2 at 10ms
    const correctLate = makeSample(110, 200, 0.9)    // A2 at 200ms

    const result = evaluateNote(
      0, A2, 1.0,
      [wrongEarly, correctLate],
      wrongEarly, // closestSample is the wrong note
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.detectedNote).toEqual(A2)
    // Timing must reflect when A2 was played (200ms), not when E2 triggered (10ms)
    expect(result.timingOffsetMs).toBe(200)
    expect(result.timingResult).toBe('late') // 200ms <= lateMs(200), so 'late'
  })

  it('scenario 17: multiple correct samples picks the one closest to scheduled time', () => {
    const farMatch = makeSample(110, 100)    // A2 at 100ms
    const closeMatch = makeSample(112, 15)   // A2 (8 cents sharp) at 15ms

    const result = evaluateNote(
      0, A2, 1.0,
      [farMatch, closeMatch],
      closeMatch,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingOffsetMs).toBe(15)
    expect(result.timingResult).toBe('perfect')
    expect(result.centsOff).toBe(8)
  })

  it('scenario 18: wrong samples only picks highest clarity for reporting', () => {
    const lowClarity = makeSample(82.41, 15, 0.5)  // E2 clarity 0.5
    const highClarity = makeSample(98, 100, 0.95)   // G2 clarity 0.95

    const result = evaluateNote(
      0, A2, 1.0,
      [lowClarity, highClarity],
      lowClarity,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(false)
    // Should report G2 (highest clarity), not E2
    expect(result.detectedNote).toEqual(G2)
    // Timing uses closestSample (lowClarity at 15ms)
    expect(result.timingOffsetMs).toBe(15)
  })

  it('scenario 18b: early sample (negative offset) is preferred over later sustain near the beat', () => {
    // Simulates carry-forward: player attacked 80ms early (look-ahead buffer),
    // then pitch sustained through the beat at +5ms.
    const earlySample = makeSample(110, -80, 0.85)    // A2 at -80ms (early attack)
    const sustainSample = makeSample(110, 5, 0.9)     // A2 at +5ms (sustain)

    const result = evaluateNote(
      0, A2, 1.0,
      [earlySample, sustainSample],
      sustainSample, // closestSample is the sustain
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    // Should use the early sample (-80ms), not the sustain (+5ms)
    expect(result.timingOffsetMs).toBe(-80)
    // |80ms| > goodMs(90)? No, 80 <= 90 so it's 'good'
    expect(result.timingResult).toBe('good')
  })

  it('scenario 18c: single early sample with negative offset grades correctly', () => {
    const earlySample = makeSample(110, -30, 0.9) // A2 at -30ms early
    const result = evaluateNote(
      0, A2, 1.0,
      [earlySample], earlySample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(result.pitchCorrect).toBe(true)
    expect(result.timingOffsetMs).toBe(-30)
    // |30ms| <= perfectMs(40) → perfect
    expect(result.timingResult).toBe('perfect')
  })
})

// ===========================================================================
// 5. computeLiveFeedback
// ===========================================================================

describe('computeLiveFeedback', () => {
  it('scenario 19: first detection returns feedback', () => {
    const pitch = makePitch(110)
    const result = computeLiveFeedback(
      pitch, A2, 30, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, 0,
    )

    expect(result).not.toBeNull()
    expect(result!.noteIndex).toBe(0)
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('perfect')
  })

  it('scenario 20: already correct for this note returns null', () => {
    const pitch = makePitch(110)
    const currentFeedback = { noteIndex: 0, pitchCorrect: true, timingResult: 'perfect' as TimingResult }

    const result = computeLiveFeedback(
      pitch, A2, 30, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      currentFeedback, 0,
    )

    expect(result).toBeNull()
  })

  it('scenario 21: upgrade from wrong to correct returns updated feedback', () => {
    const pitch = makePitch(110) // A2 - correct
    const currentFeedback = { noteIndex: 0, pitchCorrect: false, timingResult: 'perfect' as TimingResult }

    const result = computeLiveFeedback(
      pitch, A2, 100, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      currentFeedback, 0,
    )

    expect(result).not.toBeNull()
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('late') // 100ms > goodMs(90), so it grades as 'late'
  })

  it('scenario 22: same note still wrong returns null', () => {
    const pitch = makePitch(82.41) // E2 - wrong for A2
    const currentFeedback = { noteIndex: 0, pitchCorrect: false, timingResult: 'perfect' as TimingResult }

    const result = computeLiveFeedback(
      pitch, A2, 80, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      currentFeedback, 0,
    )

    expect(result).toBeNull()
  })

  it('scenario 23: new noteIndex returns feedback', () => {
    const pitch = makePitch(82.41) // E2
    const currentFeedback = { noteIndex: 0, pitchCorrect: true, timingResult: 'perfect' as TimingResult }

    const result = computeLiveFeedback(
      pitch, E2, 20, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      currentFeedback, 1,
    )

    expect(result).not.toBeNull()
    expect(result!.noteIndex).toBe(1)
    expect(result!.pitchCorrect).toBe(true)
    expect(result!.timingResult).toBe('perfect')
  })
})

// ===========================================================================
// 6. Consistency: live feedback matches evaluateNote
// ===========================================================================

describe('live feedback and evaluateNote consistency', () => {
  it('scenario 24: single sample produces same pitchCorrect and timingResult in both paths', () => {
    const pitch = makePitch(110)
    const offsetMs = 80 // good window

    const liveFeedback = computeLiveFeedback(
      pitch, A2, offsetMs, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, 0,
    )
    expect(liveFeedback).not.toBeNull()

    const sample = makeSample(110, offsetMs)
    const finalResult = evaluateNote(
      0, A2, 1.0, [sample], sample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(finalResult.pitchCorrect).toBe(liveFeedback!.pitchCorrect)
    expect(finalResult.timingResult).toBe(liveFeedback!.timingResult)
  })

  it('scenario 25: stale transient scenario — both paths show late timing for the correct match', () => {
    const pitch = makePitch(110) // A2 - correct
    const correctOffsetMs = 180

    // Live feedback fires only on the correct detection
    const liveFeedback = computeLiveFeedback(
      pitch, A2, correctOffsetMs, TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
      null, 0,
    )
    expect(liveFeedback).not.toBeNull()
    expect(liveFeedback!.timingResult).toBe(
      gradeTimingOffset(Math.abs(correctOffsetMs), TEST_TIMING_WINDOWS),
    )

    // Final evaluation sees both the stale transient and the correct note
    const staleSample = makeSample(82.41, 10, 0.5) // E2 at 10ms
    const correctSample = makeSample(110, correctOffsetMs, 0.9)

    const finalResult = evaluateNote(
      0, A2, 1.0,
      [staleSample, correctSample],
      staleSample, // closestSample is the stale transient
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    expect(finalResult.pitchCorrect).toBe(liveFeedback!.pitchCorrect)
    expect(finalResult.timingResult).toBe(liveFeedback!.timingResult)
    expect(finalResult.timingOffsetMs).toBe(correctOffsetMs)
  })

  it('scenario 26a: sample buffer eviction — original perfect sample evicted, evaluateNote still finds a match but at a worse offset', () => {
    // This tests the root cause of the "perfect live feedback but late in results" bug.
    // The early perfect sample (20ms) gets evicted from the 20-sample buffer by later
    // higher-clarity samples. evaluateNote then finds a matching sample at 180ms and
    // grades it as 'late'. The hook's evaluateCurrentNote wrapper overrides timing
    // from the stored live feedback, but evaluateNote alone would disagree.
    // correctEarlySample at 20ms/0.55 clarity was evicted from the buffer
    const correctLateSample = makeSample(110, 180, 0.95)    // A2, late timing, high clarity

    // evaluateNote with only the late sample (early one evicted)
    const result = evaluateNote(
      0, A2, 1.0,
      [correctLateSample],
      correctLateSample,
      TEST_TIMING_WINDOWS, DEFAULT_CENTS_TOLERANCE, IGNORE_OCTAVE,
    )

    // evaluateNote grades from the late sample — this IS the divergence
    expect(result.pitchCorrect).toBe(true)
    expect(result.timingResult).toBe(gradeTimingOffset(180, TEST_TIMING_WINDOWS))
    // The hook wrapper (evaluateCurrentNote) would override this with the live
    // feedback's 'perfect' timing — tested in the rhythm-practice integration tests.
  })
})

// ===========================================================================
// 7. Stats (computeTimingStats)
// ===========================================================================

describe('computeTimingStats', () => {
  it('scenario 26: mix of perfect/good/late/missed produces correct counts and average', () => {
    const events: RhythmNoteEvent[] = [
      {
        noteIndex: 0, expectedNote: A2, scheduledTime: 1.0,
        pitchCorrect: true, detectedNote: A2, centsOff: 0,
        timingResult: 'perfect', timingOffsetMs: 10,
      },
      {
        noteIndex: 1, expectedNote: A2, scheduledTime: 1.5,
        pitchCorrect: true, detectedNote: A2, centsOff: 0,
        timingResult: 'good', timingOffsetMs: 60,
      },
      {
        noteIndex: 2, expectedNote: A2, scheduledTime: 2.0,
        pitchCorrect: true, detectedNote: A2, centsOff: 0,
        timingResult: 'late', timingOffsetMs: 150,
      },
      {
        noteIndex: 3, expectedNote: A2, scheduledTime: 2.5,
        pitchCorrect: false, detectedNote: null, centsOff: 0,
        timingResult: 'missed', timingOffsetMs: 0,
      },
      {
        noteIndex: 4, expectedNote: A2, scheduledTime: 3.0,
        pitchCorrect: true, detectedNote: A2, centsOff: 0,
        timingResult: 'perfect', timingOffsetMs: -5,
      },
    ]

    const stats = computeTimingStats(events)

    expect(stats.perfectCount).toBe(2)
    expect(stats.goodCount).toBe(1)
    expect(stats.lateCount).toBe(1)
    expect(stats.missedCount).toBe(1)
    // Average offset excludes missed: (10 + 60 + 150 + (-5)) / 4 = 215/4 = 53.75
    expect(stats.averageOffsetMs).toBeCloseTo(53.75, 5)
  })

  it('scenario 27: empty events returns zero stats', () => {
    const stats = computeTimingStats([])

    expect(stats.perfectCount).toBe(0)
    expect(stats.goodCount).toBe(0)
    expect(stats.lateCount).toBe(0)
    expect(stats.missedCount).toBe(0)
    expect(stats.averageOffsetMs).toBe(0)
  })
})

// ===========================================================================
// 8. Cumulative Stats (computeRhythmCumulativeStats)
// ===========================================================================

describe('computeRhythmCumulativeStats', () => {
  function makeEvent(overrides: Partial<RhythmNoteEvent> & Pick<RhythmNoteEvent, 'pitchCorrect' | 'timingResult'>): RhythmNoteEvent {
    return {
      noteIndex: 0,
      expectedNote: A2,
      scheduledTime: 1.0,
      detectedNote: overrides.pitchCorrect ? A2 : null,
      centsOff: 0,
      timingOffsetMs: 0,
      ...overrides,
    }
  }

  function makeRunResult(events: RhythmNoteEvent[]): RhythmScaleRunResult {
    const totalPoints = events.reduce(
      (sum, e) => sum + scoreNote(e.pitchCorrect, e.timingResult),
      0,
    )
    return {
      step: { rootNote: 'A', rootOctave: 2, scaleTypeIndex: 0 },
      label: 'Test',
      scaleNotes: [A2],
      noteEvents: events,
      scorePercent: events.length > 0 ? (totalPoints / (10 * events.length)) * 100 : 0,
      timingStats: computeTimingStats(events),
      completedAt: Date.now(),
    }
  }

  it('scenario 28: multiple results aggregate correctly', () => {
    const run1Events: RhythmNoteEvent[] = [
      makeEvent({ noteIndex: 0, pitchCorrect: true, timingResult: 'perfect', timingOffsetMs: 5, centsOff: 2 }),
      makeEvent({ noteIndex: 1, pitchCorrect: false, timingResult: 'good', timingOffsetMs: 70 }),
    ]
    const run2Events: RhythmNoteEvent[] = [
      makeEvent({ noteIndex: 0, pitchCorrect: true, timingResult: 'good', timingOffsetMs: 80, centsOff: 5 }),
      makeEvent({ noteIndex: 1, pitchCorrect: false, timingResult: 'missed', timingOffsetMs: 0 }),
    ]

    const results = [makeRunResult(run1Events), makeRunResult(run2Events)]
    const cumulative = computeRhythmCumulativeStats(results)

    expect(cumulative.totalScalesCompleted).toBe(2)
    expect(cumulative.totalNotesAttempted).toBe(4)
    // Correct = pitchCorrect AND timing !== 'missed'
    // run1[0]: correct(true, perfect) -> correct
    // run1[1]: wrong(false, good) -> incorrect
    // run2[0]: correct(true, good) -> correct
    // run2[1]: wrong(false, missed) -> missed
    expect(cumulative.totalCorrect).toBe(2)
    expect(cumulative.totalIncorrect).toBe(1)
    expect(cumulative.totalMissed).toBe(1)
    expect(cumulative.overallAccuracyPercent).toBe(50) // 2/4 * 100

    // averageCentsOffset = (|2| + |5|) / 2 = 3.5
    expect(cumulative.averageCentsOffset).toBeCloseTo(3.5, 5)

    // Timing aggregation across all events
    expect(cumulative.timing.perfectCount).toBe(1)
    expect(cumulative.timing.goodCount).toBe(2)
    expect(cumulative.timing.lateCount).toBe(0)
    expect(cumulative.timing.missedCount).toBe(1)
  })

  it('scenario 29: overallScorePercent = sum(scoreNote) / (10 * total) * 100', () => {
    // 3 events with known scores:
    // correct + perfect = 10
    // correct + late    = 5
    // wrong   + perfect = 1
    const events: RhythmNoteEvent[] = [
      makeEvent({ noteIndex: 0, pitchCorrect: true, timingResult: 'perfect', timingOffsetMs: 5, centsOff: 0 }),
      makeEvent({ noteIndex: 1, pitchCorrect: true, timingResult: 'late', timingOffsetMs: 150, centsOff: 3 }),
      makeEvent({ noteIndex: 2, pitchCorrect: false, timingResult: 'perfect', timingOffsetMs: 10 }),
    ]

    const results = [makeRunResult(events)]
    const cumulative = computeRhythmCumulativeStats(results)

    const expectedPoints = 10 + 5 + 1 // 16
    const expectedPercent = (expectedPoints / (10 * 3)) * 100 // 53.333...
    expect(cumulative.overallScorePercent).toBeCloseTo(expectedPercent, 5)
  })

  it('scenario 30: empty results returns zero stats', () => {
    const cumulative = computeRhythmCumulativeStats([])

    expect(cumulative.totalScalesCompleted).toBe(0)
    expect(cumulative.totalNotesAttempted).toBe(0)
    expect(cumulative.totalCorrect).toBe(0)
    expect(cumulative.totalIncorrect).toBe(0)
    expect(cumulative.totalMissed).toBe(0)
    expect(cumulative.overallAccuracyPercent).toBe(0)
    expect(cumulative.averageCentsOffset).toBe(0)
    expect(cumulative.overallScorePercent).toBe(0)
    expect(cumulative.timing.perfectCount).toBe(0)
    expect(cumulative.timing.goodCount).toBe(0)
    expect(cumulative.timing.lateCount).toBe(0)
    expect(cumulative.timing.missedCount).toBe(0)
    expect(cumulative.timing.averageOffsetMs).toBe(0)
  })
})
