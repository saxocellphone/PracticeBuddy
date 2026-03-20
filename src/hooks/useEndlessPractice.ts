import { useState, useRef, useCallback, useEffect } from 'react'
import { usePracticeSession } from './usePracticeSession.ts'
import { getStepLabel, transpose } from '@core/endless/presets.ts'
import { buildScaleNotes } from '@core/music/scaleBuilder.ts'
import type { DetectedPitch } from '@core/wasm/types.ts'
import type {
  ScaleSequence,
  EndlessSessionState,
  ScaleRunResult,
  CumulativeStats,
} from '@core/endless/types.ts'

const TRANSITION_DURATION_MS = 2000

function computeCumulativeStats(results: ScaleRunResult[]): CumulativeStats {
  const totalScalesCompleted = results.length
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
    totalScalesCompleted,
    totalNotesAttempted,
    totalCorrect,
    totalIncorrect,
    totalMissed,
    overallAccuracyPercent,
    averageCentsOffset,
  }
}

const EMPTY_STATS: CumulativeStats = {
  totalScalesCompleted: 0,
  totalNotesAttempted: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalMissed: 0,
  overallAccuracyPercent: 0,
  averageCentsOffset: 0,
}

export function useEndlessPractice() {
  const {
    sessionState: innerSessionState,
    score: innerScore,
    startSession,
    processFrame: sessionProcessFrame,
    skipNote: sessionSkipNote,
    resetSession,
  } = usePracticeSession()

  const [endlessState, setEndlessState] = useState<EndlessSessionState | null>(null)

  // Refs for values needed inside the transition timer
  const sequenceRef = useRef<ScaleSequence | null>(null)
  const originalSequenceRef = useRef<ScaleSequence | null>(null)
  const configRef = useRef<{ centsTolerance: number; minHoldDetections: number; ignoreOctave: boolean }>({
    centsTolerance: 40,
    minHoldDetections: 3,
    ignoreOctave: true,
  })
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)
  const resultsRef = useRef<ScaleRunResult[]>([])
  const stepIndexRef = useRef(0)
  const loopsRef = useRef(0)

  // Track whether we've already captured the score for the current scale
  const scoreCapturedRef = useRef(false)

  const startEndless = useCallback(
    (
      sequence: ScaleSequence,
      centsTolerance: number,
      minHoldDetections: number,
      ignoreOctave: boolean = true
    ) => {
      // Clear any existing transition timer
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
      const { notes: scaleNotes } = buildScaleNotes(step, sequence.direction, sequence.numOctaves)
      const label = getStepLabel(step, ignoreOctave)

      startSession({
        scaleNotes,
        centsTolerance,
        minHoldDetections,
        ignoreOctave,
      })

      // Compute the next scale label for "Coming up" preview
      const nextStep = sequence.steps.length > 1
        ? sequence.steps[1]
        : sequence.steps[0]
      const nextLabel = getStepLabel(nextStep, ignoreOctave)

      setEndlessState({
        phase: 'playing',
        sequence,
        currentStepIndex: 0,
        completedLoops: 0,
        results: [],
        currentScaleNotes: scaleNotes,
        currentLabel: label,
        nextLabel,
        cumulativeStats: EMPTY_STATS,
      })
    },
    [startSession]
  )

  const stopEndless = useCallback(() => {
    stoppedRef.current = true

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    resetSession()

    setEndlessState((prev) => {
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

    // Mark this score as captured so we don't re-enter
    scoreCapturedRef.current = true

    const sequence = sequenceRef.current
    if (!sequence) return

    const stepIndex = stepIndexRef.current
    const step = sequence.steps[stepIndex]
    const { notes: scaleNotes } = buildScaleNotes(step, sequence.direction, sequence.numOctaves)

    // Capture the result
    const result: ScaleRunResult = {
      step,
      label: getStepLabel(step, configRef.current.ignoreOctave),
      scaleNotes,
      score: innerScore,
      completedAt: Date.now(),
    }

    const newResults = [...resultsRef.current, result]
    resultsRef.current = newResults
    const stats = computeCumulativeStats(newResults)

    // Compute next step info for the transition display
    let nextStepIndex = stepIndex + 1
    let nextLoops = loopsRef.current
    let activeSequence = sequence
    if (nextStepIndex >= sequence.steps.length) {
      nextStepIndex = 0
      nextLoops += 1

      // Apply shift on loop wrap
      const shift = sequence.shiftSemitones ?? 0
      if (shift !== 0 && originalSequenceRef.current) {
        const totalShift = shift * nextLoops
        const shiftedSteps = originalSequenceRef.current.steps.map((step) => {
          const { pitchClass, octave } = transpose(step.rootNote, step.rootOctave, totalShift)
          return { ...step, rootNote: pitchClass, rootOctave: octave, label: undefined }
        })
        activeSequence = { ...sequence, steps: shiftedSteps }
        sequenceRef.current = activeSequence
      }
    }
    const ioct = configRef.current.ignoreOctave
    const nextStep = activeSequence.steps[nextStepIndex]
    const nextLabel = getStepLabel(nextStep, ioct)
    const { notes: nextScaleNotes } = buildScaleNotes(nextStep, activeSequence.direction, activeSequence.numOctaves)

    // Compute the label for the scale AFTER the next one (for "Coming up" during playing)
    let nextNextStepIndex = nextStepIndex + 1
    if (nextNextStepIndex >= activeSequence.steps.length) nextNextStepIndex = 0
    const nextNextLabel = getStepLabel(activeSequence.steps[nextNextStepIndex], ioct)

    const startNextScale = () => {
      if (stoppedRef.current) return

      stepIndexRef.current = nextStepIndex
      loopsRef.current = nextLoops
      scoreCapturedRef.current = false

      startSession({
        scaleNotes: nextScaleNotes,
        centsTolerance: configRef.current.centsTolerance,
        minHoldDetections: configRef.current.minHoldDetections,
        ignoreOctave: configRef.current.ignoreOctave,
      })

      setEndlessState({
        phase: 'playing',
        sequence: activeSequence,
        currentStepIndex: nextStepIndex,
        completedLoops: nextLoops,
        results: newResults,
        currentScaleNotes: nextScaleNotes,
        currentLabel: nextLabel,
        nextLabel: nextNextLabel,
        cumulativeStats: stats,
      })
    }

    // If skipTransition is enabled, go straight to the next scale
    if (sequence.skipTransition) {
      startNextScale()
    } else {
      // Set transitioning state
      setEndlessState({
        phase: 'transitioning',
        sequence: activeSequence,
        currentStepIndex: nextStepIndex,
        completedLoops: nextLoops,
        results: newResults,
        currentScaleNotes: nextScaleNotes,
        currentLabel: nextLabel,
        nextLabel: nextNextLabel,
        cumulativeStats: stats,
      })

      // Schedule the next scale start
      transitionTimerRef.current = setTimeout(startNextScale, TRANSITION_DURATION_MS)
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

  // Delegate processFrame and skipNote
  const processFrame = useCallback(
    (pitch: DetectedPitch) => {
      sessionProcessFrame(pitch)
    },
    [sessionProcessFrame]
  )

  const skipNote = useCallback(() => {
    sessionSkipNote()
  }, [sessionSkipNote])

  return {
    endlessState,
    innerSessionState,
    innerScore,
    startEndless,
    stopEndless,
    processFrame,
    skipNote,
  }
}
