import type { Note, SessionState, DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import type { PositionedChordSymbol } from '@core/endless/types.ts'
import { ScaleStaff } from '@core/notation'
import { PracticeLayout } from './PracticeLayout.tsx'
import styles from './PracticeView.module.css'

interface PracticeViewProps {
  scaleNotes: Note[]
  sessionState: SessionState
  detectedPitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  onSkipNote: () => void
  /** Single chord symbol for individual mode */
  chordSymbol?: string | null
  /** Positioned chord symbols for combined mode */
  chordSymbols?: PositionedChordSymbol[]
}

export function PracticeView({
  scaleNotes,
  sessionState,
  noteResult,
  onSkipNote,
  chordSymbol,
  chordSymbols,
}: PracticeViewProps) {
  const holdProgress =
    sessionState.minHoldDetections > 0
      ? sessionState.currentHoldCount / sessionState.minHoldDetections
      : 0

  return (
    <PracticeLayout
      notation={
        <ScaleStaff
          scaleNotes={scaleNotes}
          currentNoteIndex={sessionState.currentNoteIndex}
          chordSymbol={chordSymbol ?? undefined}
          chordSymbols={chordSymbols}
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
    />
  )
}
