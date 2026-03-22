import type { ScaleSessionState } from '@core/endless/types.ts'
import styles from './ScaleBanner.module.css'

interface ScaleBannerProps {
  scaleState: ScaleSessionState
}

export function ScaleBanner({
  scaleState,
}: ScaleBannerProps) {
  const { sequence, currentStepIndex, completedLoops, cumulativeStats } =
    scaleState

  const shift = sequence.shiftSemitones ?? 0
  const shiftLabel = shift > 0 && completedLoops > 0
    ? ` — shifting by ${shift === 1 ? 'half steps' : shift === 2 ? 'whole steps' : shift === 7 ? '5ths' : `${shift} semitones`}`
    : ''
  const loopLabel = completedLoops > 0 ? ` (Loop ${completedLoops + 1}${shiftLabel})` : ''

  return (
    <div className={styles.banner}>
      <div className={styles.scaleInfo}>
        <span className={styles.scaleLabel}>{scaleState.currentLabel}</span>
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
      {scaleState.nextLabel && (
        <span className={styles.comingUp}>
          Coming up: {scaleState.nextLabel}
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
