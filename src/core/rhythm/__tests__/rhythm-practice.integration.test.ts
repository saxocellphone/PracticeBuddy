/**
 * Integration tests for the useRhythmPractice hook.
 *
 * These tests exercise the full rhythm practice flow end-to-end:
 * countdown, note advancement, pitch evaluation, timing grading,
 * live feedback, multi-step sequences, session completion, and stopping.
 *
 * The hook is rendered via @testing-library/react's renderHook + act().
 * WASM, AudioContext, and requestAnimationFrame are all mocked.
 */

// ---------------------------------------------------------------------------
// vi.mock declarations — MUST be in the test file so Vitest hoists them
// into this module's scope. The factories reference module-level variables
// that are mutated by the setup helpers below.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Note, FrequencyToNoteResult, ScaleInfo } from '@core/wasm/types.ts'

/** Module-level mock state shared with vi.mock factory closures */
let _frequencyMap: Record<number, FrequencyToNoteResult> = {}
let _scaleNotes: Note[] = []

const DEFAULT_SCALE_TYPES: ScaleInfo[] = [
  { name: 'Major', displayName: 'Major', category: 'common' },
  { name: 'NaturalMinor', displayName: 'Natural Minor', category: 'common' },
]

// These mocks intercept all transitive WASM imports before any module loads
vi.mock('@core/wasm/noteUtils.ts', () => ({
  frequencyToNote: vi.fn((freq: number): FrequencyToNoteResult => {
    const result = _frequencyMap[freq]
    if (!result) {
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
  buildScale: vi.fn((): Note[] => [..._scaleNotes]),
  getScaleType: vi.fn(() => ({})),
  listScaleTypes: vi.fn((): ScaleInfo[] => DEFAULT_SCALE_TYPES),
}))

vi.mock('@core/wasm/init.ts', () => ({
  initWasm: vi.fn(async () => ({})),
  getWasm: vi.fn(() => ({})),
}))

// ---------------------------------------------------------------------------
// Imports — safe to do after vi.mock declarations (Vitest hoists mocks above)
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react'
import {
  createMockAudioContext,
  type MockAudioContext,
} from '../../../__test-utils__/mock-audio.ts'
import {
  installMockRAF,
  type RAFController,
} from '../../../__test-utils__/mock-raf.ts'
import {
  makeNote,
  makePitch,
  makeTestSequence,
} from '../../../__test-utils__/helpers.ts'
import { useRhythmPractice, COUNTDOWN_BEATS } from '@hooks/useRhythmPractice.ts'
import { computeTimingWindows } from '@core/rhythm/types.ts'
import type { Note as NoteType } from '@core/wasm/types.ts'

// ---------------------------------------------------------------------------
// Default frequency map (matches mock-wasm DEFAULT_FREQUENCY_MAP subset)
// ---------------------------------------------------------------------------

const DEFAULT_FREQUENCY_MAP: Record<number, FrequencyToNoteResult> = {
  41.2: { note: { name: 'E1', pitchClass: 'E', octave: 1, midi: 28, frequency: 41.2 }, centsOffset: 0 },
  55: { note: { name: 'A1', pitchClass: 'A', octave: 1, midi: 33, frequency: 55 }, centsOffset: 0 },
  65.41: { note: { name: 'C2', pitchClass: 'C', octave: 2, midi: 36, frequency: 65.41 }, centsOffset: 0 },
  73.42: { note: { name: 'D2', pitchClass: 'D', octave: 2, midi: 38, frequency: 73.42 }, centsOffset: 0 },
  82.41: { note: { name: 'E2', pitchClass: 'E', octave: 2, midi: 40, frequency: 82.41 }, centsOffset: 0 },
  87.31: { note: { name: 'F2', pitchClass: 'F', octave: 2, midi: 41, frequency: 87.31 }, centsOffset: 0 },
  98: { note: { name: 'G2', pitchClass: 'G', octave: 2, midi: 43, frequency: 98 }, centsOffset: 0 },
  110: { note: { name: 'A2', pitchClass: 'A', octave: 2, midi: 45, frequency: 110 }, centsOffset: 0 },
  440: { note: { name: 'A4', pitchClass: 'A', octave: 4, midi: 69, frequency: 440 }, centsOffset: 0 },
}

// ---------------------------------------------------------------------------
// Beat pub/sub — simulates MetronomeEngine.onBeat
// ---------------------------------------------------------------------------

type BeatCallback = (beat: number, time: number) => void
let beatListeners: BeatCallback[]

function onBeatSubscribe(cb: BeatCallback): () => void {
  beatListeners.push(cb)
  return () => {
    beatListeners = beatListeners.filter((l) => l !== cb)
  }
}

function fireBeat(beat: number, time: number) {
  // Snapshot to avoid mutation during iteration (handler may unsubscribe)
  const snapshot = [...beatListeners]
  for (const cb of snapshot) cb(beat, time)
}

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

let mockCtx: MockAudioContext
let raf: RAFController

// Standard test scale: C2 Major ascending (4 notes for brevity)
const SCALE_NOTES: NoteType[] = [
  makeNote('C', 2),
  makeNote('D', 2),
  makeNote('E', 2),
  makeNote('F', 2),
]

// Default test params
const BPM = 120
const BEAT_DURATION = 60 / BPM // 0.5s per beat
const NOTE_DURATION = 'quarter' as const
const CENTS_TOLERANCE = 40
const IGNORE_OCTAVE = true

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderRhythmHook() {
  return renderHook(() =>
    useRhythmPractice({
      audioContext: mockCtx as unknown as AudioContext,
      onBeatSubscribe,
    }),
  )
}

/** Start a rhythm session with default params and a given sequence. */
function startSession(
  hook: ReturnType<typeof renderRhythmHook>,
  options?: { steps?: number },
) {
  const sequence = makeTestSequence({ steps: options?.steps ?? 1 })
  act(() => {
    hook.result.current.startRhythm(
      sequence,
      BPM,
      NOTE_DURATION,
      CENTS_TOLERANCE,
      IGNORE_OCTAVE,
      mockCtx as unknown as AudioContext,
    )
  })
  return sequence
}

/**
 * Run through the full countdown by firing COUNTDOWN_BEATS beats.
 * Returns the scheduled audio time of the final (transition) beat,
 * which becomes the session's startTime.
 */
function completeCountdown(startTime = 0): number {
  for (let i = 0; i < COUNTDOWN_BEATS; i++) {
    const beatTime = startTime + i * BEAT_DURATION
    act(() => {
      fireBeat(i, beatTime)
    })
  }
  return startTime + (COUNTDOWN_BEATS - 1) * BEAT_DURATION
}

/**
 * Set mockCtx.currentTime to exactly `target` seconds.
 * advanceTime only adds, so we compute the delta from current.
 */
function setCtxTime(target: number) {
  const delta = target - mockCtx.currentTime
  if (delta > 0) {
    mockCtx.advanceTime(delta)
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCtx = createMockAudioContext()

  // Reset mock state for WASM modules
  _frequencyMap = { ...DEFAULT_FREQUENCY_MAP }
  _scaleNotes = [...SCALE_NOTES]

  // Register each SCALE_NOTES frequency in the frequency map
  for (const note of SCALE_NOTES) {
    _frequencyMap[note.frequency] = { note, centsOffset: 0 }
  }

  raf = installMockRAF()
  beatListeners = []
})

afterEach(() => {
  raf.restore()
  vi.useRealTimers()
})

// ===========================================================================
// 1. Countdown flow
// ===========================================================================

describe('countdown flow', () => {
  it('fires 5 beat callbacks, countdownBeat decrements 5->4->3->2->1, then transitions to playing', () => {
    const hook = renderRhythmHook()
    startSession(hook)

    expect(hook.result.current.sessionState?.phase).toBe('countdown')
    expect(hook.result.current.sessionState?.countdownBeat).toBe(COUNTDOWN_BEATS)

    // Fire beats 1 through 4 (remaining = 4, 3, 2, 1)
    for (let i = 0; i < COUNTDOWN_BEATS - 1; i++) {
      act(() => {
        fireBeat(i, i * BEAT_DURATION)
      })
      const expectedRemaining = COUNTDOWN_BEATS - (i + 1)
      expect(hook.result.current.sessionState?.countdownBeat).toBe(expectedRemaining)
      expect(hook.result.current.sessionState?.phase).toBe('countdown')
    }

    // Fire beat 5 -- triggers transition to playing
    act(() => {
      fireBeat(COUNTDOWN_BEATS - 1, (COUNTDOWN_BEATS - 1) * BEAT_DURATION)
    })
    expect(hook.result.current.sessionState?.phase).toBe('playing')
  })
})

// ===========================================================================
// 2. Start time from scheduled beat
// ===========================================================================

describe('start time from scheduled beat', () => {
  it('uses the scheduled audio time from beat 5, not ctx.currentTime', () => {
    const hook = renderRhythmHook()
    startSession(hook)

    // Simulate the JS callback firing much later than the audio schedule
    // (look-ahead scheduling scenario)
    mockCtx.advanceTime(5.0)

    const scheduledBeat5Time = (COUNTDOWN_BEATS - 1) * BEAT_DURATION
    completeCountdown()

    expect(hook.result.current.sessionState?.startTime).toBe(scheduledBeat5Time)
    expect(hook.result.current.sessionState?.startTime).not.toBe(mockCtx.currentTime)
  })
})

// ===========================================================================
// 3. Note advancement
// ===========================================================================

describe('note advancement', () => {
  it('advances currentNoteIndex at correct intervals at 120 BPM with quarter notes', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    expect(hook.result.current.sessionState?.phase).toBe('playing')
    expect(hook.result.current.sessionState?.currentNoteIndex).toBe(0)

    // Each quarter note at 120 BPM = 0.5s.
    // Advance just past the first note boundary -> note index 1
    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })
    expect(hook.result.current.sessionState?.currentNoteIndex).toBe(1)

    // Just past second note boundary -> note index 2
    setCtxTime(transitionTime + 1.01)
    act(() => { raf.step() })
    expect(hook.result.current.sessionState?.currentNoteIndex).toBe(2)

    // Just past third note boundary -> note index 3
    setCtxTime(transitionTime + 1.51)
    act(() => { raf.step() })
    expect(hook.result.current.sessionState?.currentNoteIndex).toBe(3)
  })
})

