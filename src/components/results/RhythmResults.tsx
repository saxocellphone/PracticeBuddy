import { scoreNote, scoreLabel } from '@core/rhythm/types.ts'
import type { RhythmScaleState, RhythmNoteEvent } from '@core/rhythm/types.ts'
import { ResultsLayout } from '@components/common/ResultsLayout.tsx'
import { resultsStyles as styles } from '@components/common/resultsStyles.ts'
import type { StatItem, BreakdownItem } from '@components/common/ResultsLayout.tsx'

function getLabelColor(points: number): string {
  if (points >= 10) return 'var(--color-correct)'
  if (points >= 8) return '#22d3ee'
  if (points >= 5) return 'var(--color-warning)'
  if (points >= 2) return 'var(--color-warning)'
  if (points >= 1) return 'var(--color-incorrect)'
  return 'var(--color-text-muted)'
}

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

  const stats: StatItem[] = [
    { value: cumulativeStats.totalNotesAttempted, label: 'Notes', color: 'var(--color-accent)' },
    { value: greatCount, label: 'Great', color: 'var(--color-correct)' },
    { value: goodCount, label: 'Good', color: '#22d3ee' },
    { value: okCount, label: 'OK', color: 'var(--color-warning)' },
    { value: lateCount, label: 'Late', color: 'var(--color-warning)' },
    { value: wrongCount, label: 'Wrong', color: 'var(--color-incorrect)' },
    { value: missedCount, label: 'Missed', color: 'var(--color-text-muted)' },
  ]

  const breakdownItems: BreakdownItem[] = results.map((result) => ({
    label: result.label,
    scorePercent: result.scorePercent,
    detail: (
      <div className={styles.noteList}>
        {result.noteEvents.map((event, j) => {
          const points = getNotePoints(event)
          const label = scoreLabel(points)
          const labelColor = getLabelColor(points)
          const rowClass = getNoteRowClass(points)

          return (
            <div key={j} className={`${styles.noteItem} ${rowClass}`}>
              <span className={styles.noteExpected}>{event.expectedNote.name}</span>
              <span className={styles.noteArrow}>&rarr;</span>
              <span className={styles.noteDetected}>
                {event.detectedNote ? event.detectedNote.name : '\u2014'}
              </span>
              <span className={styles.noteBadge} style={{ color: labelColor }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    ),
  }))

  return (
    <ResultsLayout
      scorePercent={cumulativeStats.overallScorePercent}
      scoreLabel="Score"
      stats={stats}
      breakdownTitle="Scale Breakdown"
      breakdownItems={breakdownItems}
      onRetry={onRetry}
      onGoHome={onGoHome}
      onBackToSetup={onBackToSetup}
    />
  )
}
