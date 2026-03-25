/**
 * Integration tests for the arpeggio practice flow.
 *
 * Tests the useArpeggioPractice hook which orchestrates:
 *   - usePracticeSession (WASM session wrapper)
 *   - buildArpeggioNotes (arpeggio note construction)
 *   - Transition timers between arpeggios
 *   - Cumulative stats aggregation
 *
 * WASM dependencies are mocked at the module level. The TypedPracticeSession
 * class is replaced with a controllable fake that lets us simulate note-by-note
 * progression through an arpeggio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { makeNote, makePitch } from '../../__test-utils__/helpers.ts'
import type { Note, SessionState, SessionScore } from '@core/wasm/types.ts'
import type { ArpeggioSequence, ArpeggioStep } from '@core/arpeggio/types.ts'

// ---------------------------------------------------------------------------
// Mock state shared across vi.mock factory closures
// ---------------------------------------------------------------------------

/** Notes returned by buildArpeggioNotes mock */
let mockArpeggioNotes: Note[] = []

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

    session._holdCount += 1

    if (session._holdCount >= session._config.minHoldDetections) {
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
  noteFromName: vi.fn((name: string) => {
    const match = name.match(/^([A-G][#b]?)(\d+)$/)
    if (!match) return { name, pitchClass: name, octave: 0, midi: 0, frequency: 0 }
    return makeNote(match[1], parseInt(match[2]))
  }),
  noteFromMidi: vi.fn((midi: number) => {
    const octave = Math.floor(midi / 12) - 1
    const pitchClass = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12]
    return makeNote(pitchClass, octave, midi)
  }),
}))

