import { useState } from 'react'
import type { ArpeggioSessionState } from '@core/arpeggio/types.ts'
import styles from './ArpeggioResults.module.css'

interface ArpeggioResultsProps {
  sessionState: ArpeggioSessionState
  onRetry: () => void
  onGoHome: () => void
  onBackToSetup?: () => void
}

export function ArpeggioResults({
  sessionState,
  onRetry,
  onGoHome,
  onBackToSetup,
}: ArpeggioResultsProps) {
  const { results, cumulativeStats } = sessionState
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const accuracyColor =
    cumulativeStats.overallAccuracyPercent >= 80
      ? 'var(--color-correct)'
      : cumulativeStats.overallAccuracyPercent >= 50
        ? 'var(--color-warning)'
        : 'var(--color-incorrect)'

  return (
    <div className={styles.container}>
      {/* Summary */}
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
            <span className={styles.statValue} style={{ color: 'rgba(6, 182, 212, 1)' }}>
              {cumulativeStats.totalArpeggiosCompleted}
            </span>
            <span className={styles.statLabel}>Arpeggios</span>
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

      {/* Per-Arpeggio Breakdown */}
      {results.length > 0 && (
        <div className={styles.breakdown}>
          <h3 className={styles.sectionTitle}>Arpeggio Breakdown</h3>
          <div className={styles.itemList}>
            {results.map((result, i) => {
              const isExpanded = expandedIndex === i
              const itemAccuracyColor =
                result.score.accuracyPercent >= 80
                  ? 'var(--color-correct)'
                  : result.score.accuracyPercent >= 50
                    ? 'var(--color-warning)'
                    : 'var(--color-incorrect)'

              return (
                <div key={i} className={styles.item}>
                  <button
                    className={styles.itemHeader}
                    onClick={() =>
                      setExpandedIndex(isExpanded ? null : i)
                    }
                  >
                    <span className={styles.itemIndex}>{i + 1}</span>
                    <span className={styles.itemName}>{result.label}</span>
                    <span
                      className={styles.itemAccuracy}
                      style={{ color: itemAccuracyColor }}
                    >
                      {Math.round(result.score.accuracyPercent)}%
                    </span>
                    <span
                      className={`${styles.itemToggle} ${isExpanded ? styles.itemToggleOpen : ''}`}
                    >
                      &#9658;
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.itemDetails}>
                      <div className={styles.noteList}>
                        {result.score.noteResults.map((attempt, j) => (
                          <div
                            key={j}
                            className={`${styles.noteItem} ${styles[`noteItem_${attempt.result}`]}`}
                          >
                            <span className={styles.noteExpected}>
                              {attempt.expectedNote.name}
                            </span>
                            <span className={styles.noteArrow}>&rarr;</span>
                            <span className={styles.noteDetected}>
                              {attempt.detectedNote
                                ? attempt.detectedNote.name
                                : '\u2014'}
                            </span>
                            <span className={styles.noteCents}>
                              {attempt.result === 'correct'
                                ? `${attempt.centsOff > 0 ? '+' : ''}${attempt.centsOff.toFixed(1)}\u00A2`
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