// ===========================================================================
// 4. Pitch evaluation -- correct note
// ===========================================================================

describe('pitch evaluation -- correct note', () => {
  it('grades pitchCorrect=true when processFrame receives the expected frequency', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Position within note 0 window (20ms after scheduled time)
    setCtxTime(transitionTime + 0.02)

    const correctFreq = SCALE_NOTES[0].frequency
    act(() => {
      hook.result.current.processFrame(makePitch(correctFreq))
    })

    // Advance past note 0 boundary so tick evaluates it
    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    const noteEvent = hook.result.current.sessionState?.noteEvents[0]
    expect(noteEvent?.pitchCorrect).toBe(true)
  })
})

// ===========================================================================
// 5. Pitch evaluation -- wrong note
// ===========================================================================

describe('pitch evaluation -- wrong note', () => {
  it('grades pitchCorrect=false when processFrame receives a wrong frequency', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    setCtxTime(transitionTime + 0.02)

    // Feed a wrong frequency (A4=440, expected is C2)
    act(() => {
      hook.result.current.processFrame(makePitch(440))
    })

    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    const noteEvent = hook.result.current.sessionState?.noteEvents[0]
    expect(noteEvent?.pitchCorrect).toBe(false)
  })
})

// ===========================================================================
// 6. Timing grading
// ===========================================================================

