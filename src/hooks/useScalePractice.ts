import { useState, useRef, useCallback, useEffect } from 'react'
import { usePracticeSession } from './usePracticeSession.ts'
import { getStepLabel, getStepChordSymbol } from '@core/scales/presets.ts'
import { buildScaleNotes } from '@core/music/scaleBuilder.ts'
import { buildAllStepsNotes } from '@core/rhythm/sequence.ts'
import type { NoteDuration, ScaleStartPosition } from '@core/rhythm/types.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { DetectedPitch } from '@core/wasm/types.ts'
import type { Note } from '@core/wasm/types.ts'
import type {
  ScaleSequence,
  ScaleStep,
  ScaleSessionState,
  ScaleRunResult,
  PositionedChordSymbol,
  CumulativeStats,
} from '@core/scales/types.ts'

function computeCumulativeStats(results: ScaleRunResult[]): CumulativeStats {
  const totalScalesCompleted = results.length
  const totalNotesAttempted = results.reduce((sum, r) => sum + r.score.totalNotes, 0)
  const totalCorrect = results.reduce((sum, r) => sum + r.score.correctNotes, 0)
  const totalIncorrect = results.reduce((sum, r) => sum + r.score.incorrectNotes, 0)
  const totalMissed = results.reduce((sum, r) => sum + r.score.missedNotes, 0)
  const totalAttempts = totalCorrect + totalIncorrect
  const overallAccuracyPercent =
    totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0
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

/** Whether to combine all steps into a single continuous session */
function isCombinedMode(sequence: ScaleSequence): boolean {
  if ((sequence.shiftSemitones ?? 0) > 0) return true
  if ((sequence.loopCount ?? 1) > 1) return true
  return sequence.skipTransition === true && sequence.steps.length > 1
}

/** Build combined notes for all steps in a sequence (for combined mode).
 *  Uses the shared buildAllStepsNotes so rest padding matches the preview exactly. */
function buildCombinedLoopNotes(sequence: ScaleSequence, noteDuration?: NoteDuration, scaleStartPosition?: ScaleStartPosition, range?: { minMidi: number; maxMidi: number }): {
  notes: Note[]
  chordSymbols: PositionedChordSymbol[]
  restIndices: Set<number>
} {
  const { allNotes, boundaries, restIndices } = buildAllStepsNotes(sequence, false, noteDuration, scaleStartPosition, range)
  const chordSymbols: PositionedChordSymbol[] = boundaries.map(b => ({
    noteIndex: b.startNoteIndex,
    symbol: getStepChordSymbol(b.step),
  }))
  return { notes: allNotes, chordSymbols, restIndices }
}

/** Build a combined label from all step labels (e.g., "D Dorian → G Mixolydian → C Major") */
function getCombinedLabel(sequence: ScaleSequence, ignoreOctave: boolean): string {
  return sequence.steps.map(s => getStepLabel(s, ignoreOctave)).join(' \u2192 ')
}

/** Expand a scale sequence, clearing labels/chord symbols so they regenerate for transposed roots */
function expandScaleSequence(sequence: ScaleSequence): ScaleSequence {
  return expandSequenceWithLoops<ScaleSequence, ScaleStep>(
    sequence,
    (step: ScaleStep) => ({ root: step.rootNote, octave: step.rootOctave }),
    (step: ScaleStep, pitchClass: string, octave: number) => ({
      ...step,
      rootNote: pitchClass,
      rootOctave: octave,
      label: undefined,
      chordSymbol: undefined,
    }),
  )
}

export function useScalePractice() {
  const {
    sessionState: innerSessionState,
    score: innerScore,
    startSession,
    processFrame: sessionProcessFrame,
    skipNote: sessionSkipNote,
    resetSession,
  } = usePracticeSession()

  const [scaleState, setScaleState] = useState<ScaleSessionState | null>(null)

  const sequenceRef = useRef<ScaleSequence | null>(null)
  const configRef = useRef<{ centsTolerance: number; minHoldDetections: number; ignoreOctave: boolean }>({
    centsTolerance: 40,
    minHoldDetections: 3,
    ignoreOctave: true,
  })
  const noteDurationRef = useRef<NoteDuration | undefined>(undefined)
  const scaleStartPositionRef = useRef<ScaleStartPosition | undefined>(undefined)
  const rangeRef = useRef<{ minMidi: number; maxMidi: number } | undefined>(undefined)
  const stoppedRef = useRef(false)
  const resultsRef = useRef<ScaleRunResult[]>([])
  const stepIndexRef = useRef(0)
  const loopsRef = useRef(0)

  // Track whether we've already captured the score for the current session
  const scoreCapturedRef = useRef(false)

  const startScalePractice = useCallback(
    (
      sequence: ScaleSequence,
      centsTolerance: number,
      minHoldDetections: number,
      ignoreOctave: boolean = true,
      noteDuration?: NoteDuration,
      scaleStartPosition?: ScaleStartPosition,
      range?: { minMidi: number; maxMidi: number },
    ) => {
      // Expand sequence if it has shifts or loops — materializes all transpositions upfront
      let activeSequence = sequence
      if ((sequence.shiftSemitones ?? 0) > 0 || (sequence.loopCount ?? 1) > 1) {
        activeSequence = { ...expandScaleSequence(sequence), skipTransition: true }
      }

      sequenceRef.current = activeSequence
      configRef.current = { centsTolerance, minHoldDetections, ignoreOctave }
      noteDurationRef.current = noteDuration
      scaleStartPositionRef.current = scaleStartPosition
      rangeRef.current = range
      stoppedRef.current = false
      resultsRef.current = []
      stepIndexRef.current = 0
      loopsRef.current = 0
      scoreCapturedRef.current = false

      if (isCombinedMode(activeSequence)) {
        // Combined mode: build all step notes into one continuous session
        const { notes: allNotes, chordSymbols, restIndices } = buildCombinedLoopNotes(activeSequence, noteDuration, scaleStartPosition, range)
        const label = getCombinedLabel(activeSequence, ignoreOctave)

        startSession({
          scaleNotes: allNotes,
          centsTolerance,
          minHoldDetections,
          ignoreOctave,
        })

        setScaleState({
          phase: 'playing',
          sequence: activeSequence,
          currentStepIndex: 0,
          completedLoops: 0,
          results: [],
          currentScaleNotes: allNotes,
          currentLabel: label,
          currentChordSymbol: chordSymbols[0]?.symbol ?? null,
          chordSymbols,
          nextLabel: null,
          cumulativeStats: EMPTY_STATS,
          restIndices,
        })
      } else {
        // Individual mode: one step at a time
        const step = activeSequence.steps[0]
        const { notes: scaleNotes } = buildScaleNotes(step, activeSequence.direction, activeSequence.numOctaves, range)
        const label = getStepLabel(step, ignoreOctave)

        startSession({
          scaleNotes,
          centsTolerance,
          minHoldDetections,
          ignoreOctave,
        })

        const nextStep = activeSequence.steps.length > 1
          ? activeSequence.steps[1]
          : activeSequence.steps[0]
        const nextLabel = getStepLabel(nextStep, ignoreOctave)

        const chordSymbol = getStepChordSymbol(step)

        setScaleState({
          phase: 'playing',
          sequence: activeSequence,
          currentStepIndex: 0,
          completedLoops: 0,
          results: [],
          currentScaleNotes: scaleNotes,
          currentLabel: label,
          currentChordSymbol: chordSymbol,
          chordSymbols: [{ noteIndex: 0, symbol: chordSymbol }],
          nextLabel,
          cumulativeStats: EMPTY_STATS,
        })
      }
    },
    [startSession]
  )

  const stopScalePractice = useCallback(() => {
    stoppedRef.current = true
    resetSession()

    setScaleState((prev) => {
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

    // Mark this score as captured so we don't re-enter
    scoreCapturedRef.current = true

    const sequence = sequenceRef.current
    if (!sequence) return

    const ioct = configRef.current.ignoreOctave

    if (isCombinedMode(sequence)) {
      // Combined mode: entire expanded sequence just completed
      const { notes: allNotes, chordSymbols } = buildCombinedLoopNotes(sequence, noteDurationRef.current, scaleStartPositionRef.current, rangeRef.current)

      const result: ScaleRunResult = {
        step: sequence.steps[0],
        label: getCombinedLabel(sequence, ioct),
        scaleNotes: allNotes,
        score: innerScore,
        completedAt: Date.now(),
      }

      const newResults = [...resultsRef.current, result]
      resultsRef.current = newResults
      const stats = computeCumulativeStats(newResults)

      const nextLoops = loopsRef.current + 1

      // Immediately restart the same expanded sequence
      if (stoppedRef.current) return

      loopsRef.current = nextLoops
      scoreCapturedRef.current = false

      startSession({
        scaleNotes: allNotes,
        centsTolerance: configRef.current.centsTolerance,
        minHoldDetections: configRef.current.minHoldDetections,
        ignoreOctave: configRef.current.ignoreOctave,
      })

      setScaleState({
        phase: 'playing',
        sequence,
        currentStepIndex: 0,
        completedLoops: nextLoops,
        results: newResults,
        currentScaleNotes: allNotes,
        currentLabel: getCombinedLabel(sequence, ioct),
        currentChordSymbol: chordSymbols[0]?.symbol ?? null,
        chordSymbols,
        nextLabel: null,
        cumulativeStats: stats,
      })
    } else {
      // Individual mode: per-step completion
      const stepIndex = stepIndexRef.current
      const step = sequence.steps[stepIndex]
      const { notes: scaleNotes } = buildScaleNotes(step, sequence.direction, sequence.numOctaves, rangeRef.current)

      const result: ScaleRunResult = {
        step,
        label: getStepLabel(step, ioct),
        scaleNotes,
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

      const nextStep = sequence.steps[nextStepIndex]
      const nextLabel = getStepLabel(nextStep, ioct)
      const { notes: nextScaleNotes } = buildScaleNotes(nextStep, sequence.direction, sequence.numOctaves, rangeRef.current)

      let nextNextStepIndex = nextStepIndex + 1
      if (nextNextStepIndex >= sequence.steps.length) nextNextStepIndex = 0
      const nextNextLabel = getStepLabel(sequence.steps[nextNextStepIndex], ioct)

      // Immediately start next step
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

      const nextChordSymbol = getStepChordSymbol(nextStep)

      setScaleState({
        phase: 'playing',
        sequence,
        currentStepIndex: nextStepIndex,
        completedLoops: nextLoops,
        results: newResults,
        currentScaleNotes: nextScaleNotes,
        currentLabel: nextLabel,
        currentChordSymbol: nextChordSymbol,
        chordSymbols: [{ noteIndex: 0, symbol: nextChordSymbol }],
        nextLabel: nextNextLabel,
        cumulativeStats: stats,
      })
    }
  }, [innerSessionState?.phase, innerScore, startSession])

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
    scaleState,
    innerSessionState,
    innerScore,
    startScalePractice,
    stopScalePractice,
    processFrame,
    skipNote,
  }
}
