import type { Note, SessionState, DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import { StaffNotation } from './StaffNotation.tsx'
import styles from './PracticeView.module.css'

interface PracticeViewProps {
  scaleNotes: Note[]
  sessionState: SessionState
  detectedPitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  onSkipNote: () => void
  ignoreOctave?: boolean
}

export function PracticeView({
  scaleNotes,
  sessionState,
  detectedPitch,
  noteResult,
  onSkipNote,
  ignoreOctave = false,
}: PracticeViewProps) {
  const holdProgress =
    sessionState.minHoldDetections > 0
      ? sessionState.currentHoldCount / sessionState.minHoldDetections
      : 0

  return (
    <div className={styles.container}>
      {/* Staff Notation */}
      <StaffNotation
        scaleNotes={scaleNotes}
        currentNoteIndex={sessionState.currentNoteIndex}
        lastResult={sessionState.lastResult}
        ignoreOctave={ignoreOctave}
      />

      {/* Pitch Indicator (cents) */}
      {noteResult && (
        <div className={styles.pitchIndicator}>
          <span className={styles.pitchLabel}>♭ flat</span>
          <div className={styles.pitchBar}>
            <div className={styles.pitchCenter} />
            <div
              className={styles.pitchNeedle}
              style={{
                left: `${50 + Math.max(-50, Math.min(50, noteResult.centsOffset))}%`,
              }}
            />
          </div>
          <span className={styles.pitchLabel}>sharp ♯</span>
        </div>
      )}

      {/* Hold Progress */}
      {holdProgress > 0 && holdProgress < 1 && (
        <div className={styles.holdProgress}>
          <div className={styles.holdBar}>
            <div
              className={styles.holdFill}
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
          <span className={styles.holdLabel}>Hold...</span>
        </div>
      )}

      {/* Feedback flash */}
      {sessionState.lastResult === 'correct' && (
        <div className={`${styles.flash} ${styles.flashCorrect}`} />
      )}
      {sessionState.lastResult === 'incorrect' && (
        <div className={`${styles.flash} ${styles.flashIncorrect}`} />
      )}

      {/* Progress + Skip */}
      <div className={styles.footer}>
        <span className={styles.progress}>
          {sessionState.currentNoteIndex} / {sessionState.totalNotes} notes
        </span>
        <span className={styles.score}>
          ✓ {sessionState.correctCount} &nbsp; ✗ {sessionState.incorrectCount}
        </span>
        <button className={styles.skipButton} onClick={onSkipNote}>
          Skip →
        </button>
      </div>
    </div>
  )
}