describe('timing grading', () => {
  const windows = computeTimingWindows(BPM)

  it('grades "perfect" when pitch arrives near the scheduled time', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // 5ms offset -> well within perfectMs (40ms at 120 BPM)
    setCtxTime(transitionTime + 0.005)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    expect(hook.result.current.sessionState?.noteEvents[0]?.timingResult).toBe('perfect')
  })

  it('grades "good" when pitch arrives within the good window', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Offset just past perfect but within good
    const offsetSec = (windows.perfectMs + 10) / 1000
    setCtxTime(transitionTime + offsetSec)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    expect(hook.result.current.sessionState?.noteEvents[0]?.timingResult).toBe('good')
  })

  it('grades "late" when pitch arrives within the late window', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Offset just past good but within late
    const offsetSec = (windows.goodMs + 10) / 1000
    setCtxTime(transitionTime + offsetSec)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    expect(hook.result.current.sessionState?.noteEvents[0]?.timingResult).toBe('late')
  })

  it('grades "missed" when no pitch is detected in the note window', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Advance past note 0 without sending any pitch
    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    const noteEvent = hook.result.current.sessionState?.noteEvents[0]
    expect(noteEvent?.timingResult).toBe('missed')
    expect(noteEvent?.pitchCorrect).toBe(false)
  })
})

