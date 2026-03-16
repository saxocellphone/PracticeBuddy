import type { SessionScore } from '@core/wasm/types.ts'
import styles from './SessionResults.module.css'

interface SessionResultsProps {
  score: SessionScore
  onRetry: () => void
  onChangeScale: () => void
}

export function SessionResults({ score, onRetry, onChangeScale }: SessionResultsProps) {
  const accuracyColor =
    score.accuracyPercent >= 80
      ? 'var(--color-correct)'
      : score.accuracyPercent >= 50
        ? 'var(--color-warning)'
        : 'var(--color-incorrect)'

  return (
    <div className={styles.container}>
      {/* Score Summary */}
      <div className={styles.summary}>
        <div className={styles.accuracyCircle} style={{ borderColor: accuracyColor }}>
          <span className={styles.accuracyValue} style={{ color: accuracyColor }}>
            {Math.round(score.accuracyPercent)}%
          </span>
          <span className={styles.accuracyLabel}>Accuracy</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-correct)' }}>
              {score.correctNotes}
            </span>
            <span className={styles.statLabel}>Correct</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-incorrect)' }}>
              {score.incorrectNotes}
            </span>
            <span className={styles.statLabel}>Wrong</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-missed)' }}>
              {score.missedNotes}
            </span>
            <span className={styles.statLabel}>Missed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {score.averageCentsOffset.toFixed(1)}
            </span>
            <span className={styles.statLabel}>Avg cents off</span>
          </div>
        </div>
      </div>

      {/* Note-by-note results */}
      <div className={styles.noteResults}>
        <h3 className={styles.sectionTitle}>Note Details</h3>
        <div className={styles.noteList}>
          {score.noteResults.map((attempt, i) => (
            <div
              key={i}
              className={`${styles.noteItem} ${styles[`noteItem_${attempt.result}`]}`}
            >
              <span className={styles.noteExpected}>
                {attempt.expectedNote.name}
              </span>
              <span className={styles.noteArrow}>→</span>
              <span className={styles.noteDetected}>
                {attempt.detectedNote ? attempt.detectedNote.name : '—'}
              </span>
              <span className={styles.noteCents}>
                {attempt.result === 'correct'
                  ? `${attempt.centsOff > 0 ? '+' : ''}${attempt.centsOff.toFixed(1)}¢`
                  : attempt.result}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.retryButton} onClick={onRetry}>
          Practice Again
        </button>
        <button className={styles.changeButton} onClick={onChangeScale}>
          Change Scale
        </button>
      </div>
    </div>
  )
}
