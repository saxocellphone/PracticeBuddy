import { useState } from 'react'
import { scoreNote, scoreLabel } from '@core/rhythm/types.ts'
import type { RhythmScaleState, RhythmNoteEvent } from '@core/rhythm/types.ts'
import styles from './RhythmResults.module.css'

function getScoreColor(percent: number): string {
  if (percent >= 80) return 'var(--color-correct)'
  if (percent >= 50) return 'var(--color-warning)'
  return 'var(--color-incorrect)'
}

/** Color for a per-note score label */
function getLabelColor(points: number): string {
  if (points >= 10) return 'var(--color-correct)'   // Great
  if (points >= 8) return '#22d3ee'                  // Good (cyan)
  if (points >= 5) return 'var(--color-warning)'     // OK
  if (points >= 2) return 'var(--color-warning)'     // Late
  if (points >= 1) return 'var(--color-incorrect)'   // Wrong note
  return 'var(--color-text-muted)'                   // Missed
}

/** Background color class for per-note rows */
function getNoteRowClass(points: number): string {
  if (points >= 8) return styles.noteItem_great
  if (points >= 5) return styles.noteItem_ok
  if (points >= 1) return styles.noteItem_wrong
  return styles.noteItem_missed
}

function getNotePoints(event: RhythmNoteEvent): number {
  return scoreNote(event.pitchCorrect, event.timingResult)
}

interface RhythmResultsProps {
  rhythmState: RhythmScaleState
  onRetry: () => void
  onGoHome: () => void
  onBackToSetup?: () => void
}

export function RhythmResults({
  rhythmState,
  onRetry,
  onGoHome,
  onBackToSetup,
}: RhythmResultsProps) {
  const { results, cumulativeStats } = rhythmState
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const scoreColor = getScoreColor(cumulativeStats.overallScorePercent)

  // Compute label counts across all events for the stats bar
  let greatCount = 0
  let goodCount = 0
  let okCount = 0
  let lateCount = 0
  let wrongCount = 0
  let missedCount = 0

  for (const result of results) {
    for (const event of result.noteEvents) {
      const points = getNotePoints(event)
      if (points >= 10) greatCount++
      else if (points >= 8) goodCount++
      else if (points >= 5) okCount++
      else if (points >= 2) lateCount++
      else if (points >= 1) wrongCount++
      else missedCount++
    }
  }

  return (
    <div className={styles.container}>
      {/* Summary with single unified score circle */}
      <div className={styles.summary}>
        <div
          className={styles.scoreCircle}
          style={{ borderColor: scoreColor }}
        >
          <span className={styles.scoreValue} style={{ color: scoreColor }}>
            {Math.round(cumulativeStats.overallScorePercent)}%
          </span>
          <span className={styles.scoreLabel}>Score</span>
        </div>

        {/* Stats bar */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-accent)' }}
            >
              {cumulativeStats.totalNotesAttempted}
            </span>
            <span className={styles.statLabel}>Notes</span>
          </div>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-correct)' }}
            >
              {greatCount}
            </span>
            <span className={styles.statLabel}>Great</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#22d3ee' }}>
              {goodCount}
            </span>
            <span className={styles.statLabel}>Good</span>
          </div>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-warning)' }}
            >
              {okCount}
            </span>
            <span className={styles.statLabel}>OK</span>
          </div>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-warning)' }}
            >
              {lateCount}
            </span>
            <span className={styles.statLabel}>Late</span>
          </div>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-incorrect)' }}
            >
              {wrongCount}
            </span>
            <span className={styles.statLabel}>Wrong</span>
          </div>
          <div className={styles.stat}>
            <span
              className={styles.statValue}
              style={{ color: 'var(--color-text-muted)' }}
            >
              {missedCount}
            </span>
            <span className={styles.statLabel}>Missed</span>
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
              const itemScoreColor = getScoreColor(result.scorePercent)

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
                      style={{ color: itemScoreColor }}
                    >
                      {Math.round(result.scorePercent)}%
                    </span>
                    <span
                      className={`${styles.scaleItemToggle} ${isExpanded ? styles.scaleItemToggleOpen : ''}`}
                    >
                      &#9658;
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.scaleItemDetails}>
                      <div className={styles.noteList}>
                        {result.noteEvents.map((event, j) => {
                          const points = getNotePoints(event)
                          const label = scoreLabel(points)
                          const labelColor = getLabelColor(points)
                          const rowClass = getNoteRowClass(points)

                          return (
                            <div
                              key={j}
                              className={`${styles.noteItem} ${rowClass}`}
                            >
                              <span className={styles.noteExpected}>
                                {event.expectedNote.name}
                              </span>
                              <span className={styles.noteArrow}>
                                &rarr;
                              </span>
                              <span className={styles.noteDetected}>
                                {event.detectedNote
                                  ? event.detectedNote.name
                                  : '\u2014'}
                              </span>
                              <span
                                className={styles.scoreBadge}
                                style={{ color: labelColor }}
                              >
                                {label}
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
