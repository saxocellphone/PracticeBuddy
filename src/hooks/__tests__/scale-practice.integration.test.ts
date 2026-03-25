/**
 * Integration tests for the scale practice flow.
 *
 * Tests the useScalePractice hook which orchestrates:
 *   - usePracticeSession (WASM session wrapper)
 *   - buildScaleNotes (scale construction)
 *   - Transition timers between scales
 *   - Cumulative stats aggregation
 *
 * WASM dependencies are mocked at the module level. The TypedPracticeSession
 * class is replaced with a controllable fake that lets us simulate note-by-note
 * progression through a scale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { makeNote, makeTestSequence, makePitch } from '../../__test-utils__/helpers.ts'
import type { Note, SessionState, SessionScore } from '@core/wasm/types.ts'

// ---------------------------------------------------------------------------
// Mock state shared across vi.mock factory closures
// ---------------------------------------------------------------------------

let mockScaleNotes: Note[] = []

/** Tracks the most recently created mock session so tests can control it */
let activeMockSession: MockSession | null = null

// ---------------------------------------------------------------------------
// Mock session class — replaces TypedPracticeSession
// ---------------------------------------------------------------------------

interface MockSessionConfig {
  scaleNotes: Note[]
  minHoldDetections: number
  ignoreOctave: boolean
}

interface MockSession {
  start: ReturnType<typeof vi.fn<(config: MockSessionConfig) => SessionState>>
  processFrame: ReturnType<typeof vi.fn<(freq: number, clarity: number) => SessionState>>
  skipNote: ReturnType<typeof vi.fn<() => SessionState>>
  getState: ReturnType<typeof vi.fn<() => SessionState>>
  getScore: ReturnType<typeof vi.fn<() => SessionScore>>
  reset: ReturnType<typeof vi.fn<() => void>>
  free: ReturnType<typeof vi.fn<() => void>>
  /** Internal state for driving the mock through note progression */
  _config: MockSessionConfig | null
  _noteIndex: number
  _holdCount: number
  _phase: 'Idle' | 'Playing' | 'Complete'
  _correctCount: number
  _incorrectCount: number
}

function createMockSession(): MockSession {
  const session: MockSession = {
    _config: null,
    _noteIndex: 0,
    _holdCount: 0,
    _phase: 'Idle',
    _correctCount: 0,
    _incorrectCount: 0,

    start: vi.fn(),
    processFrame: vi.fn(),
    skipNote: vi.fn(),
    getState: vi.fn(),
    getScore: vi.fn(),
    reset: vi.fn(),
    free: vi.fn(),
  }

  // Implement mock methods with access to session state via closure
  session.start.mockImplementation((config: MockSessionConfig): SessionState => {
    session._config = config
    session._noteIndex = 0
    session._holdCount = 0
    session._phase = 'Playing'
    session._correctCount = 0
    session._incorrectCount = 0
    return makeSessionState(session)
  })

  session.processFrame.mockImplementation((): SessionState => {
    if (session._phase !== 'Playing' || !session._config) return makeSessionState(session)

    // Simulate: every call is a correct detection, increment hold count
    session._holdCount += 1

    if (session._holdCount >= session._config.minHoldDetections) {
      // Note accepted
      session._correctCount += 1
      session._noteIndex += 1
      session._holdCount = 0

      if (session._noteIndex >= session._config.scaleNotes.length) {
        session._phase = 'Complete'
      }
    }

    return makeSessionState(session)
  })

  session.skipNote.mockImplementation((): SessionState => {
    if (session._phase !== 'Playing' || !session._config) return makeSessionState(session)

    session._noteIndex += 1
    session._holdCount = 0

    if (session._noteIndex >= session._config.scaleNotes.length) {
      session._phase = 'Complete'
    }

    return makeSessionState(session)
  })

  session.getState.mockImplementation((): SessionState => {
    return makeSessionState(session)
  })

  session.getScore.mockImplementation((): SessionScore => {
    const totalNotes = session._config?.scaleNotes.length ?? 0
    const missedNotes = totalNotes - session._correctCount - session._incorrectCount
    return {
      totalNotes,
      correctNotes: session._correctCount,
      incorrectNotes: session._incorrectCount,
      missedNotes: Math.max(0, missedNotes),
      accuracyPercent:
        totalNotes > 0 ? (session._correctCount / totalNotes) * 100 : 0,
      averageCentsOffset: 5,
      noteResults: [],
    }
  })

  activeMockSession = session
  return session
}

