import { useState, useRef, useCallback, useEffect } from 'react'
import { usePracticeSession } from './usePracticeSession.ts'
import { buildWalkingBassNotes } from '@core/walking-bass/builder.ts'
import { getPatternById, WALKING_BASS_PATTERNS } from '@core/walking-bass/patterns.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { DetectedPitch } from '@core/wasm/types.ts'
import type {
  WalkingBassSequence,
  WalkingBassStep,
  WalkingBassSessionState,
  WalkingBassRunResult,
  CumulativeWalkingBassStats,
} from '@core/walking-bass/types.ts'
import { EMPTY_WALKING_BASS_STATS } from '@core/walking-bass/types.ts'

function computeCumulativeStats(results: WalkingBassRunResult[]): CumulativeWalkingBassStats {
  const runsCompleted = results.length
  const totalNotes = results.reduce((sum, r) => sum + r.score.totalNotes, 0)
  const correctNotes = results.reduce((sum, r) => sum + r.score.correctNotes, 0)
  const incorrectNotes = results.reduce((sum, r) => sum + r.score.incorrectNotes, 0)
  const missedNotes = totalNotes - correctNotes - incorrectNotes

  return {
    runsCompleted,
    totalNotes,
    correctNotes,
    incorrectNotes,
    missedNotes,
  }
}

function getStepLabel(step: WalkingBassStep): string {
  return step.label ?? step.chordSymbol
}

/** Expand a walking bass sequence, clearing labels so they regenerate for transposed roots */
function expandWBSequence(sequence: WalkingBassSequence): WalkingBassSequence {
  return expandSequenceWithLoops<WalkingBassSequence, WalkingBassStep>(
    sequence,
    (step: WalkingBassStep) => ({ root: step.root, octave: step.rootOctave }),
    (step: WalkingBassStep, pitchClass: string, octave: number) => ({
      ...step,
      root: pitchClass,
      rootOctave: octave,
      label: undefined,
    }),
  )
}

export function useWalkingBassPractice() {
  const {
    sessionState: innerSessionState,
    score: innerScore,
    startSession,
    processFrame: sessionProcessFrame,
    skipNote: sessionSkipNote,
    resetSession,
  } = usePracticeSession()

  const [walkingBassState, setWalkingBassState] = useState<WalkingBassSessionState | null>(null)

  const sequenceRef = useRef<WalkingBassSequence | null>(null)
  const configRef = useRef<{ centsTolerance: number; minHoldDetections: number; ignoreOctave: boolean }>({
    centsTolerance: 40,
    minHoldDetections: 3,
    ignoreOctave: true,
  })
  const rangeRef = useRef<{ minMidi: number; maxMidi: number } | undefined>(undefined)
  const stoppedRef = useRef(false)
  const resultsRef = useRef<WalkingBassRunResult[]>([])
  const stepIndexRef = useRef(0)
  const loopsRef = useRef(0)
  const scoreCapturedRef = useRef(false)

  const startWalkingBass = useCallback(
    (
      sequence: WalkingBassSequence,
      centsTolerance: number,
      minHoldDetections: number,
      ignoreOctave: boolean = true,
      range?: { minMidi: number; maxMidi: number },
    ) => {
      let activeSequence = sequence
      if ((sequence.shiftSemitones ?? 0) > 0 || (sequence.loopCount ?? 1) > 1) {
        activeSequence = { ...expandWBSequence(sequence) }
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
      const nextStep = activeSequence.steps.length > 1
        ? activeSequence.steps[1]
        : activeSequence.steps[0]

      const pattern = (activeSequence.patternId
        ? getPatternById(activeSequence.patternId)
        : undefined) ?? WALKING_BASS_PATTERNS[0]

      const notes = buildWalkingBassNotes(step, pattern, nextStep, activeSequence.approachType, range)
      const label = getStepLabel(step)

      startSession({
        scaleNotes: notes,
        centsTolerance,
        minHoldDetections,
        ignoreOctave,
      })

      const nextLabel = getStepLabel(nextStep)

      setWalkingBassState({
        phase: 'playing',
        sequence: activeSequence,
        currentStepIndex: 0,
        completedLoops: 0,
        results: [],
        currentNotes: notes,
        currentLabel: label,
        currentChordSymbol: step.chordSymbol,
        nextLabel,
        cumulativeStats: EMPTY_WALKING_BASS_STATS,
      })
    },
    [startSession],
  )

  const stopWalkingBass = useCallback(() => {
    stoppedRef.current = true
    resetSession()

    setWalkingBassState((prev) => {
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

    const pattern = (sequence.patternId
      ? getPatternById(sequence.patternId)
      : undefined) ?? WALKING_BASS_PATTERNS[0]

    const nextStepForCurrent = stepIndex + 1 < sequence.steps.length
      ? sequence.steps[stepIndex + 1]
      : sequence.steps[0]
    const currentNotes = buildWalkingBassNotes(step, pattern, nextStepForCurrent, sequence.approachType, rangeRef.current)

    const result: WalkingBassRunResult = {
      step,
      label: getStepLabel(step),
      notes: currentNotes,
      score: {
        correctNotes: innerScore.correctNotes,
        incorrectNotes: innerScore.incorrectNotes,
        totalNotes: innerScore.totalNotes,
      },
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

    const nextStep = sequence.steps[nextStepIndex]
    const nextLabel = getStepLabel(nextStep)

    // Compute notes for the next step
    let nextNextStepIndex = nextStepIndex + 1
    if (nextNextStepIndex >= sequence.steps.length) nextNextStepIndex = 0
    const nextNextStep = sequence.steps[nextNextStepIndex]

    const nextNotes = buildWalkingBassNotes(nextStep, pattern, nextNextStep, sequence.approachType, rangeRef.current)

    const nextNextLabel = getStepLabel(sequence.steps[nextNextStepIndex])

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

    setWalkingBassState({
      phase: 'playing',
      sequence,
      currentStepIndex: nextStepIndex,
      completedLoops: nextLoops,
      results: newResults,
      currentNotes: nextNotes,
      currentLabel: nextLabel,
      currentChordSymbol: nextStep.chordSymbol,
      nextLabel: nextNextLabel,
      cumulativeStats: stats,
    })
  }, [innerSessionState?.phase, innerScore, startSession])

  const processFrame = useCallback(
    (pitch: DetectedPitch) => {
      sessionProcessFrame(pitch)
    },
    [sessionProcessFrame],
  )

  const skipNote = useCallback(() => {
    sessionSkipNote()
  }, [sessionSkipNote])

  return {
    walkingBassState,
    innerSessionState,
    startWalkingBass,
    stopWalkingBass,
    processFrame,
    skipNote,
  }
}
