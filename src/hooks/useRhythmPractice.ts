import { useState, useRef, useCallback, useEffect } from 'react'
import { buildAllStepsNotes, getActiveStepIndex } from '@core/rhythm/sequence.ts'
import {
  computeTimingStats,
  computeRhythmCumulativeStats,
  makeEmptyNoteEvents,
  EMPTY_CUMULATIVE,
} from '@core/rhythm/stats.ts'
import {
  NOTE_DURATION_BEATS,
  computeTimingWindows,
  scoreNote,
} from '@core/rhythm/types.ts'
import {
  MAX_PITCH_SAMPLES,
  evaluateNote,
  computeLiveFeedback,
  isPitchMatch,
} from '@core/rhythm/evaluation.ts'
import { frequencyToNote } from '@core/wasm/noteUtils.ts'
import { transpose } from '@core/endless/presets.ts'
import type { DetectedPitch, Note } from '@core/wasm/types.ts'
import type { ScaleSequence } from '@core/endless/types.ts'
import type { PitchSample } from '@core/rhythm/evaluation.ts'
import type {
  NoteDuration,
  TimingResult,
  TimingWindows,
  RhythmNoteEvent,
  RhythmSessionState,
  RhythmPhase,
  RhythmScaleRunResult,
  RhythmEndlessState,
  StepBoundary,
} from '@core/rhythm/types.ts'

/**
 * Total metronome beats during the count-in phase.
 * The first 4 beats light up the 4 countdown dots progressively;
 * the 5th beat triggers the transition to the playing phase.
 * This ensures all 4 dots are visually lit for a full beat before
 * practice begins, giving the player a proper "1-2-3-4, GO" count-in.
 */
export const COUNTDOWN_BEATS = 5

interface UseRhythmPracticeOptions {
  audioContext: AudioContext | null
  onBeatSubscribe?: (cb: (beat: number, time: number) => void) => () => void
}

