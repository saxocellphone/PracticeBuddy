import { useState, useRef, useCallback, useEffect } from 'react'
import { usePracticeSession } from './usePracticeSession.ts'
import { getArpeggioStepLabel } from '@core/arpeggio/presets.ts'
import { transpose } from '@core/endless/presets.ts'
import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'
import type { DetectedPitch } from '@core/wasm/types.ts'
import type {
  ArpeggioSequence,
  ArpeggioSessionState,
  ArpeggioRunResult,
  CumulativeArpeggioStats,
} from '@core/arpeggio/types.ts'

const TRANSITION_DURATION_MS = 2000

function computeCumulativeStats(results: ArpeggioRunResult[]): CumulativeArpeggioStats {
  const totalArpeggiosCompleted = results.length
  const totalNotesAttempted = results.reduce((sum, r) => sum + r.score.totalNotes, 0)
  const totalCorrect = results.reduce((sum, r) => sum + r.score.correctNotes, 0)
  const totalIncorrect = results.reduce((sum, r) => sum + r.score.incorrectNotes, 0)
  const totalMissed = results.reduce((sum, r) => sum + r.score.missedNotes, 0)
  const overallAccuracyPercent =
    totalNotesAttempted > 0 ? (totalCorrect / totalNotesAttempted) * 100 : 0
  const weightedCentsSum = results.reduce(
    (sum, r) => sum + r.score.averageCentsOffset * r.score.correctNotes,
    0
  )
  const averageCentsOffset = totalCorrect > 0 ? weightedCentsSum / totalCorrect : 0

  return {
    totalArpeggiosCompleted,
    totalNotesAttempted,
    totalCorrect,
    totalIncorrect,
    totalMissed,
    overallAccuracyPercent,
    averageCentsOffset,
  }
}

const EMPTY_STATS: CumulativeArpeggioStats = {
  totalArpeggiosCompleted: 0,
  totalNotesAttempted: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalMissed: 0,
  overallAccuracyPercent: 0,
  averageCentsOffset: 0,
}