function makeSessionState(session: MockSession): SessionState {
  const totalNotes = session._config?.scaleNotes.length ?? 0
  return {
    phase: session._phase,
    currentNoteIndex: session._noteIndex,
    totalNotes,
    currentHoldCount: session._holdCount,
    minHoldDetections: session._config?.minHoldDetections ?? 3,
    lastResult: null,
    correctCount: session._correctCount,
    incorrectCount: session._incorrectCount,
  }
}

// ---------------------------------------------------------------------------
// vi.mock declarations (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock('@core/wasm/noteUtils.ts', () => ({
  frequencyToNote: vi.fn(),
  midiToFrequency: vi.fn(),
  frequencyToMidi: vi.fn(),
  centsDistance: vi.fn(),
  noteFromName: vi.fn(),
  noteFromMidi: vi.fn(),
}))

vi.mock('@core/wasm/scales.ts', () => ({
  buildScale: vi.fn((): Note[] => mockScaleNotes),
  getScaleType: vi.fn(() => ({})),
  listScaleTypes: vi.fn(() => []),
}))

vi.mock('@core/wasm/init.ts', () => ({
  initWasm: vi.fn(async () => ({})),
  getWasm: vi.fn(() => ({})),
}))

vi.mock('@core/wasm/session.ts', () => {
  return {
    TypedPracticeSession: class MockTypedPracticeSession {
      private delegate: MockSession
      constructor() {
        this.delegate = createMockSession()
      }
      start(config: MockSessionConfig) { return this.delegate.start(config) }
      processFrame(freq: number, clarity: number) { return this.delegate.processFrame(freq, clarity) }
      skipNote() { return this.delegate.skipNote() }
      getState() { return this.delegate.getState() }
      getScore() { return this.delegate.getScore() }
      reset() { return this.delegate.reset() }
      free() { return this.delegate.free() }
    },
  }
})

vi.mock('@core/wasm/validation.ts', () => ({
  validateNote: vi.fn(),
}))