// ===========================================================================
// 6b. Early note detection
// ===========================================================================

describe('early note detection', () => {
  it('penalizes a note played early — does not grade as perfect', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Note 0 = C2, Note 1 = D2
    // Play C2 on the beat (note 0 is correct)
    setCtxTime(transitionTime + 0.005)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    // Now play D2 early — 80ms before note 1's beat (0.5s).
    // At this point we're still in note 0's window.
    const earlyTime = transitionTime + 0.5 - 0.08 // 80ms before note 1
    setCtxTime(earlyTime)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[1].frequency))
    })

    // Advance past note 0 boundary → tick evaluates note 0, seeds note 1 with look-ahead
    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    // D2 sustains — fresh detection at +10ms into note 1's window
    setCtxTime(transitionTime + 0.51)
    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[1].frequency))
    })

    // Advance past note 1 boundary so tick evaluates it
    setCtxTime(transitionTime + 1.01)
    act(() => { raf.step() })

    const noteEvent = hook.result.current.sessionState?.noteEvents[1]
    expect(noteEvent?.pitchCorrect).toBe(true)
    // The timing should reflect the early attack (-80ms), not the sustain (~0ms).
    // |80ms| > perfectMs(40) so it should NOT be 'perfect'.
    expect(noteEvent?.timingResult).not.toBe('perfect')
    expect(noteEvent?.timingOffsetMs).toBeLessThan(0)
  })
})

// ===========================================================================
// 7. Live feedback fires immediately
// ===========================================================================

describe('live feedback fires immediately', () => {
  it('sets liveFeedback with correct noteIndex and pitchCorrect after processFrame', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    setCtxTime(transitionTime + 0.02)

    // Initially no live feedback
    expect(hook.result.current.sessionState?.liveFeedback).toBeNull()

    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    // Live feedback is set immediately (no tick needed)
    const feedback = hook.result.current.sessionState?.liveFeedback
    expect(feedback).not.toBeNull()
    expect(feedback?.noteIndex).toBe(0)
    expect(feedback?.pitchCorrect).toBe(true)
  })
})

// ===========================================================================
// 8. Live feedback matches final result
// ===========================================================================

describe('live feedback matches final result', () => {
  it('live feedback timing grade matches final noteEvent timing grade for a late pitch', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()
    const windows = computeTimingWindows(BPM)

    // Feed a pitch at an offset that falls in the "late" window
    const offsetSec = (windows.goodMs + 20) / 1000
    setCtxTime(transitionTime + offsetSec)

    act(() => {
      hook.result.current.processFrame(makePitch(SCALE_NOTES[0].frequency))
    })

    // Live feedback should show 'late' immediately
    const liveFeedback = hook.result.current.sessionState?.liveFeedback
    expect(liveFeedback).not.toBeNull()
    expect(liveFeedback?.timingResult).toBe('late')

    // Let the note window expire so the tick evaluates note 0
    setCtxTime(transitionTime + 0.51)
    act(() => { raf.step() })

    // Final noteEvent should agree with live feedback
    const noteEvent = hook.result.current.sessionState?.noteEvents[0]
    expect(noteEvent?.timingResult).toBe('late')
    expect(noteEvent?.pitchCorrect).toBe(liveFeedback?.pitchCorrect)
  })
})

// ===========================================================================
// 9. Multi-step sequence concatenation
// ===========================================================================

