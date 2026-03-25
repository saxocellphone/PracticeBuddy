import type { ArpeggioSessionState } from '@core/arpeggio/types.ts'
import { ResultsLayout } from '@components/common/ResultsLayout.tsx'
import { resultsStyles as styles } from '@components/common/resultsStyles.ts'
import type { StatItem, BreakdownItem } from '@components/common/ResultsLayout.tsx'

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

  const stats: StatItem[] = [
    { value: cumulativeStats.totalArpeggiosCompleted, label: 'Arpeggios', color: 'rgba(6, 182, 212, 1)' },
    { value: cumulativeStats.totalCorrect, label: 'Correct', color: 'var(--color-correct)' },
    { value: cumulativeStats.totalIncorrect, label: 'Wrong', color: 'var(--color-incorrect)' },
    { value: cumulativeStats.totalMissed, label: 'Missed', color: 'var(--color-missed)' },
    { value: cumulativeStats.averageCentsOffset.toFixed(1), label: 'Avg cents off', color: 'var(--color-text-primary)' },
  ]

  const breakdownItems: BreakdownItem[] = results.map((result) => ({
    label: result.label,
    scorePercent: result.score.accuracyPercent,
    detail: (
      <div className={styles.noteList}>
        {result.score.noteResults.map((attempt, j) => (
          <div
            key={j}
            className={`${styles.noteItem} ${styles[`noteItem_${attempt.result}` as keyof typeof styles] ?? ''}`}
          >
            <span className={styles.noteExpected}>{attempt.expectedNote.name}</span>
            <span className={styles.noteArrow}>&rarr;</span>
            <span className={styles.noteDetected}>
              {attempt.detectedNote ? attempt.detectedNote.name : '\u2014'}
            </span>
            <span className={styles.noteBadge}>
              {attempt.result === 'correct'
                ? `${attempt.centsOff > 0 ? '+' : ''}${attempt.centsOff.toFixed(1)}\u00A2`
                : attempt.result}
            </span>
          </div>
        ))}
      </div>
    ),
  }))

  return (
    <ResultsLayout
      scorePercent={cumulativeStats.overallAccuracyPercent}
      stats={stats}
      breakdownTitle="Arpeggio Breakdown"
      breakdownItems={breakdownItems}
      onRetry={onRetry}
      onGoHome={onGoHome}
      onBackToSetup={onBackToSetup}
      retryButtonColor="rgba(6, 182, 212, 1)"
    />
  )
}
