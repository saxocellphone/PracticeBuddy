import { useState } from 'react'
import type { ScaleSessionState } from '@core/endless/types.ts'
import styles from './ScaleResults.module.css'

interface ScaleResultsProps {
  scaleState: ScaleSessionState
  onRetry: () => void
  onGoHome: () => void
  onBackToSetup?: () => void
}

export function ScaleResults({
  scaleState,
  onRetry,
  onGoHome,
  onBackToSetup,
}: ScaleResultsProps) {
  const { results, cumulativeStats } = scaleState
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const accuracyColor =
    cumulativeStats.overallAccuracyPercent >= 80
      ? 'var(--color-correct)'
      : cumulativeStats.overallAccuracyPercent >= 50
        ? 'var(--color-warning)'
        : 'var(--color-incorrect)'

  return (
    <div className={styles.container}>
      {/* Cumulative Summary */}
      <div className={styles.summary}>
        <div
          className={styles.accuracyCircle}
          style={{ borderColor: accuracyColor }}
        >
          <span className={styles.accuracyValue} style={{ color: accuracyColor }}>
            {Math.round(cumulativeStats.overallAccuracyPercent)}%
          </span>
          <span className={styles.accuracyLabel}>Accuracy</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-accent)' }}>
              {cumulativeStats.totalScalesCompleted}
            </span>
            <span className={styles.statLabel}>Scales</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-correct)' }}>
              {cumulativeStats.totalCorrect}
            </span>
            <span className={styles.statLabel}>Correct</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-incorrect)' }}>
              {cumulativeStats.totalIncorrect}
            </span>
            <span className={styles.statLabel}>Wrong</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-missed)' }}>
              {cumulativeStats.totalMissed}
            </span>
            <span className={styles.statLabel}>Missed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {cumulativeStats.averageCentsOffset.toFixed(1)}
            </span>
            <span className={styles.statLabel}>Avg cents off</span>
          </div>
        </div>
      </div>

      {/* Per-Scale Breakdown */}
      {results.length > 0 && (
        <div className={styles.scaleBreakdown}>
          <h3 className={styles.sectionTitle}>Scale Breakdown</h3>
          <div className={styles.scaleList}>
            {results.map((result, i) => {
              const isExpanded = expandedIndex === i
              const itemAccuracyColor =
                result.score.accuracyPercent >= 80
                  ? 'var(--color-correct)'
                  : result.score.accuracyPercent >= 50
                    ? 'var(--color-warning)'
                    : 'var(--color-incorrect)'

              return (
                <div key={i} className={styles.scaleItem}>
                  <button
                    className={styles.scaleItemHeader}
                    onClick={() =>
                      setExpandedIndex(isExpanded ? null : i)
                    }
                  >
                    <span className={styles.scaleItemIndex}>{i + 1}</span>
                    <span className={styles.scaleItemName}>
                      {result.label}
                    </span>
                    <span
                      className={styles.scaleItemAccuracy}
                      style={{ color: itemAccuracyColor }}
                    >
                      {Math.round(result.score.accuracyPercent)}%
                    </span>
                    <span
                      className={`${styles.scaleItemToggle} ${isExpanded ? styles.scaleItemToggleOpen : ''}`}
                    >
                      ▸
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.scaleItemDetails}>
                      <div className={styles.noteList}>
                        {result.score.noteResults.map((attempt, j) => (
                          <div
                            key={j}
                            className={`${styles.noteItem} ${styles[`noteItem_${attempt.result}`]}`}
                          >
                            <span className={styles.noteExpected}>
                              {attempt.expectedNote.name}
                            </span>
                            <span className={styles.noteArrow}>→</span>
                            <span className={styles.noteDetected}>
                              {attempt.detectedNote
                                ? attempt.detectedNote.name
                                : '—'}
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.retryButton} onClick={onRetry}>
          Practice Again
        </button>
        {onBackToSetup && (
          <button className={styles.secondaryButton} onClick={onBackToSetup}>
            Change Settings
          </button>
        )}
        <button className={styles.secondaryButton} onClick={onGoHome}>
          Home
        </button>
      </div>
    </div>
  )
}