vi.mock('@core/wasm/scales.ts', () => ({
  buildScale: vi.fn((): Note[] => []),
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

vi.mock('@core/music/arpeggioBuilder.ts', () => ({
  buildArpeggioNotes: vi.fn(() => ({ notes: mockArpeggioNotes, octaveShift: 0 })),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks are declared)
// ---------------------------------------------------------------------------

import { useArpeggioPractice } from '../useArpeggioPractice.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard arpeggio notes for tests: C Major triad (3 notes) */
const C_MAJOR_ARPEGGIO = [
  makeNote('C', 2),
  makeNote('E', 2),
  makeNote('G', 2),
]

/** Build a test ArpeggioSequence with sensible defaults */
function makeTestArpeggioSequence(options?: {
  steps?: number
  skipTransition?: boolean
  shiftSemitones?: number
}): ArpeggioSequence {
  const stepCount = options?.steps ?? 1
  const steps: ArpeggioStep[] = Array.from({ length: stepCount }, (_, i) => ({
    root: 'C',
    rootOctave: 2,
    arpeggioType: 'Major' as const,
    label: `Arp ${i + 1}`,
  }))

  return {
    id: 'test-arpeggio-seq',
    name: 'Test Arpeggio Sequence',
    description: 'A test arpeggio sequence',
    steps,
    direction: 'ascending',
    skipTransition: options?.skipTransition ?? false,
    shiftSemitones: options?.shiftSemitones ?? 0,
  }
}

/**
 * Feed processArpeggioFrame enough times to complete the entire current arpeggio.
 * Each note needs `minHoldDetections` correct frames to advance.
 */
function playEntireArpeggio(
  result: { current: ReturnType<typeof useArpeggioPractice> },
  noteCount: number,
  minHoldDetections: number,
) {
  const totalFrames = noteCount * minHoldDetections
  for (let i = 0; i < totalFrames; i++) {
    act(() => {
      result.current.processArpeggioFrame(makePitch(130.81))
    })
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useArpeggioPractice — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockArpeggioNotes = [...C_MAJOR_ARPEGGIO]
    activeMockSession = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. Starting a session
  // =========================================================================

  describe('starting a session', () => {
    it('sets phase to playing with correct initial state', () => {
      const sequence = makeTestArpeggioSequence({ steps: 3 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(result.current.arpeggioState).not.toBeNull()
      expect(result.current.arpeggioState!.phase).toBe('playing')
      expect(result.current.arpeggioState!.currentStepIndex).toBe(0)
      expect(result.current.arpeggioState!.currentNotes).toHaveLength(
        C_MAJOR_ARPEGGIO.length,
      )
      expect(result.current.arpeggioState!.completedLoops).toBe(0)
      expect(result.current.arpeggioState!.results).toHaveLength(0)
    })

    it('inner session starts in Playing phase', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(result.current.sessionState).not.toBeNull()
      expect(result.current.sessionState!.phase).toBe('Playing')
    })

    it('arpeggioState is null before starting any session', () => {
      const { result } = renderHook(() => useArpeggioPractice())
      expect(result.current.arpeggioState).toBeNull()
    })
  })

  // =========================================================================
  // 2. Processing frames
  // =========================================================================

  describe('processing frames', () => {
    it('advances after minHoldDetections correct frames', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      // First two frames should not advance
      act(() => {
        result.current.processArpeggioFrame(makePitch(130.81))
      })
      expect(result.current.sessionState!.currentNoteIndex).toBe(0)

      act(() => {
        result.current.processArpeggioFrame(makePitch(130.81))
      })
      expect(result.current.sessionState!.currentNoteIndex).toBe(0)

      // Third frame (minHoldDetections=3) should advance
      act(() => {
        result.current.processArpeggioFrame(makePitch(130.81))
      })
      expect(result.current.sessionState!.currentNoteIndex).toBe(1)
    })

    it('hold count resets after a note is accepted', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      // Play through first note (3 frames)
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.processArpeggioFrame(makePitch(130.81))
        })
      }

      expect(result.current.sessionState!.currentHoldCount).toBe(0)
      expect(result.current.sessionState!.currentNoteIndex).toBe(1)
    })
  })

  // =========================================================================
  // 3. Sequential enforcement
  // =========================================================================

  describe('sequential enforcement', () => {
    it('passes ignoreOctave config to the inner session', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(activeMockSession).not.toBeNull()
      expect(activeMockSession!._config).not.toBeNull()
      expect(activeMockSession!._config!.ignoreOctave).toBe(true)
    })

    it('passes ignoreOctave=false through to the inner session', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, false)
      })

      expect(activeMockSession!._config!.ignoreOctave).toBe(false)
    })

    it('passes correct arpeggio notes to the inner session', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(activeMockSession!._config!.scaleNotes).toEqual(C_MAJOR_ARPEGGIO)
    })
  })

  // =========================================================================
  // 4. Arpeggio completion and auto-transition
  // =========================================================================

  describe('arpeggio completion', () => {
    it('captures a result with correct score when arpeggio finishes', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      expect(result.current.arpeggioState!.results).toHaveLength(1)

      const capturedResult = result.current.arpeggioState!.results[0]
      expect(capturedResult.score.totalNotes).toBe(C_MAJOR_ARPEGGIO.length)
      expect(capturedResult.score.correctNotes).toBe(C_MAJOR_ARPEGGIO.length)
      expect(capturedResult.score.accuracyPercent).toBe(100)
    })

    it('result contains the step info and label', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      const capturedResult = result.current.arpeggioState!.results[0]
      expect(capturedResult.step.root).toBe('C')
      expect(capturedResult.step.arpeggioType).toBe('Major')
      expect(capturedResult.label).toBeTruthy()
    })
  })

  // =========================================================================
  // 5. Transitions between arpeggios
  // =========================================================================

  describe('transitions between arpeggios', () => {
    it('advances to the next arpeggio immediately with skipTransition', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      expect(result.current.arpeggioState!.phase).toBe('playing')
      expect(result.current.arpeggioState!.currentStepIndex).toBe(1)
    })

    it('starts a new inner session for the next arpeggio with skipTransition', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      expect(result.current.sessionState!.phase).toBe('Playing')
      expect(result.current.sessionState!.currentNoteIndex).toBe(0)
    })

    it('uses a 2-second transition timer without skipTransition', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      // After completion, step index advances to preview next
      expect(result.current.arpeggioState!.currentStepIndex).toBe(1)

      // After 2 seconds, inner session should restart for next arpeggio
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.arpeggioState!.phase).toBe('playing')
      expect(result.current.sessionState!.phase).toBe('Playing')
      expect(result.current.sessionState!.currentNoteIndex).toBe(0)
    })
  })

  // =========================================================================
  // 6. Cumulative stats
  // =========================================================================

  describe('cumulative stats', () => {
    it('starts with zeroed cumulative stats', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      const stats = result.current.arpeggioState!.cumulativeStats
      expect(stats.totalArpeggiosCompleted).toBe(0)
      expect(stats.totalNotesAttempted).toBe(0)
      expect(stats.totalCorrect).toBe(0)
      expect(stats.overallAccuracyPercent).toBe(0)
    })

    it('aggregates correctly after completing one arpeggio', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      const stats = result.current.arpeggioState!.cumulativeStats
      expect(stats.totalArpeggiosCompleted).toBe(1)
      expect(stats.totalNotesAttempted).toBe(C_MAJOR_ARPEGGIO.length)
      expect(stats.totalCorrect).toBe(C_MAJOR_ARPEGGIO.length)
      expect(stats.overallAccuracyPercent).toBe(100)
    })

    it('aggregates correctly after completing two arpeggios', () => {
      const sequence = makeTestArpeggioSequence({ steps: 3, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)
      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      const stats = result.current.arpeggioState!.cumulativeStats
      expect(stats.totalArpeggiosCompleted).toBe(2)
      expect(stats.totalNotesAttempted).toBe(C_MAJOR_ARPEGGIO.length * 2)
      expect(stats.totalCorrect).toBe(C_MAJOR_ARPEGGIO.length * 2)
      expect(stats.overallAccuracyPercent).toBe(100)
    })

    it('computes weighted average cents offset', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      // Mock getScore returns averageCentsOffset = 5
      const stats = result.current.arpeggioState!.cumulativeStats
      expect(stats.averageCentsOffset).toBe(5)
    })
  })

  // =========================================================================
  // 7. Stopping
  // =========================================================================

  describe('stopping', () => {
    it('sets phase to stopped', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      act(() => {
        result.current.processArpeggioFrame(makePitch(130.81))
      })

      act(() => {
        result.current.stopArpeggio()
      })

      expect(result.current.arpeggioState!.phase).toBe('stopped')
    })

    it('resets inner session state', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      act(() => {
        result.current.stopArpeggio()
      })

      expect(result.current.sessionState).toBeNull()
    })

    it('stopping during transition clears the timer', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: false })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)

      // Stop while in transition
      act(() => {
        result.current.stopArpeggio()
      })

      expect(result.current.arpeggioState!.phase).toBe('stopped')

      // Advancing timers should NOT restart a session
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.arpeggioState!.phase).toBe('stopped')
    })
  })

  // =========================================================================
  // 8. Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('wraps around to step 0 after completing all steps in the sequence', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      // Complete both arpeggios
      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3) // step 0 -> step 1
      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3) // step 1 -> wraps to step 0

      expect(result.current.arpeggioState!.currentStepIndex).toBe(0)
      expect(result.current.arpeggioState!.completedLoops).toBe(1)
    })

    it('skipArpeggio advances without requiring hold detections', () => {
      const sequence = makeTestArpeggioSequence({ steps: 1 })
      const { result } = renderHook(() => useArpeggioPractice())

      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(result.current.sessionState!.currentNoteIndex).toBe(0)

      act(() => {
        result.current.skipArpeggio()
      })

      expect(result.current.sessionState!.currentNoteIndex).toBe(1)
    })

    it('starting a new session clears previous results and state', () => {
      const sequence = makeTestArpeggioSequence({ steps: 2, skipTransition: true })
      const { result } = renderHook(() => useArpeggioPractice())

      // First session
      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })
      playEntireArpeggio(result, C_MAJOR_ARPEGGIO.length, 3)
      expect(result.current.arpeggioState!.results).toHaveLength(1)

      // Start a new session — should reset
      act(() => {
        result.current.startArpeggio(sequence, 40, 3, true)
      })

      expect(result.current.arpeggioState!.results).toHaveLength(0)
      expect(result.current.arpeggioState!.currentStepIndex).toBe(0)
      expect(result.current.arpeggioState!.phase).toBe('playing')
    })

    it('processArpeggioFrame is safe to call when no session is active', () => {
      const { result } = renderHook(() => useArpeggioPractice())

      // Should not throw
      act(() => {
        result.current.processArpeggioFrame(makePitch(130.81))
      })

      expect(result.current.arpeggioState).toBeNull()
    })
  })
})
