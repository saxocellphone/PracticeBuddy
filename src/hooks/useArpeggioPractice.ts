import { useState, useRef, useCallback, useEffect } from 'react'
import { usePracticeSession } from './usePracticeSession.ts'
import { getArpeggioStepLabel } from '@core/arpeggio/presets.ts'
import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { DetectedPitch } from '@core/wasm/types.ts'
import type {
  ArpeggioSequence,
  ArpeggioStep,
  ArpeggioSessionState,
  ArpeggioRunResult,
  CumulativeArpeggioStats,
} from '@core/arpeggio/types.ts'

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

/** Expand an arpeggio sequence, clearing labels so they regenerate for transposed roots */
function expandArpSequence(sequence: ArpeggioSequence): ArpeggioSequence {
  return expandSequenceWithLoops<ArpeggioSequence, ArpeggioStep>(
    sequence,
    (step: ArpeggioStep) => ({ root: step.root, octave: step.rootOctave }),
    (step: ArpeggioStep, pitchClass: string, octave: number) => ({
      ...step,
      root: pitchClass,
      rootOctave: octave,
      label: undefined,
    }),
  )
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
  const configRef = useRef<{ centsTolerance: number; minHoldDetections: number; ignoreOctave: boolean }>({
    centsTolerance: 40,
    minHoldDetections: 3,
    ignoreOctave: true,
  })
  const rangeRef = useRef<{ minMidi: number; maxMidi: number } | undefined>(undefined)
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
      range?: { minMidi: number; maxMidi: number },
    ) => {
      // Expand sequence if it has shifts or loops — materializes all transpositions upfront
      let activeSequence = sequence
      if ((sequence.shiftSemitones ?? 0) > 0 || (sequence.loopCount ?? 1) > 1) {
        activeSequence = { ...expandArpSequence(sequence), skipTransition: true }
      }

      sequenceRef.current = activeSequence
      configRef.current = { centsTolerance, minHoldDetections, ignoreOctave }
      rangeRef.current = range
      stoppedRef.current = false
      resultsRef.current = []
      stepIndexRef.current = 0
      loopsRef.current = 0
      scoreCapturedRef.current = false

      const step = activeSequence.steps[0]
      const numOctaves = activeSequence.numOctaves ?? 1
      const { notes } = buildArpeggioNotes(step, activeSequence.direction, numOctaves, range)
      const label = getArpeggioStepLabel(step, ignoreOctave)

      startSession({
        scaleNotes: notes,
        centsTolerance,
        minHoldDetections,
        ignoreOctave,
      })

      const nextStep = activeSequence.steps.length > 1
        ? activeSequence.steps[1]
        : activeSequence.steps[0]
      const nextLabel = getArpeggioStepLabel(nextStep, ignoreOctave)

      setArpeggioState({
        phase: 'playing',
        sequence: activeSequence,
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
    resetSession()

    setArpeggioState((prev) => {
      if (!prev) return null
      return { ...prev, phase: 'stopped' }
    })
  }, [resetSession])

  // Watch for inner session completion and immediately start next
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
    const { notes } = buildArpeggioNotes(step, sequence.direction, numOctaves, rangeRef.current)

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
    if (nextStepIndex >= sequence.steps.length) {
      nextStepIndex = 0
      nextLoops += 1
    }

    const ioct = configRef.current.ignoreOctave
    const nextStep = sequence.steps[nextStepIndex]
    const nextLabel = getArpeggioStepLabel(nextStep, ioct)
    const { notes: nextNotes } = buildArpeggioNotes(nextStep, sequence.direction, sequence.numOctaves ?? 1, rangeRef.current)

    let nextNextStepIndex = nextStepIndex + 1
    if (nextNextStepIndex >= sequence.steps.length) nextNextStepIndex = 0
    const nextNextLabel = getArpeggioStepLabel(sequence.steps[nextNextStepIndex], ioct)

    // Immediately start next step
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
      sequence,
      currentStepIndex: nextStepIndex,
      currentNoteIndex: 0,
      completedLoops: nextLoops,
      results: newResults,
      currentNotes: nextNotes,
      currentLabel: nextLabel,
      nextLabel: nextNextLabel,
      cumulativeStats: stats,
    })
  }, [innerSessionState?.phase, innerScore, startSession])

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
