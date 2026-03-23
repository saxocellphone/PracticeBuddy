import { useState } from 'react'
import type { WalkingBassSessionState } from '@core/walking-bass/types.ts'
import styles from './WalkingBassResults.module.css'

interface WalkingBassResultsProps {
  sessionState: WalkingBassSessionState
  onRetry: () => void
  onGoHome: () => void
  onBackToSetup?: () => void
}

export function WalkingBassResults({
  sessionState,
  onRetry,
  onGoHome,
  onBackToSetup,
}: WalkingBassResultsProps) {
  const { results, cumulativeStats } = sessionState
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const totalNotes = cumulativeStats.totalNotes
  const accuracyPercent = totalNotes > 0
    ? (cumulativeStats.correctNotes / totalNotes) * 100
    : 0

  const accuracyColor =
    accuracyPercent >= 80
      ? 'var(--color-correct)'
      : accuracyPercent >= 50
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
            {Math.round(accuracyPercent)}%
          </span>
          <span className={styles.accuracyLabel}>Accuracy</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'rgba(245, 158, 11, 1)' }}>
              {cumulativeStats.runsCompleted}
            </span>
            <span className={styles.statLabel}>Chords</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-correct)' }}>
              {cumulativeStats.correctNotes}
            </span>
            <span className={styles.statLabel}>Correct</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-incorrect)' }}>
              {cumulativeStats.incorrectNotes}
            </span>
            <span className={styles.statLabel}>Wrong</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: 'var(--color-missed)' }}>
              {cumulativeStats.missedNotes}
            </span>
            <span className={styles.statLabel}>Missed</span>
          </div>
        </div>
      </div>

      {/* Per-Chord Breakdown */}
      {results.length > 0 && (
        <div className={styles.breakdown}>
          <h3 className={styles.sectionTitle}>Chord Breakdown</h3>
          <div className={styles.itemList}>
            {results.map((result, i) => {
              const isExpanded = expandedIndex === i
              const itemAccuracy = result.score.totalNotes > 0
                ? (result.score.correctNotes / result.score.totalNotes) * 100
                : 0
              const itemAccuracyColor =
                itemAccuracy >= 80
                  ? 'var(--color-correct)'
                  : itemAccuracy >= 50
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
                      {Math.round(itemAccuracy)}%
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
                        {result.notes.map((note, j) => {
                          const isCorrect = j < result.score.correctNotes
                          const resultClass = isCorrect ? 'correct' : 'incorrect'
                          return (
                            <div
                              key={j}
                              className={`${styles.noteItem} ${styles[`noteItem_${resultClass}`]}`}
                            >
                              <span className={styles.noteExpected}>
                                {note.name}
                              </span>
                              <span className={styles.noteResult}>
                                Beat {j + 1}
                              </span>
                            </div>
                          )
                        })}
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
