import type { EndlessSessionState } from '@core/endless/types.ts'
import type { SessionScore } from '@core/wasm/types.ts'
import styles from './EndlessBanner.module.css'

interface EndlessBannerProps {
  endlessState: EndlessSessionState
  /** The score of the just-completed scale (shown during transition) */
  lastCompletedScore: SessionScore | null
}

export function EndlessBanner({
  endlessState,
  lastCompletedScore,
}: EndlessBannerProps) {
  const { phase, sequence, currentStepIndex, completedLoops, cumulativeStats } =
    endlessState

  // During transition, show the interstitial
  if (phase === 'transitioning') {
    const nextLabel = endlessState.currentLabel

    return (
      <div className={styles.transition}>
        {lastCompletedScore && (
          <>
            <span className={styles.transitionComplete}>Scale Complete!</span>
            <div className={styles.transitionScore}>
              <div className={styles.transitionStat}>
                <span
                  className={styles.transitionStatValue}
                  style={{ color: 'var(--color-correct)' }}
                >
                  {Math.round(lastCompletedScore.accuracyPercent)}%
                </span>
                <span className={styles.transitionStatLabel}>Accuracy</span>
              </div>
              <div className={styles.transitionStat}>
                <span
                  className={styles.transitionStatValue}
                  style={{ color: 'var(--color-correct)' }}
                >
                  {lastCompletedScore.correctNotes}
                </span>
                <span className={styles.transitionStatLabel}>Correct</span>
              </div>
              <div className={styles.transitionStat}>
                <span
                  className={styles.transitionStatValue}
                  style={{ color: 'var(--color-incorrect)' }}
                >
                  {lastCompletedScore.incorrectNotes}
                </span>
                <span className={styles.transitionStatLabel}>Wrong</span>
              </div>
            </div>
          </>
        )}

        <span className={styles.transitionNextLabel}>Next up</span>
        <span className={styles.transitionNextName}>{nextLabel}</span>

        <div className={styles.transitionBar}>
          <div className={styles.transitionBarFill} />
        </div>
      </div>
    )
  }

  // During playing, show the compact banner
  const shift = sequence.shiftSemitones ?? 0
  const shiftLabel = shift > 0 && completedLoops > 0
    ? ` — shifting by ${shift === 1 ? 'half steps' : shift === 2 ? 'whole steps' : shift === 7 ? '5ths' : `${shift} semitones`}`
    : ''
  const loopLabel = completedLoops > 0 ? ` (Loop ${completedLoops + 1}${shiftLabel})` : ''

  return (
    <div className={styles.banner}>
      <div className={styles.scaleInfo}>
        <span className={styles.scaleLabel}>{endlessState.currentLabel}</span>
        <span className={styles.scaleMeta}>
          Scale {currentStepIndex + 1} of {sequence.steps.length}
          {loopLabel}
        </span>
      </div>

      {/* Sequence dots */}
      <div className={styles.dots}>
        {sequence.steps.map((_, i) => {
          let dotClass = styles.dot
          if (i < currentStepIndex) {
            dotClass += ` ${styles.dotDone}`
          } else if (i === currentStepIndex) {
            dotClass += ` ${styles.dotCurrent}`
          }
          return <div key={i} className={dotClass} />
        })}
      </div>

      {/* Coming up preview */}
      {endlessState.nextLabel && (
        <span className={styles.comingUp}>
          Coming up: {endlessState.nextLabel}
        </span>
      )}

      {/* Running accuracy */}
      {cumulativeStats.totalScalesCompleted > 0 && (
        <span className={styles.accuracy}>
          {Math.round(cumulativeStats.overallAccuracyPercent)}%
        </span>
      )}
    </div>
  )
}
