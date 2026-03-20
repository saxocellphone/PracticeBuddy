import { useRef, useEffect, useCallback } from 'react'
import type { DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import {
  NOTE_DURATION_BEATS,
} from '@core/rhythm/types.ts'
import type {
  RhythmSessionState,
  RhythmEndlessState,
  RhythmNoteEvent,
} from '@core/rhythm/types.ts'
import { COUNTDOWN_BEATS } from '@hooks/useRhythmPractice.ts'
import { StaffNote } from './StaffNote.tsx'
import { HitMissFeedback } from './HitMissFeedback.tsx'
import styles from './RhythmPracticeView.module.css'

/** Width in pixels of a single quarter-note cell at the base scale */
const QUARTER_NOTE_WIDTH_PX = 160

/** Height of the staff notation rendering within each cell */
const STAFF_HEIGHT_PX = 180

/** Default time signature: 4/4 */
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

/** Extra width in the first measure cell for bass clef + time signature rendering.
 *  Must match CLEF_WIDTH (54) + TIME_SIG_WIDTH (28) in StaffNote.tsx */
const CLEF_TIME_SIG_WIDTH_PX = 82

interface RhythmPracticeViewProps {
  sessionState: RhythmSessionState
  rhythmState: RhythmEndlessState
  detectedPitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  onStop: () => void
}

export function RhythmPracticeView({
  sessionState,
  rhythmState,
  detectedPitch,
  noteResult,
  onStop,
}: RhythmPracticeViewProps) {
  const railTrackRef = useRef<HTMLDivElement>(null)
  const railContainerRef = useRef<HTMLDivElement>(null)
  const lastBeatRef = useRef(-1)
  const playheadRef = useRef<HTMLDivElement>(null)

  const noteDurationBeats = NOTE_DURATION_BEATS[sessionState.noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / noteDurationBeats)

  // Group noteEvents into measure-sized cells
  const measureGroups: RhythmNoteEvent[][] = []
  for (let i = 0; i < sessionState.noteEvents.length; i += notesPerMeasure) {
    measureGroups.push(sessionState.noteEvents.slice(i, i + notesPerMeasure))
  }

  // Each measure cell spans BEATS_PER_MEASURE beats
  const cellWidthPx = QUARTER_NOTE_WIDTH_PX * BEATS_PER_MEASURE

  // Calculate scroll position based on current time.
  // One cell = one beat = QUARTER_NOTE_WIDTH_PX pixels.
  // One beat takes (60 / bpm) seconds, so:
  const pixelsPerSecond = QUARTER_NOTE_WIDTH_PX * sessionState.bpm / 60
  const playheadOffsetPercent = 0.25 // 25% from left

  const updateRailPosition = useCallback(() => {
    if (!railTrackRef.current || !railContainerRef.current) return

    const containerWidth = railContainerRef.current.offsetWidth
    const playheadX = containerWidth * playheadOffsetPercent

    if (sessionState.phase !== 'playing') {
      railTrackRef.current.style.transform = `translateX(${playheadX - CLEF_TIME_SIG_WIDTH_PX}px)`
      return
    }

    const elapsed = sessionState.currentTime - sessionState.startTime
    const scrollX = elapsed * pixelsPerSecond

    railTrackRef.current.style.transform = `translateX(${playheadX - scrollX - CLEF_TIME_SIG_WIDTH_PX}px)`
  }, [
    sessionState.phase,
    sessionState.currentTime,
    sessionState.startTime,
    pixelsPerSecond,
    playheadOffsetPercent,
  ])

  useEffect(() => {
    updateRailPosition()
  }, [updateRailPosition])

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

        {/* Scrolling track */}
        <div className={styles.railTrack} ref={railTrackRef}>
          {measureGroups.map((group, i) => {
            const firstIdx = group[0].noteIndex
            const lastIdx = group[group.length - 1].noteIndex
            const isPast = lastIdx < sessionState.currentNoteIndex
            const isActive =
              sessionState.currentNoteIndex >= firstIdx &&
              sessionState.currentNoteIndex <= lastIdx

            const thisCellWidth = i === 0 ? cellWidthPx + CLEF_TIME_SIG_WIDTH_PX : cellWidthPx

            return (
              <div
                key={firstIdx}
                className={`${styles.noteCell} ${isActive ? styles.noteCellActive : ''} ${isPast ? styles.noteCellPast : ''}`}
                style={{ width: `${thisCellWidth}px` }}
              >
                {/* Staff notation — notes grouped per measure */}
                <StaffNote
                  notes={group.map((e) => ({
                    note: e.expectedNote,
                    duration: sessionState.noteDuration,
                  }))}
                  showClef={i === 0}
                  showTimeSignature={i === 0}
                  beatsPerMeasure={BEATS_PER_MEASURE}
                  beatValue={BEAT_VALUE}
                  width={thisCellWidth}
                  height={STAFF_HEIGHT_PX}
                  dimmed={isPast}
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
