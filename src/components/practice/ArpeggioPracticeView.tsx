import { useMemo } from 'react'
import type { SessionState, DetectedPitch, FrequencyToNoteResult, SessionScore } from '@core/wasm/types.ts'
import type { ArpeggioSessionState } from '@core/arpeggio/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { MeasureLabel } from '@core/notation'
import { SheetMusic, groupNotesIntoMeasures, getKeySignature } from '@core/notation'
import { PracticeLayout } from './PracticeLayout.tsx'
import styles from './ArpeggioPracticeView.module.css'

interface ArpeggioPracticeViewProps {
  arpeggioState: ArpeggioSessionState
  sessionState: SessionState | null
  detectedPitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  onSkipNote: () => void
  onStop: () => void
  clef?: ClefType
}

export function ArpeggioPracticeView({
  arpeggioState,
  sessionState,
  noteResult,
  onSkipNote,
  onStop,
  clef,
}: ArpeggioPracticeViewProps) {
  const {
    sequence,
    currentStepIndex,
    completedLoops,
    results,
    currentNotes,
    currentLabel,
    nextLabel,
    cumulativeStats,
  } = arpeggioState

  // Detect transition: inner session done but arpeggio session still playing
  const isTransitioning = sessionState?.phase === 'Complete' && arpeggioState.phase === 'playing'

  // Last completed score for transition display
  const lastCompletedScore: SessionScore | null = useMemo(() => {
    if (isTransitioning && results.length > 0) {
      return results[results.length - 1].score
    }
    return null
  }, [isTransitioning, results])

  const holdProgress =
    sessionState && sessionState.minHoldDetections > 0
      ? sessionState.currentHoldCount / sessionState.minHoldDetections
      : 0

  const shift = sequence.shiftSemitones ?? 0
  const shiftLabel =
    shift > 0 && completedLoops > 0
      ? ` \u2014 shifting by ${shift === 1 ? 'half steps' : shift === 2 ? 'whole steps' : shift === 7 ? '5ths' : `${shift} semitones`}`
      : ''
  const loopLabel = completedLoops > 0 ? ` (Loop ${completedLoops + 1}${shiftLabel})` : ''

  const keySig = useMemo(() => getKeySignature(currentNotes), [currentNotes])

  const measureLabels = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()
    if (currentLabel) {
      labels.set(0, [{ noteIndex: 0, text: currentLabel }])
    }
    return labels
  }, [currentLabel])

  const measures = useMemo(
    () => groupNotesIntoMeasures(currentNotes, 'quarter', { measureLabels }),
    [currentNotes, measureLabels],
  )

  // Banner header
  const banner = (
    <>
      <div className={styles.banner}>
        <div className={styles.bannerInfo}>
          <span className={styles.bannerMeta}>
            Arpeggio {currentStepIndex + 1} of {sequence.steps.length}
            {loopLabel}
          </span>
        </div>

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

        {nextLabel && !isTransitioning && (
          <span className={styles.comingUp}>
            Next: {nextLabel}
          </span>
        )}

        {cumulativeStats.totalArpeggiosCompleted > 0 && (
          <span className={styles.accuracy}>
            {Math.round(cumulativeStats.overallAccuracyPercent)}%
          </span>
        )}
      </div>

      {/* Transition interstitial */}
      {isTransitioning && (
        <div className={styles.transition}>
          {lastCompletedScore && (
            <>
              <span className={styles.transitionComplete}>Arpeggio Complete!</span>
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
          <span className={styles.transitionNextName}>{currentLabel}</span>

          <div className={styles.transitionBar}>
            <div className={styles.transitionBarFill} />
          </div>
        </div>
      )}
    </>
  )

  // Stop button as controls
  const controls = (
    <div className={styles.stopRow}>
      <button className={styles.stopButton} onClick={onStop}>
        Stop Practice
      </button>
    </div>
  )

  // During transition, hide the notation/feedback but keep header + controls
  if (isTransitioning || !sessionState) {
    return (
      <PracticeLayout
        header={banner}
        notation={<></>}
        noteResult={null}
        holdProgress={0}
        lastResult={null}
        footer={<></>}
        controls={controls}
      />
    )
  }

  return (
    <PracticeLayout
      header={banner}
      notation={
        <SheetMusic
          measures={measures}
          keySignature={keySig}
          lineWrap="width"
          activeNote={{
            currentNoteIndex: sessionState.currentNoteIndex,
            autoScroll: true,
          }}
          hideAccidentals={keySig.type !== 'none'}
          clef={clef}
        />
      }
      noteResult={noteResult}
      holdProgress={holdProgress}
      lastResult={sessionState.lastResult}
      footer={
        <>
          <span className={styles.progress}>
            {sessionState.currentNoteIndex} / {sessionState.totalNotes} notes
          </span>
          <span className={styles.score}>
            {'\u2713'} {sessionState.correctCount} &nbsp; {'\u2717'} {sessionState.incorrectCount}
          </span>
          <button className={styles.skipButton} onClick={onSkipNote}>
            Skip {'\u2192'}
          </button>
        </>
      }
      controls={controls}
    />
  )
}
