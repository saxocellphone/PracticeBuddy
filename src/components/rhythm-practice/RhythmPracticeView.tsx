import { useRef, useEffect, useMemo } from 'react'
import type { DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import {
  NOTE_DURATION_BEATS,
} from '@core/rhythm/types.ts'
import type {
  RhythmSessionState,
  RhythmScaleState,
  RhythmNoteEvent,
} from '@core/rhythm/types.ts'
import { COUNTDOWN_BEATS } from '@hooks/useRhythmPractice.ts'
import { getStepChordSymbol } from '@core/scales/presets.ts'
import { MeasureStaff } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import { HitMissFeedback } from './HitMissFeedback.tsx'
import styles from './RhythmPracticeView.module.css'

/** Width in pixels of a single quarter-note cell at the base scale */
const QUARTER_NOTE_WIDTH_PX = 160

/** Height of the staff notation rendering within each cell */
const STAFF_HEIGHT_PX = 220

/** Default time signature: 4/4 */
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

/** Extra width in the first measure cell for bass clef + time signature rendering.
 *  Must match CLEF_WIDTH (54) + TIME_SIG_WIDTH (34) in StaffNote.tsx */
const CLEF_TIME_SIG_WIDTH_PX = 88

interface RhythmPracticeViewProps {
  sessionState: RhythmSessionState
  rhythmState: RhythmScaleState
  detectedPitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  onStop: () => void
  /** AudioContext for reading currentTime directly in the scroll RAF */
  audioContext?: AudioContext | null
  /** Clef type for notation rendering */
  clef?: ClefType
}

export function RhythmPracticeView({
  sessionState,
  rhythmState,
  detectedPitch,
  noteResult,
  onStop,
  audioContext,
  clef,
}: RhythmPracticeViewProps) {
  const railTrackRef = useRef<HTMLDivElement>(null)
  const railContainerRef = useRef<HTMLDivElement>(null)
  const lastBeatRef = useRef(-1)
  const playheadRef = useRef<HTMLDivElement>(null)

  const noteDurationBeats = NOTE_DURATION_BEATS[sessionState.noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / noteDurationBeats)

  // Group noteEvents into measure-sized cells (memoized to avoid re-slicing on every frame)
  const measureGroups = useMemo(() => {
    const groups: RhythmNoteEvent[][] = []
    for (let i = 0; i < sessionState.noteEvents.length; i += notesPerMeasure) {
      groups.push(sessionState.noteEvents.slice(i, i + notesPerMeasure))
    }
    return groups
  }, [sessionState.noteEvents, notesPerMeasure])

  // Pre-compute stable notes arrays for MeasureStaff (avoids creating new arrays every frame)
  const measureNoteArrays = useMemo(() => {
    return measureGroups.map(group =>
      group.map(e => ({ note: e.expectedNote, duration: sessionState.noteDuration }))
    )
  }, [measureGroups, sessionState.noteDuration])

  // Compute chord symbol labels for each measure from step boundaries
  const measureLabelsMap = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()
    for (const boundary of rhythmState.stepBoundaries) {
      const chordText = getStepChordSymbol(boundary.step)
      if (chordText) {
        const measureIndex = Math.floor(boundary.startNoteIndex / notesPerMeasure)
        const noteIndexInMeasure = boundary.startNoteIndex % notesPerMeasure
        const existing = labels.get(measureIndex) ?? []
        existing.push({ noteIndex: noteIndexInMeasure, text: chordText })
        labels.set(measureIndex, existing)
      }
    }
    return labels
  }, [rhythmState.stepBoundaries, notesPerMeasure])

  // Each measure cell spans BEATS_PER_MEASURE beats.
  // Add ACCIDENTAL_LEFT_MARGIN (12px) so MeasureStaff's internal startX
  // doesn't compress the note spacing below QUARTER_NOTE_WIDTH_PX per beat.
  const ACCIDENTAL_MARGIN = 12
  const cellWidthPx = QUARTER_NOTE_WIDTH_PX * BEATS_PER_MEASURE + ACCIDENTAL_MARGIN

  // Notes are centered within their slot (index + 0.5), so the first note
  // is offset by half a note-spacing from the cell edge. Account for this
  // so the playhead hits each note exactly on time.
  const halfNoteSpacingPx = (QUARTER_NOTE_WIDTH_PX * noteDurationBeats) / 2

  // Calculate scroll position based on current time.
  // One beat = QUARTER_NOTE_WIDTH_PX pixels, one beat takes (60 / bpm) seconds:
  const pixelsPerSecond = QUARTER_NOTE_WIDTH_PX * sessionState.bpm / 60
  const playheadOffsetPercent = 0.25 // 25% from left

  // Total offset: clef/time-sig in first cell + half-note centering
  const scrollOffsetPx = CLEF_TIME_SIG_WIDTH_PX + halfNoteSpacingPx

  // Scroll position: RAF loop reads AudioContext.currentTime directly for
  // jitter-free, drift-free scrolling without triggering React re-renders.
  const scrollRafRef = useRef(0)
  const startTimeStable = useRef(sessionState.startTime)
  const phaseStable = useRef(sessionState.phase)

  // Sync refs in an effect (not during render) to satisfy React rules
  useEffect(() => {
    startTimeStable.current = sessionState.startTime
    phaseStable.current = sessionState.phase
  }, [sessionState.startTime, sessionState.phase])

  useEffect(() => {
    const tick = () => {
      if (railTrackRef.current && railContainerRef.current) {
        const containerWidth = railContainerRef.current.offsetWidth
        const playheadX = containerWidth * playheadOffsetPercent

        if (phaseStable.current !== 'playing') {
          railTrackRef.current.style.transform = `translateX(${playheadX - scrollOffsetPx}px)`
        } else {
          // Read AudioContext time directly — most accurate source, no intermediary
          const now = audioContext?.currentTime ?? 0
          const elapsed = Math.max(0, now - startTimeStable.current)
          const scrollX = elapsed * pixelsPerSecond
          railTrackRef.current.style.transform = `translateX(${playheadX - scrollX - scrollOffsetPx}px)`
        }
      }
      scrollRafRef.current = requestAnimationFrame(tick)
    }
    scrollRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(scrollRafRef.current)
  }, [pixelsPerSecond, playheadOffsetPercent, scrollOffsetPx, audioContext])

  // Beat pulse effect on playhead — driven by metronome onBeat subscription
  // via sessionState.currentBeat, so it stays in lockstep with the audio click.
  useEffect(() => {
    if (sessionState.phase !== 'playing') return

    if (sessionState.currentBeat !== lastBeatRef.current) {
      lastBeatRef.current = sessionState.currentBeat

      if (playheadRef.current) {
        playheadRef.current.classList.remove(styles.playheadPulse)
        // Force reflow
        void playheadRef.current.offsetWidth
        playheadRef.current.classList.add(styles.playheadPulse)
      }
    }
  }, [sessionState.currentBeat, sessionState.phase])

  // Beat dot active index — directly from metronome-driven currentBeat
  const beatDotActive =
    sessionState.phase === 'playing' ? sessionState.currentBeat : -1

  // Count correct pitches for the score display
  const correctCount = sessionState.noteEvents.filter(
    (e) => e.pitchCorrect && e.timingResult !== 'missed',
  ).length
  const incorrectCount = sessionState.noteEvents.filter(
    (e) =>
      e.noteIndex < sessionState.currentNoteIndex &&
      (!e.pitchCorrect || e.timingResult === 'missed'),
  ).length

  // Live feedback from pitch detection — shown immediately when a note is played
  const liveFeedback = sessionState.liveFeedback

  return (
    <div className={styles.container}>
      {/* Mode badge */}
      <span className={styles.modeBadge}>Rhythm</span>

      {/* Stop button */}
      <button
        className={styles.stopButton}
        onClick={onStop}
        aria-label="Stop practice"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>

      {/* Scale info */}
      <div className={styles.scaleInfo} style={{ marginTop: '36px' }}>
        <span className={styles.scaleLabel}>{rhythmState.currentLabel}</span>
        <div className={styles.scaleInfoRight}>
          <span className={styles.timeSignature}>{BEATS_PER_MEASURE}/{BEAT_VALUE}</span>
          <span className={styles.scaleMeta}>
            Scale {rhythmState.currentStepIndex + 1} of{' '}
            {rhythmState.sequence.steps.length}
            {rhythmState.completedLoops > 0 &&
              ` (Loop ${rhythmState.completedLoops + 1})`}
          </span>
        </div>
      </div>

      {/* Beat pulse dots */}
      <div className={styles.beatDots}>
        {[0, 1, 2, 3].map((beat) => (
          <div
            key={beat}
            className={`${styles.beatDot} ${beat === 0 ? styles.beatDotFirst : ''} ${beatDotActive === beat ? styles.beatDotActive : ''}`}
          />
        ))}
      </div>

      {/* Countdown dots */}
      {sessionState.phase === 'countdown' && (
        <div className={styles.countdownDots} aria-label="Countdown">
          {[0, 1, 2, 3].map((i) => {
            const beatsFired = COUNTDOWN_BEATS - sessionState.countdownBeat
            const isLit = beatsFired > i
            return (
              <div
                key={i}
                className={`${styles.countdownDot} ${isLit ? styles.countdownDotLit : ''}`}
              />
            )
          })}
        </div>
      )}

      {/* Note rail */}
      <div className={styles.railContainer} ref={railContainerRef}>
        {/* Playhead */}
        <div className={styles.playhead} ref={playheadRef} />

        {/* Hit/miss feedback anchored at the playhead — shown instantly on pitch detection */}
        {liveFeedback && (
          <div className={styles.playheadFeedback}>
            <HitMissFeedback
              key={`feedback-${liveFeedback.noteIndex}`}
              timingResult={liveFeedback.timingResult}
              pitchCorrect={liveFeedback.pitchCorrect}
            />
          </div>
        )}

        {/* Scrolling track — virtualized: only render measures near the playhead */}
        <div className={styles.railTrack} ref={railTrackRef}>
          {measureGroups.map((group, i) => {
            const firstIdx = group[0].noteIndex
            const lastIdx = group[group.length - 1].noteIndex
            const currentMeasure = Math.floor(sessionState.currentNoteIndex / notesPerMeasure)

            // Virtualization: only render measures within ±4 of the current measure
            const RENDER_WINDOW = 4
            if (i < currentMeasure - RENDER_WINDOW || i > currentMeasure + RENDER_WINDOW) {
              const thisCellWidth = i === 0 ? cellWidthPx + CLEF_TIME_SIG_WIDTH_PX - ACCIDENTAL_MARGIN : cellWidthPx
              return <div key={firstIdx} style={{ width: `${thisCellWidth}px`, height: `${STAFF_HEIGHT_PX}px`, flexShrink: 0 }} />
            }

            const isPast = lastIdx < sessionState.currentNoteIndex
            const isActive =
              sessionState.currentNoteIndex >= firstIdx &&
              sessionState.currentNoteIndex <= lastIdx

            const thisCellWidth = i === 0 ? cellWidthPx + CLEF_TIME_SIG_WIDTH_PX - ACCIDENTAL_MARGIN : cellWidthPx

            return (
              <div
                key={firstIdx}
                className={`${styles.noteCell} ${isActive ? styles.noteCellActive : ''} ${isPast ? styles.noteCellPast : ''}`}
                style={{ width: `${thisCellWidth}px` }}
              >
                {/* Staff notation — notes grouped per measure */}
                <MeasureStaff
                  notes={measureNoteArrays[i]}
                  showClef={i === 0}
                  showTimeSignature={i === 0}
                  beatsPerMeasure={BEATS_PER_MEASURE}
                  beatValue={BEAT_VALUE}
                  width={thisCellWidth}
                  height={STAFF_HEIGHT_PX}
                  dimmed={isPast}
                  activeNoteIndex={isActive ? sessionState.currentNoteIndex - firstIdx : -1}
                  restIndices={sessionState.restIndices}
                  globalIndexOffset={firstIdx}
                  labels={measureLabelsMap.get(i)}
                  showFinalBarline={i === measureGroups.length - 1}
                  clef={clef}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Pitch indicator below rail */}
      <div className={styles.pitchDisplay}>
        <span className={styles.pitchLabel}>flat</span>
        <div className={styles.pitchBar}>
          <div className={styles.pitchCenter} />
          {noteResult && (
            <div
              className={styles.pitchNeedle}
              style={{
                left: `${50 + Math.max(-50, Math.min(50, noteResult.centsOffset))}%`,
              }}
            />
          )}
        </div>
        <span className={styles.pitchLabel}>sharp</span>
        {detectedPitch && noteResult && (
          <span className={styles.pitchNote}>{noteResult.note.name}</span>
        )}
      </div>

      {/* Progress footer */}
      <div className={styles.footer}>
        <span className={styles.progress}>
          {sessionState.currentNoteIndex} / {sessionState.totalNotes} notes
        </span>
        <span className={styles.score}>
          Correct: {correctCount} Wrong: {incorrectCount}
        </span>
      </div>
    </div>
  )
}