describe('multi-step sequence concatenation', () => {
  it('concatenates notes from all steps and tracks step boundaries', () => {
    const hook = renderRhythmHook()

    // 2-step sequence. Each step produces SCALE_NOTES (4 notes) via the mock.
    startSession(hook, { steps: 2 })

    // Total notes should be 4 + 4 = 8
    expect(hook.result.current.sessionState?.totalNotes).toBe(8)

    // rhythmState should have 2 step boundaries
    const boundaries = hook.result.current.rhythmState?.stepBoundaries
    expect(boundaries).toHaveLength(2)
    expect(boundaries?.[0].startNoteIndex).toBe(0)
    expect(boundaries?.[0].endNoteIndex).toBe(4)
    expect(boundaries?.[1].startNoteIndex).toBe(4)
    expect(boundaries?.[1].endNoteIndex).toBe(8)
  })
})

// ===========================================================================
// 10. Session ends after all notes
// ===========================================================================

describe('session ends after all notes', () => {
  it('transitions phase to stopped when all notes have been played', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    const transitionTime = completeCountdown()

    // Advance past all 4 notes (4 * 0.5s = 2.0s total)
    setCtxTime(transitionTime + 2.01)
    act(() => { raf.step() })

    expect(hook.result.current.sessionState?.phase).toBe('stopped')
  })
})

// ===========================================================================
// 11. Per-step result splitting
// ===========================================================================

describe('per-step result splitting', () => {
  it('produces one result per step with correct scorePercent after session ends', () => {
    const hook = renderRhythmHook()
    startSession(hook, { steps: 2 })
    const transitionTime = completeCountdown()

    // Feed correct pitches for all 8 notes with near-perfect timing.
    // The notes repeat: C2, D2, E2, F2, C2, D2, E2, F2
    // Between each note, we must step the RAF to advance currentNoteIndex,
    // because processFrame always records samples for the current note.
    const totalNotes = 8
    for (let i = 0; i < totalNotes; i++) {
      const noteFreq = SCALE_NOTES[i % SCALE_NOTES.length].frequency
      const noteScheduled = transitionTime + i * BEAT_DURATION

      // 10ms after scheduled time (well within perfectMs)
      setCtxTime(noteScheduled + 0.01)
      act(() => {
        hook.result.current.processFrame(makePitch(noteFreq))
      })

      // Advance past this note boundary so the tick evaluates it
      // and moves to the next note (except after the last note)
      if (i < totalNotes - 1) {
        setCtxTime(noteScheduled + BEAT_DURATION + 0.001)
        act(() => { raf.step() })
      }
    }

    // Advance past the last note to trigger session completion
    setCtxTime(transitionTime + totalNotes * BEAT_DURATION + 0.01)
    act(() => { raf.step() })

    expect(hook.result.current.sessionState?.phase).toBe('stopped')

    const results = hook.result.current.rhythmState?.results
    expect(results).toHaveLength(2)

    // Each step: 4 notes, all pitchCorrect + perfect timing
    // scoreNote(true, 'perfect') = 10 per note -> 40/40 = 100%
    for (const result of results!) {
      expect(result.noteEvents).toHaveLength(4)
      expect(result.scorePercent).toBe(100)
    }
  })
})

// ===========================================================================
// 12. Stop during practice
// ===========================================================================

describe('stop during practice', () => {
  it('sets phase to stopped, cancels RAF, and unsubscribes beat listeners', () => {
    const hook = renderRhythmHook()
    startSession(hook)
    completeCountdown()

    expect(hook.result.current.sessionState?.phase).toBe('playing')

    act(() => {
      hook.result.current.stopRhythm()
    })

    expect(hook.result.current.sessionState?.phase).toBe('stopped')

    // After stop, firing a beat should not cause any state changes
    act(() => {
      fireBeat(99, 99.0)
    })
    expect(hook.result.current.sessionState?.phase).toBe('stopped')

    // RAF should be stopped -- advancing time and stepping should not
    // change the note index
    const noteIndexAfterStop = hook.result.current.sessionState?.currentNoteIndex
    mockCtx.advanceTime(5.0)
    act(() => { raf.step() })
    expect(hook.result.current.sessionState?.currentNoteIndex).toBe(noteIndexAfterStop)
  })
})