export function useRhythmPractice({ audioContext, onBeatSubscribe }: UseRhythmPracticeOptions) {
  const [rhythmState, setRhythmState] = useState<RhythmEndlessState | null>(
    null,
  )
  const [sessionState, setSessionState] = useState<RhythmSessionState | null>(
    null,
  )

  // Refs for mutable state during the animation loop
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<RhythmPhase>('idle')
  const stoppedRef = useRef(false)
  const noteEventsRef = useRef<RhythmNoteEvent[]>([])
  const currentNoteIndexRef = useRef(0)
  const startTimeRef = useRef(0)
  const secondsPerNoteRef = useRef(0.5)
  const scaleNotesRef = useRef<Note[]>([])
  const centsToleranceRef = useRef(40)
  const ignoreOctaveRef = useRef(true)
  const timingWindowsRef = useRef<TimingWindows>(computeTimingWindows(120))
  const audioContextRef = useRef<AudioContext | null>(null)

  // Beat subscription refs for metronome-synced countdown
  const beatUnsubRef = useRef<(() => void) | null>(null)
  const countdownBeatsFiredRef = useRef(0)

  // Separate beat subscription for the playing phase (beat dot sync)
  const playingBeatUnsubRef = useRef<(() => void) | null>(null)
  const playingBeatIndexRef = useRef(0)

  // Track detected pitches for the current note window.
  // We collect multiple samples and pick the best one at evaluation time,
  // rather than locking in a single detection (which often captures attack noise).
  const pitchSamplesRef = useRef<PitchSample[]>([])
  // Also track the sample closest to the scheduled time, for timing grading
  const closestTimingSampleRef = useRef<PitchSample | null>(null)
  // Look-ahead buffer: samples that may be early attacks for the NEXT note.
  // Offsets are pre-computed relative to the next note's scheduled time (negative).
  const nextNoteSamplesRef = useRef<PitchSample[]>([])
  // Live feedback ref — set immediately on pitch detection, read by the UI
  const liveFeedbackRef = useRef<{ noteIndex: number; pitchCorrect: boolean; timingResult: TimingResult; timingOffsetMs: number } | null>(null)

  // Sequence management refs
  const sequenceRef = useRef<ScaleSequence | null>(null)
  const originalSequenceRef = useRef<ScaleSequence | null>(null)
  const stepIndexRef = useRef(0)
  const loopsRef = useRef(0)
  const resultsRef = useRef<RhythmScaleRunResult[]>([])
  const stepBoundariesRef = useRef<StepBoundary[]>([])
  const bpmRef = useRef(120)
  const noteDurationRef = useRef<NoteDuration>('quarter')

  // Keep audioContext ref in sync
  useEffect(() => {
    audioContextRef.current = audioContext
  }, [audioContext])

  // Keep onBeatSubscribe ref in sync
  useEffect(() => {
    onBeatSubscribeRef.current = onBeatSubscribe
  }, [onBeatSubscribe])

  // Use refs for tick, handleScaleComplete, and handleCountdownBeat
  // to break circular dependency
  const tickRef = useRef<() => void>(() => {})
  const handleScaleCompleteRef = useRef<() => void>(() => {})
  const handleCountdownBeatRef = useRef<(scheduledTime: number) => void>(() => {})
  const onBeatSubscribeRef = useRef(onBeatSubscribe)

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  /** Convenience: evaluate note using current ref values.
   *  When live feedback already confirmed correct pitch for this note,
   *  override the timing grade to match what was shown to the user.
   *  This prevents the sample buffer eviction (max 20 samples) from
   *  causing the final result to disagree with the live feedback.
   */
  function evaluateCurrentNote(
    noteIndex: number,
    expectedNote: Note,
    scheduledTime: number,
  ): RhythmNoteEvent {
    const result = evaluateNote(
      noteIndex,
      expectedNote,
      scheduledTime,
      pitchSamplesRef.current,
      closestTimingSampleRef.current,
      timingWindowsRef.current,
      centsToleranceRef.current,
      ignoreOctaveRef.current,
    )

    // If live feedback confirmed correct pitch, use its timing to stay consistent.
    // But don't override when the evaluation found an early detection (negative
    // offset from the look-ahead buffer) — that's the actual attack time.
    const feedback = liveFeedbackRef.current
    if (
      feedback &&
      feedback.noteIndex === noteIndex &&
      feedback.pitchCorrect &&
      result.pitchCorrect &&
      result.timingOffsetMs >= 0
    ) {
      result.timingResult = feedback.timingResult
      result.timingOffsetMs = feedback.timingOffsetMs
    }

    return result
  }

  // Assign the actual tick/countdown/complete functions to refs via effect
  // (React 19 compiler disallows ref writes during render)
  useEffect(() => {
  handleCountdownBeatRef.current = (scheduledTime: number) => {
    if (phaseRef.current !== 'countdown' || stoppedRef.current) return

    const fired = countdownBeatsFiredRef.current + 1
    countdownBeatsFiredRef.current = fired

    const remaining = COUNTDOWN_BEATS - fired

    if (remaining <= 0) {
      beatUnsubRef.current?.()
      beatUnsubRef.current = null

      const ctx = audioContextRef.current
      if (!ctx) return

      phaseRef.current = 'playing'
      // Use the scheduled audio time of the beat that triggers the
      // transition, NOT ctx.currentTime.  The metronome schedules clicks
      // ahead of time via Web Audio, but the JS callback fires later
      // (on the next scheduler interval).  Using ctx.currentTime here
      // would set startTime *after* the first beat actually sounded,
      // causing the first note to always appear late and the playhead
      // to start at an offset.
      startTimeRef.current = scheduledTime
      currentNoteIndexRef.current = 0
      pitchSamplesRef.current = []
      closestTimingSampleRef.current = null
      nextNoteSamplesRef.current = []
      playingBeatIndexRef.current = 0

      // Subscribe to onBeat for the playing phase so the beat dot
      // is driven directly by the metronome, not by RAF polling.
      playingBeatUnsubRef.current?.()
      if (onBeatSubscribeRef.current) {
        playingBeatUnsubRef.current = onBeatSubscribeRef.current((beat: number) => {
          if (phaseRef.current !== 'playing' || stoppedRef.current) return
          playingBeatIndexRef.current = beat
          setSessionState((prev) =>
            prev ? { ...prev, currentBeat: beat } : prev,
          )
        })
      }

      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              phase: 'playing',
              countdownBeat: 0,
              currentNoteIndex: 0,
              currentBeat: 0,
              startTime: scheduledTime,
              currentTime: scheduledTime,
            }
          : prev,
      )
    } else {
      setSessionState((prev) =>
        prev
          ? { ...prev, countdownBeat: remaining, currentTime: audioContextRef.current?.currentTime ?? prev.currentTime }
          : prev,
      )
    }
  }

  tickRef.current = () => {
    const ctx = audioContextRef.current
    if (stoppedRef.current || !ctx) return

    const now = ctx.currentTime
    const phase = phaseRef.current

    // Countdown is driven by metronome beat subscription, not the RAF loop
    if (phase === 'countdown') {
      rafRef.current = requestAnimationFrame(() => tickRef.current())
      return
    }

    if (phase === 'playing') {
      // Clamp `now` so that elapsed is never negative.  The metronome
      // notifies beat callbacks ahead of real time (look-ahead scheduling),
      // so startTimeRef may be slightly in the future for the first few
      // RAF frames after the countdown-to-playing transition.  Without
      // this clamp the playhead would briefly jump to a negative scroll
      // position (appearing offset from the first note).
      const clampedNow = Math.max(now, startTimeRef.current)
      const elapsed = clampedNow - startTimeRef.current
      const spn = secondsPerNoteRef.current
      const noteIndex = Math.floor(elapsed / spn)
      const totalNotes = scaleNotesRef.current.length

      if (noteIndex > currentNoteIndexRef.current) {
        const prevIndex = currentNoteIndexRef.current
        const prevNote = scaleNotesRef.current[prevIndex]
        const prevScheduled = startTimeRef.current + prevIndex * spn

        const result = evaluateCurrentNote(prevIndex, prevNote, prevScheduled)
        noteEventsRef.current[prevIndex] = result

        // Seed the new note's buffer with look-ahead samples (early detections).
        // Only carry forward when advancing by exactly 1 note; if we skip notes
        // the look-ahead offsets are relative to the wrong beat.
        if (noteIndex === prevIndex + 1 && nextNoteSamplesRef.current.length > 0) {
          pitchSamplesRef.current = [...nextNoteSamplesRef.current]
          let closest: PitchSample | null = null
          for (const s of pitchSamplesRef.current) {
            if (!closest || Math.abs(s.offsetMs) < Math.abs(closest.offsetMs)) {
              closest = s
            }
          }
          closestTimingSampleRef.current = closest
        } else {
          pitchSamplesRef.current = []
          closestTimingSampleRef.current = null
        }
        nextNoteSamplesRef.current = []
        currentNoteIndexRef.current = noteIndex
      }

      if (noteIndex >= totalNotes) {
        const lastIndex = totalNotes - 1
        if (
          lastIndex >= 0 &&
          noteEventsRef.current[lastIndex].timingResult === 'missed' &&
          !noteEventsRef.current[lastIndex].detectedNote
        ) {
          const lastNote = scaleNotesRef.current[lastIndex]
          const lastScheduled = startTimeRef.current + lastIndex * spn
          noteEventsRef.current[lastIndex] = evaluateCurrentNote(
            lastIndex,
            lastNote,
            lastScheduled,
          )
        }

        phaseRef.current = 'idle'
        playingBeatUnsubRef.current?.()
        playingBeatUnsubRef.current = null
        handleScaleCompleteRef.current()
        return
      }

      // Update the active step label based on which boundary the playhead is in
      const activeStep = getActiveStepIndex(stepBoundariesRef.current, noteIndex)
      if (activeStep !== stepIndexRef.current) {
        stepIndexRef.current = activeStep
        const boundary = stepBoundariesRef.current[activeStep]
        if (boundary) {
          setRhythmState((prev) =>
            prev
              ? {
                  ...prev,
                  currentStepIndex: activeStep,
                  currentLabel: boundary.label,
                }
              : prev,
          )
        }
      }

      setSessionState((prev) =>
        prev
          ? {
              ...prev,
              currentNoteIndex: noteIndex,
              currentTime: clampedNow,
              noteEvents: [...noteEventsRef.current],
            }
          : prev,
      )

      rafRef.current = requestAnimationFrame(() => tickRef.current())
      return
    }
  }

  handleScaleCompleteRef.current = () => {
    // The entire concatenated run (all steps) just finished.
    // Split events into per-step results using step boundaries.
    const sequence = sequenceRef.current
    if (!sequence || stoppedRef.current) return

    const boundaries = stepBoundariesRef.current
    const allEvents = [...noteEventsRef.current]
    const allNotes = scaleNotesRef.current
    const now = Date.now()

    // Build one RhythmScaleRunResult per step boundary
    const runResults: RhythmScaleRunResult[] = []
    for (const boundary of boundaries) {
      const stepEvents = allEvents.slice(boundary.startNoteIndex, boundary.endNoteIndex)
      const stepNotes = allNotes.slice(boundary.startNoteIndex, boundary.endNoteIndex)
      const totalPoints = stepEvents.reduce(
        (sum, e) => sum + scoreNote(e.pitchCorrect, e.timingResult), 0,
      )
      const scorePercent =
        stepNotes.length > 0 ? (totalPoints / (10 * stepNotes.length)) * 100 : 0

      runResults.push({
        step: boundary.step,
        label: boundary.label,
        scaleNotes: stepNotes,
        noteEvents: stepEvents,
        scorePercent,
        timingStats: computeTimingStats(stepEvents),
        completedAt: now,
      })
    }

    const newResults = [...resultsRef.current, ...runResults]
    resultsRef.current = newResults
    const stats = computeRhythmCumulativeStats(newResults)

    // Check if the sequence has a loop shift — if so, cycle to next key
    const shift = sequence.shiftSemitones ?? 0
    if (shift !== 0 && originalSequenceRef.current) {
      const nextLoops = loopsRef.current + 1
      loopsRef.current = nextLoops

      // Compute cumulative shift from the original sequence
      const totalShift = shift * nextLoops
      const shiftedSteps = originalSequenceRef.current.steps.map((step) => {
        const { pitchClass, octave } = transpose(step.rootNote, step.rootOctave, totalShift)
        return { ...step, rootNote: pitchClass, rootOctave: octave, label: undefined }
      })
      const shiftedSequence = { ...sequence, steps: shiftedSteps }
      sequenceRef.current = shiftedSequence

      // Rebuild notes for the shifted sequence
      const { allNotes: nextNotes, boundaries: nextBoundaries } =
        buildAllStepsNotes(shiftedSequence, ignoreOctaveRef.current)
      scaleNotesRef.current = nextNotes
      stepBoundariesRef.current = nextBoundaries

      // Reset per-run state for the new loop
      noteEventsRef.current = makeEmptyNoteEvents(nextNotes)
      currentNoteIndexRef.current = 0
      stepIndexRef.current = 0
      pitchSamplesRef.current = []
      closestTimingSampleRef.current = null
      nextNoteSamplesRef.current = []
      liveFeedbackRef.current = null

      const bpm = bpmRef.current
      const noteDuration = noteDurationRef.current
      const beatsPerNote = NOTE_DURATION_BEATS[noteDuration]
      const spn = (60 / bpm) * beatsPerNote
      secondsPerNoteRef.current = spn
      timingWindowsRef.current = computeTimingWindows(bpm)

      const firstLabel = nextBoundaries[0]?.label ?? ''

      // Start countdown for the next loop
      phaseRef.current = 'countdown'
      countdownBeatsFiredRef.current = 0
      if (onBeatSubscribeRef.current) {
        beatUnsubRef.current?.()
        beatUnsubRef.current = onBeatSubscribeRef.current((_beat: number, time: number) => {
          handleCountdownBeatRef.current(time)
        })
      }

      const ctx = audioContextRef.current

      setSessionState({
        phase: 'countdown',
        countdownBeat: COUNTDOWN_BEATS,
        currentNoteIndex: 0,
        noteEvents: [...noteEventsRef.current],
        totalNotes: nextNotes.length,
        startTime: 0,
        currentTime: ctx?.currentTime ?? 0,
        currentBeat: 0,
        bpm,
        noteDuration,
        secondsPerNote: spn,
        liveFeedback: null,
      })

      setRhythmState({
        phase: 'countdown',
        sequence: shiftedSequence,
        currentStepIndex: 0,
        completedLoops: nextLoops,
        results: newResults,
        currentScaleNotes: nextNotes,
        currentLabel: firstLabel,
        nextLabel: null,
        cumulativeStats: stats,
        stepBoundaries: nextBoundaries,
      })

      // Restart the RAF loop for the countdown → playing tick
      rafRef.current = requestAnimationFrame(() => tickRef.current())
      return
    }

    // No shift — session complete, stop and show results
    stoppedRef.current = true
    beatUnsubRef.current?.()
    beatUnsubRef.current = null

    setSessionState((prev) =>
      prev ? { ...prev, phase: 'stopped' } : prev,
    )

    setRhythmState({
      phase: 'stopped',
      sequence,
      currentStepIndex: boundaries.length - 1,
      completedLoops: loopsRef.current,
      results: newResults,
      currentScaleNotes: allNotes,
      currentLabel: boundaries[boundaries.length - 1]?.label ?? '',
      nextLabel: null,
      cumulativeStats: stats,
      stepBoundaries: boundaries,
    })
  }
  }) // end useEffect for tickRef + handleScaleCompleteRef

  const processFrame = useCallback(
    (pitch: DetectedPitch) => {
      if (
        phaseRef.current !== 'playing' ||
        stoppedRef.current ||
        !audioContextRef.current
      ) {
        return
      }

      // Clamp to startTimeRef so we never compute a negative elapsed time
      // during the brief look-ahead window after the countdown-to-playing
      // transition (see matching clamp in the tick loop).
      const now = Math.max(
        audioContextRef.current.currentTime,
        startTimeRef.current,
      )
      const spn = secondsPerNoteRef.current
      const scheduledTime =
        startTimeRef.current + currentNoteIndexRef.current * spn
      const offsetMs = (now - scheduledTime) * 1000

      const sample: PitchSample = { pitch, offsetMs }

      // Collect samples (capped to avoid unbounded growth on very long notes)
      const samples = pitchSamplesRef.current
      if (samples.length < MAX_PITCH_SAMPLES) {
        samples.push(sample)
      } else {
        // Replace the sample with worst clarity to keep high-quality detections
        let worstIndex = 0
        let worstClarity = samples[0].pitch.clarity
        for (let i = 1; i < samples.length; i++) {
          if (samples[i].pitch.clarity < worstClarity) {
            worstClarity = samples[i].pitch.clarity
            worstIndex = i
          }
        }
        if (pitch.clarity > worstClarity) {
          samples[worstIndex] = sample
        }
      }

      // Track the sample closest to the scheduled time (for timing grading)
      const currentClosest = closestTimingSampleRef.current
      if (
        !currentClosest ||
        Math.abs(offsetMs) < Math.abs(currentClosest.offsetMs)
      ) {
        closestTimingSampleRef.current = sample
      }

      // Look-ahead: if this detection doesn't match the current expected note
      // and we're within the timing window of the NEXT beat, record it as a
      // potential early attack for the next note (with negative offset).
      const nextNoteIdx = currentNoteIndexRef.current + 1
      if (nextNoteIdx < scaleNotesRef.current.length) {
        const nextScheduled = startTimeRef.current + nextNoteIdx * spn
        const earlyOffsetMs = (now - nextScheduled) * 1000
        if (earlyOffsetMs < 0 && Math.abs(earlyOffsetMs) <= timingWindowsRef.current.lateMs) {
          const currentExpected = scaleNotesRef.current[currentNoteIndexRef.current]
          const noteResult = frequencyToNote(pitch.frequency)
          const matchesCurrent = isPitchMatch(
            noteResult.note, currentExpected, noteResult.centsOffset,
            centsToleranceRef.current, ignoreOctaveRef.current,
          )
          if (!matchesCurrent) {
            nextNoteSamplesRef.current.push({ pitch, offsetMs: earlyOffsetMs })
          }
        }
      }

      // Live feedback: evaluate immediately so the UI can show results on hit
      const currentIdx = currentNoteIndexRef.current
      const expectedNote = scaleNotesRef.current[currentIdx]
      if (expectedNote) {
        const feedback = computeLiveFeedback(
          pitch,
          expectedNote,
          offsetMs,
          timingWindowsRef.current,
          centsToleranceRef.current,
          ignoreOctaveRef.current,
          liveFeedbackRef.current,
          currentIdx,
        )
        if (feedback) {
          liveFeedbackRef.current = feedback
          setSessionState((p) =>
            p ? { ...p, liveFeedback: feedback } : p,
          )
        }
      }
    },
    [],
  )

  const startRhythm = useCallback(
    (
      sequence: ScaleSequence,
      bpm: number,
      noteDuration: NoteDuration,
      centsTolerance: number,
      ignoreOctave: boolean,
      explicitAudioContext?: AudioContext,
      prebuiltNotes?: { allNotes: Note[]; boundaries: StepBoundary[] },
    ) => {
      const ctx = explicitAudioContext ?? audioContextRef.current
      if (!ctx) return

      // Keep the ref in sync so the tick loop can use it immediately
      audioContextRef.current = ctx

      stopRaf()
      stoppedRef.current = false

      sequenceRef.current = sequence
      originalSequenceRef.current = sequence
      stepIndexRef.current = 0
      loopsRef.current = 0
      resultsRef.current = []
      centsToleranceRef.current = centsTolerance
      ignoreOctaveRef.current = ignoreOctave
      timingWindowsRef.current = computeTimingWindows(bpm)
      bpmRef.current = bpm
      noteDurationRef.current = noteDuration

      const beatsPerNote = NOTE_DURATION_BEATS[noteDuration]
      const spn = (60 / bpm) * beatsPerNote
      secondsPerNoteRef.current = spn

      // Build notes for ALL steps and concatenate into one continuous run.
      // When prebuiltNotes is provided (e.g. from arpeggio mode), skip building.
      const { allNotes, boundaries } = prebuiltNotes ?? buildAllStepsNotes(sequence, ignoreOctave)
      scaleNotesRef.current = allNotes
      stepBoundariesRef.current = boundaries

      noteEventsRef.current = makeEmptyNoteEvents(allNotes)
      currentNoteIndexRef.current = 0
      pitchSamplesRef.current = []
      closestTimingSampleRef.current = null
      nextNoteSamplesRef.current = []

      const firstLabel = boundaries[0]?.label ?? ''

      phaseRef.current = 'countdown'

      // Subscribe to metronome beats for countdown.
      // The onBeat callback receives (beat, time) where `time` is the
      // precise Web Audio scheduled time of the click.  We forward
      // `time` so the countdown-to-playing transition can use the
      // exact scheduled beat time as the session start reference.
      countdownBeatsFiredRef.current = 0
      if (onBeatSubscribeRef.current) {
        beatUnsubRef.current?.()
        beatUnsubRef.current = onBeatSubscribeRef.current((_beat: number, time: number) => {
          handleCountdownBeatRef.current(time)
        })
      }

      setSessionState({
        phase: 'countdown',
        countdownBeat: COUNTDOWN_BEATS,
        currentNoteIndex: 0,
        noteEvents: [...noteEventsRef.current],
        totalNotes: allNotes.length,
        startTime: 0,
        currentTime: ctx.currentTime,
        currentBeat: 0,
        bpm,
        noteDuration,
        secondsPerNote: spn,
        liveFeedback: null,
      })

      setRhythmState({
        phase: 'countdown',
        sequence,
        currentStepIndex: 0,
        completedLoops: 0,
        results: [],
        currentScaleNotes: allNotes,
        currentLabel: firstLabel,
        nextLabel: null,
        cumulativeStats: EMPTY_CUMULATIVE,
        stepBoundaries: boundaries,
      })

      rafRef.current = requestAnimationFrame(() => tickRef.current())
    },
    [stopRaf],
  )

  const stopRhythm = useCallback(() => {
    stoppedRef.current = true
    stopRaf()
    beatUnsubRef.current?.()
    beatUnsubRef.current = null
    playingBeatUnsubRef.current?.()
    playingBeatUnsubRef.current = null
    phaseRef.current = 'idle'

    setSessionState((prev) =>
      prev ? { ...prev, phase: 'stopped' } : prev,
    )
    setRhythmState((prev) =>
      prev ? { ...prev, phase: 'stopped' } : prev,
    )
  }, [stopRaf])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true
      stopRaf()
      beatUnsubRef.current?.()
      beatUnsubRef.current = null
      playingBeatUnsubRef.current?.()
      playingBeatUnsubRef.current = null
    }
  }, [stopRaf])

  return {
    rhythmState,
    sessionState,
    startRhythm,
    stopRhythm,
    processFrame,
  }
}