export function useArpeggioPractice() {
  const {
    sessionState: innerSessionState,
    score: innerScore,
    startSession,
    processFrame: sessionProcessFrame,
    skipNote: sessionSkipNote,
    resetSession,
  } = usePracticeSession()

  const [arpeggioState, setArpeggioState] = useState<ArpeggioSessionState | null>(null)

  const sequenceRef = useRef<ArpeggioSequence | null>(null)
  const originalSequenceRef = useRef<ArpeggioSequence | null>(null)
  const configRef = useRef<{ centsTolerance: number; minHoldDetections: number; ignoreOctave: boolean }>({
    centsTolerance: 40,
    minHoldDetections: 3,
    ignoreOctave: true,
  })
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)
  const resultsRef = useRef<ArpeggioRunResult[]>([])
  const stepIndexRef = useRef(0)
  const loopsRef = useRef(0)
  const scoreCapturedRef = useRef(false)

  const startArpeggio = useCallback(
    (
      sequence: ArpeggioSequence,
      centsTolerance: number,
      minHoldDetections: number,
      ignoreOctave: boolean = true,
    ) => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }

      sequenceRef.current = sequence
      originalSequenceRef.current = sequence
      configRef.current = { centsTolerance, minHoldDetections, ignoreOctave }
      stoppedRef.current = false
      resultsRef.current = []
      stepIndexRef.current = 0
      loopsRef.current = 0
      scoreCapturedRef.current = false

      const step = sequence.steps[0]
      const numOctaves = sequence.numOctaves ?? 1
      const { notes } = buildArpeggioNotes(step, sequence.direction, numOctaves)
      const label = getArpeggioStepLabel(step, ignoreOctave)

      startSession({
        scaleNotes: notes,
        centsTolerance,
        minHoldDetections,
        ignoreOctave,
      })

      const nextStep = sequence.steps.length > 1
        ? sequence.steps[1]
        : sequence.steps[0]
      const nextLabel = getArpeggioStepLabel(nextStep, ignoreOctave)

      setArpeggioState({
        phase: 'playing',
        sequence,
        currentStepIndex: 0,
        currentNoteIndex: 0,
        completedLoops: 0,
        results: [],
        currentNotes: notes,
        currentLabel: label,
        nextLabel,
        cumulativeStats: EMPTY_STATS,
      })
    },
    [startSession],
  )

  const stopArpeggio = useCallback(() => {
    stoppedRef.current = true

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    resetSession()

    setArpeggioState((prev) => {
      if (!prev) return null
      return { ...prev, phase: 'stopped' }
    })
  }, [resetSession])

  // Watch for inner session completion and handle transitions
  useEffect(() => {
    if (
      !innerScore ||
      innerSessionState?.phase !== 'Complete' ||
      stoppedRef.current ||
      scoreCapturedRef.current
    ) {
      return
    }

    scoreCapturedRef.current = true

    const sequence = sequenceRef.current
    if (!sequence) return

    const stepIndex = stepIndexRef.current
    const step = sequence.steps[stepIndex]
    const numOctaves = sequence.numOctaves ?? 1
    const { notes } = buildArpeggioNotes(step, sequence.direction, numOctaves)

    const result: ArpeggioRunResult = {
      step,
      label: getArpeggioStepLabel(step, configRef.current.ignoreOctave),
      notes,
      score: innerScore,
      completedAt: Date.now(),
    }

    const newResults = [...resultsRef.current, result]
    resultsRef.current = newResults
    const stats = computeCumulativeStats(newResults)

    let nextStepIndex = stepIndex + 1
    let nextLoops = loopsRef.current
    let activeSequence = sequence
    if (nextStepIndex >= sequence.steps.length) {
      nextStepIndex = 0
      nextLoops += 1

      const shift = sequence.shiftSemitones ?? 0
      if (shift !== 0 && originalSequenceRef.current) {
        const totalShift = shift * nextLoops
        const shiftedSteps = originalSequenceRef.current.steps.map((s) => {
          const { pitchClass, octave } = transpose(s.root, s.rootOctave, totalShift)
          return { ...s, root: pitchClass, rootOctave: octave, label: undefined }
        })
        activeSequence = { ...sequence, steps: shiftedSteps }
        sequenceRef.current = activeSequence
      }
    }

    const ioct = configRef.current.ignoreOctave
    const nextStep = activeSequence.steps[nextStepIndex]
    const nextLabel = getArpeggioStepLabel(nextStep, ioct)
    const { notes: nextNotes } = buildArpeggioNotes(nextStep, activeSequence.direction, activeSequence.numOctaves ?? 1)

    let nextNextStepIndex = nextStepIndex + 1
    if (nextNextStepIndex >= activeSequence.steps.length) nextNextStepIndex = 0
    const nextNextLabel = getArpeggioStepLabel(activeSequence.steps[nextNextStepIndex], ioct)

    const startNextArpeggio = () => {
      if (stoppedRef.current) return

      stepIndexRef.current = nextStepIndex
      loopsRef.current = nextLoops
      scoreCapturedRef.current = false

      startSession({
        scaleNotes: nextNotes,
        centsTolerance: configRef.current.centsTolerance,
        minHoldDetections: configRef.current.minHoldDetections,
        ignoreOctave: configRef.current.ignoreOctave,
      })

      setArpeggioState({
        phase: 'playing',
        sequence: activeSequence,
        currentStepIndex: nextStepIndex,
        currentNoteIndex: 0,
        completedLoops: nextLoops,
        results: newResults,
        currentNotes: nextNotes,
        currentLabel: nextLabel,
        nextLabel: nextNextLabel,
        cumulativeStats: stats,
      })
    }

    if (sequence.skipTransition) {
      startNextArpeggio()
    } else {
      setArpeggioState({
        phase: 'playing',
        sequence: activeSequence,
        currentStepIndex: nextStepIndex,
        currentNoteIndex: 0,
        completedLoops: nextLoops,
        results: newResults,
        currentNotes: nextNotes,
        currentLabel: nextLabel,
        nextLabel: nextNextLabel,
        cumulativeStats: stats,
      })

      transitionTimerRef.current = setTimeout(startNextArpeggio, TRANSITION_DURATION_MS)
    }
  }, [innerSessionState?.phase, innerScore, startSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  const processArpeggioFrame = useCallback(
    (pitch: DetectedPitch) => {
      sessionProcessFrame(pitch)
    },
    [sessionProcessFrame],
  )

  const skipArpeggio = useCallback(() => {
    sessionSkipNote()
  }, [sessionSkipNote])

  return {
    arpeggioState,
    sessionState: innerSessionState,
    innerScore,
    startArpeggio,
    stopArpeggio,
    processArpeggioFrame,
    skipArpeggio,
  }
}
