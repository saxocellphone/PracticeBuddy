import type { WalkingBassSessionState } from '@core/walking-bass/types.ts'
import { ResultsLayout } from '@components/common/ResultsLayout.tsx'
import { resultsStyles as styles } from '@components/common/resultsStyles.ts'
import type { StatItem, BreakdownItem } from '@components/common/ResultsLayout.tsx'

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

  const totalNotes = cumulativeStats.totalNotes
  const accuracyPercent = totalNotes > 0
    ? (cumulativeStats.correctNotes / totalNotes) * 100
    : 0

  const stats: StatItem[] = [
    { value: cumulativeStats.runsCompleted, label: 'Chords', color: 'rgba(245, 158, 11, 1)' },
    { value: cumulativeStats.correctNotes, label: 'Correct', color: 'var(--color-correct)' },
    { value: cumulativeStats.incorrectNotes, label: 'Wrong', color: 'var(--color-incorrect)' },
    { value: cumulativeStats.missedNotes, label: 'Missed', color: 'var(--color-missed)' },
  ]

  const breakdownItems: BreakdownItem[] = results.map((result) => {
    const itemAccuracy = result.score.totalNotes > 0
      ? (result.score.correctNotes / result.score.totalNotes) * 100
      : 0

    return {
      label: result.label,
      scorePercent: itemAccuracy,
      detail: (
        <div className={styles.noteList}>
          {result.notes.map((note, j) => {
            const isCorrect = j < result.score.correctNotes
            const resultClass = isCorrect ? 'correct' : 'incorrect'
            return (
              <div
                key={j}
                className={`${styles.noteItem} ${styles[`noteItem_${resultClass}` as keyof typeof styles] ?? ''}`}
              >
                <span className={styles.noteExpected}>{note.name}</span>
                <span className={styles.noteBadge}>Beat {j + 1}</span>
              </div>
            )
          })}
        </div>
      ),
    }
  })

  return (
    <ResultsLayout
      scorePercent={accuracyPercent}
      stats={stats}
      breakdownTitle="Chord Breakdown"
      breakdownItems={breakdownItems}
      onRetry={onRetry}
      onGoHome={onGoHome}
      onBackToSetup={onBackToSetup}
      retryButtonColor="rgba(245, 158, 11, 1)"
    />
  )
}
