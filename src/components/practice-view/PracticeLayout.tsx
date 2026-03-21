import type { ReactNode } from 'react'
import type { FrequencyToNoteResult } from '@core/wasm/types.ts'
import styles from './PracticeLayout.module.css'

interface PracticeLayoutProps {
  /** Content rendered before the practice area (banners, transition screens) */
  header?: ReactNode
  /** The staff notation content (ScaleStaff, etc.) */
  notation: ReactNode
  /** Pitch detection result — drives the cents indicator bar */
  noteResult: FrequencyToNoteResult | null
  /** Hold progress as a fraction (0 to 1). Shown only when > 0 and < 1. */
  holdProgress: number
  /** Last result string from SessionState — drives the feedback flash */
  lastResult: string | null
  /** Footer content: progress text, score, skip button, etc. */
  footer: ReactNode
  /** Additional controls below the main area (stop button, metronome, etc.) */
  controls?: ReactNode
}

/**
 * Shared layout for self-paced practice modes (scales, arpeggios, and future modes).
 * Provides consistent sizing, spacing, and visual treatment for staff notation,
 * pitch feedback, hold progress, and feedback flash.
 *
 * NOT intended for rhythm mode, which has a fundamentally different layout
 * (dark scrolling rail with playhead).
 */
export function PracticeLayout({
  header,
  notation,
  noteResult,
  holdProgress,
  lastResult,
  footer,
  controls,
}: PracticeLayoutProps) {
  return (
    <div className={styles.outer}>
      {header}

      <div className={styles.practiceArea}>
        {/* Staff Notation */}
        {notation}

        {/* Pitch Indicator (cents) */}
        {noteResult && (
          <div className={styles.pitchIndicator}>
            <span className={styles.pitchLabel}>{'\u266D'} flat</span>
            <div className={styles.pitchBar}>
              <div className={styles.pitchCenter} />
              <div
                className={styles.pitchNeedle}
                style={{
                  left: `${50 + Math.max(-50, Math.min(50, noteResult.centsOffset))}%`,
                }}
              />
            </div>
            <span className={styles.pitchLabel}>sharp {'\u266F'}</span>
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
        {lastResult === 'correct' && (
          <div className={`${styles.flash} ${styles.flashCorrect}`} />
        )}
        {lastResult === 'incorrect' && (
          <div className={`${styles.flash} ${styles.flashIncorrect}`} />
        )}

        {/* Footer */}
        <div className={styles.footer}>
          {footer}
        </div>
      </div>

      {controls}
    </div>
  )
}