vi.mock('@core/wasm/pitchDetector.ts', () => ({
  TypedPitchDetector: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks are declared)
// ---------------------------------------------------------------------------

import { useScalePractice } from '../useScalePractice.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard scale notes for tests: C major scale in octave 2 (8 notes) */
const C_MAJOR_NOTES = [
  makeNote('C', 2),
  makeNote('D', 2),
  makeNote('E', 2),
  makeNote('F', 2),
  makeNote('G', 2),
  makeNote('A', 2),
  makeNote('B', 2),
  makeNote('C', 3),
]

/**
 * Feed processFrame enough times to complete the entire current scale.
 * Each note needs `minHoldDetections` correct frames to advance.
 */
function playEntireScale(
  result: { current: ReturnType<typeof useScalePractice> },
  noteCount: number,
  minHoldDetections: number,
) {
  const totalFrames = noteCount * minHoldDetections
  for (let i = 0; i < totalFrames; i++) {
    act(() => {
      result.current.processFrame(makePitch(130.81)) // frequency doesn't matter — mock always accepts
    })
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useScalePractice — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockScaleNotes = [...C_MAJOR_NOTES]
    activeMockSession = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. Start scale session
  // =========================================================================

  describe('starting a session', () => {
    it('sets phase to playing with correct initial state', () => {
      const sequence = makeTestSequence({ steps: 3 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      expect(result.current.scaleState).not.toBeNull()
      expect(result.current.scaleState!.phase).toBe('playing')
      expect(result.current.scaleState!.currentStepIndex).toBe(0)
      expect(result.current.scaleState!.currentScaleNotes).toHaveLength(
        C_MAJOR_NOTES.length,
      )
      expect(result.current.scaleState!.completedLoops).toBe(0)
      expect(result.current.scaleState!.results).toHaveLength(0)
    })

    it('populates currentLabel from the first step', () => {
      const sequence = makeTestSequence({ steps: 2 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // makeTestSequence generates steps with label "Step N", ignoreOctave strips digits
      expect(result.current.scaleState!.currentLabel).toBe('Step')
    })

    it('populates nextLabel from the second step', () => {
      const sequence = makeTestSequence({ steps: 2 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Second step label "Step 2" with ignoreOctave strips digits
      expect(result.current.scaleState!.nextLabel).toBe('Step')
    })

    it('inner session starts in Playing phase', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      expect(result.current.innerSessionState).not.toBeNull()
      expect(result.current.innerSessionState!.phase).toBe('Playing')
    })
  })

  // =========================================================================
  // 2. Process frame with correct pitch
  // =========================================================================

  describe('processing frames', () => {
    it('advances after minHoldDetections correct frames', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // First two frames should not yet advance the note
      act(() => {
        result.current.processFrame(makePitch(130.81))
      })
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)

      act(() => {
        result.current.processFrame(makePitch(130.81))
      })
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)

      // Third frame (minHoldDetections=3) should advance
      act(() => {
        result.current.processFrame(makePitch(130.81))
      })
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(1)
    })

    it('hold count resets after a note is accepted', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Play through first note (3 frames)
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.processFrame(makePitch(130.81))
        })
      }

      // After accepting first note, hold count should be 0 for next note
      expect(result.current.innerSessionState!.currentHoldCount).toBe(0)
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(1)
    })
  })

  // =========================================================================
  // 3. Scale completion triggers result capture (individual mode)
  // =========================================================================

  describe('scale completion', () => {
    it('captures a result with correct score when scale finishes', () => {
      // Use skipTransition=false so each step is individual
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Play through all notes of the first scale
      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // After the scale completes, the effect fires and captures a result.
      expect(result.current.scaleState!.results).toHaveLength(1)

      const capturedResult = result.current.scaleState!.results[0]
      expect(capturedResult.score.totalNotes).toBe(C_MAJOR_NOTES.length)
      expect(capturedResult.score.correctNotes).toBe(C_MAJOR_NOTES.length)
      expect(capturedResult.score.accuracyPercent).toBe(100)
    })

    it('result contains the step info and label', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      const capturedResult = result.current.scaleState!.results[0]
      expect(capturedResult.step.rootNote).toBe('C')
      expect(capturedResult.step.scaleTypeIndex).toBe(0)
      expect(capturedResult.label).toBeTruthy()
    })
  })

  // =========================================================================
  // 4. Transition between scales (skipTransition=false)
  // =========================================================================

  describe('transitions between scales', () => {
    it('immediately advances to playing the next step after scale completes', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      expect(result.current.scaleState!.phase).toBe('playing')
    })

    it('advances currentStepIndex during transition to preview next scale', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // During transition, the state shows the upcoming step
      expect(result.current.scaleState!.currentStepIndex).toBe(1)
    })

    it('immediately enters playing phase with next step after scale completes', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      expect(result.current.scaleState!.phase).toBe('playing')
      expect(result.current.scaleState!.currentStepIndex).toBe(1)
    })

    it('starts a new inner session immediately after scale completes', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // A new inner session should have been started for scale 2 immediately
      expect(result.current.innerSessionState!.phase).toBe('Playing')
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)
    })
  })

  // =========================================================================
  // 5. Combined mode (skipTransition=true with multiple steps)
  // =========================================================================

  describe('combined mode (skipTransition with multiple steps)', () => {
    it('combines all step notes into a single session', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Combined mode: 2 steps x 8 notes = 16 total notes in one session
      expect(result.current.scaleState!.currentScaleNotes).toHaveLength(
        C_MAJOR_NOTES.length * 2,
      )
      expect(result.current.innerSessionState!.totalNotes).toBe(
        C_MAJOR_NOTES.length * 2,
      )
    })

    it('shows sequence name as combined label', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      expect(result.current.scaleState!.currentLabel).toBe('Test Sequence')
    })

    it('captures result after completing all combined notes', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Play all combined notes (2 steps x 8 notes)
      playEntireScale(result, C_MAJOR_NOTES.length * 2, 3)

      expect(result.current.scaleState!.results).toHaveLength(1)
      expect(result.current.scaleState!.results[0].score.totalNotes).toBe(
        C_MAJOR_NOTES.length * 2,
      )
    })

    it('immediately restarts after completing combined loop', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length * 2, 3)

      // Combined mode immediately starts the next loop
      expect(result.current.scaleState!.phase).toBe('playing')
      expect(result.current.scaleState!.completedLoops).toBe(1)
    })

    it('starts next combined loop immediately after completing', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length * 2, 3)

      expect(result.current.scaleState!.phase).toBe('playing')
      expect(result.current.scaleState!.completedLoops).toBe(1)
      expect(result.current.innerSessionState!.phase).toBe('Playing')
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)
    })
  })

  // =========================================================================
  // 5b. Skip transition for single-step sequences
  // =========================================================================

  describe('skipTransition with single step', () => {
    it('goes directly to playing the next loop without transitioning', () => {
      const sequence = makeTestSequence({ steps: 1, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // Single-step skipTransition skips the transition screen
      expect(result.current.scaleState!.phase).toBe('playing')
    })

    it('starts the inner session for the next loop immediately', () => {
      const sequence = makeTestSequence({ steps: 1, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      expect(result.current.innerSessionState!.phase).toBe('Playing')
      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)
    })
  })

  // =========================================================================
  // 6. Stop during practice
  // =========================================================================

  describe('stopping during practice', () => {
    it('sets phase to stopped', () => {
      const sequence = makeTestSequence({ steps: 2 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Play a few frames but don't finish
      act(() => {
        result.current.processFrame(makePitch(130.81))
      })

      act(() => {
        result.current.stopScalePractice()
      })

      expect(result.current.scaleState!.phase).toBe('stopped')
    })

    it('resets inner session state', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      act(() => {
        result.current.stopScalePractice()
      })

      // Inner session should be reset (usePracticeSession.resetSession sets state to null)
      expect(result.current.innerSessionState).toBeNull()
    })
  })

  // =========================================================================
  // 7. Stop during transition
  // =========================================================================

  describe('stopping after scale completion', () => {
    it('sets phase to stopped when stopping after a scale completes', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Complete the first scale — immediately advances to next step
      playEntireScale(result, C_MAJOR_NOTES.length, 3)
      expect(result.current.scaleState!.phase).toBe('playing')

      // Stop during the next step
      act(() => {
        result.current.stopScalePractice()
      })

      expect(result.current.scaleState!.phase).toBe('stopped')
    })
  })

  // =========================================================================
  // 8. Cumulative stats
  // =========================================================================

  describe('cumulative stats', () => {
    it('starts with zeroed cumulative stats', () => {
      const sequence = makeTestSequence({ steps: 2 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      const stats = result.current.scaleState!.cumulativeStats
      expect(stats.totalScalesCompleted).toBe(0)
      expect(stats.totalNotesAttempted).toBe(0)
      expect(stats.totalCorrect).toBe(0)
      expect(stats.overallAccuracyPercent).toBe(0)
    })

    it('aggregates correctly after completing one scale (individual mode)', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      const stats = result.current.scaleState!.cumulativeStats
      expect(stats.totalScalesCompleted).toBe(1)
      expect(stats.totalNotesAttempted).toBe(C_MAJOR_NOTES.length)
      expect(stats.totalCorrect).toBe(C_MAJOR_NOTES.length)
      expect(stats.overallAccuracyPercent).toBe(100)
    })

    it('aggregates correctly after completing two scales (individual mode)', () => {
      const sequence = makeTestSequence({ steps: 3, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Complete scale 1 — immediately advances to scale 2
      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // Complete scale 2
      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      const stats = result.current.scaleState!.cumulativeStats
      expect(stats.totalScalesCompleted).toBe(2)
      expect(stats.totalNotesAttempted).toBe(C_MAJOR_NOTES.length * 2)
      expect(stats.totalCorrect).toBe(C_MAJOR_NOTES.length * 2)
      expect(stats.overallAccuracyPercent).toBe(100)
    })

    it('computes weighted average cents offset', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      // Our mock getScore returns averageCentsOffset = 5
      const stats = result.current.scaleState!.cumulativeStats
      expect(stats.averageCentsOffset).toBe(5)
    })

    it('aggregates stats in combined mode after completing full loop', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Play all combined notes (2 steps x 8 notes)
      playEntireScale(result, C_MAJOR_NOTES.length * 2, 3)

      const stats = result.current.scaleState!.cumulativeStats
      expect(stats.totalScalesCompleted).toBe(1)
      expect(stats.totalNotesAttempted).toBe(C_MAJOR_NOTES.length * 2)
      expect(stats.totalCorrect).toBe(C_MAJOR_NOTES.length * 2)
      expect(stats.overallAccuracyPercent).toBe(100)
    })
  })

  // =========================================================================
  // 9. ignoreOctave mode
  // =========================================================================

  describe('ignoreOctave configuration', () => {
    it('passes ignoreOctave=true through to the inner session', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Verify the mock session received the config with ignoreOctave
      expect(activeMockSession).not.toBeNull()
      expect(activeMockSession!._config).not.toBeNull()
      expect(activeMockSession!._config!.ignoreOctave).toBe(true)
    })

    it('passes ignoreOctave=false through to the inner session', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, false)
      })

      expect(activeMockSession!._config).not.toBeNull()
      expect(activeMockSession!._config!.ignoreOctave).toBe(false)
    })

    it('strips octave digits from labels when ignoreOctave is true', () => {
      // Create a sequence where step labels include octave numbers
      const sequence = makeTestSequence({ steps: 1 })
      // makeTestSequence steps have label "Step 1" — the "1" is stripped
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // "Step 1" with digits stripped becomes "Step"
      expect(result.current.scaleState!.currentLabel).toBe('Step')
    })

    it('preserves octave digits in labels when ignoreOctave is false', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, false)
      })

      // "Step 1" is preserved as-is
      expect(result.current.scaleState!.currentLabel).toBe('Step 1')
    })
  })

  // =========================================================================
  // Additional edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('wraps around to step 0 after completing all steps (individual mode)', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      // Complete step 0 -> immediately advances to step 1
      playEntireScale(result, C_MAJOR_NOTES.length, 3)
      // Complete step 1 -> wraps to step 0
      playEntireScale(result, C_MAJOR_NOTES.length, 3)

      expect(result.current.scaleState!.currentStepIndex).toBe(0)
      expect(result.current.scaleState!.completedLoops).toBe(1)
    })

    it('skipNote advances without requiring hold detections', () => {
      const sequence = makeTestSequence({ steps: 1 })
      const { result } = renderHook(() => useScalePractice())

      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      expect(result.current.innerSessionState!.currentNoteIndex).toBe(0)

      act(() => {
        result.current.skipNote()
      })

      expect(result.current.innerSessionState!.currentNoteIndex).toBe(1)
    })

    it('starting a new session clears previous results and state', () => {
      const sequence = makeTestSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useScalePractice())

      // First session
      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })
      playEntireScale(result, C_MAJOR_NOTES.length, 3)
      expect(result.current.scaleState!.results).toHaveLength(1)

      // Start a new session — should reset
      act(() => {
        result.current.startScalePractice(sequence, 40, 3, true)
      })

      expect(result.current.scaleState!.results).toHaveLength(0)
      expect(result.current.scaleState!.currentStepIndex).toBe(0)
      expect(result.current.scaleState!.phase).toBe('playing')
    })

    it('scaleState is null before starting any session', () => {
      const { result } = renderHook(() => useScalePractice())
      expect(result.current.scaleState).toBeNull()
    })

    it('processFrame is safe to call when no session is active', () => {
      const { result } = renderHook(() => useScalePractice())

      // Should not throw
      act(() => {
        result.current.processFrame(makePitch(130.81))
      })

      expect(result.current.scaleState).toBeNull()
    })
  })
})
