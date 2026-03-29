import { useMemo } from 'react'
import type { Note, SessionState, DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'
import type { PositionedChordSymbol } from '@core/scales/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { MeasureLabel } from '@core/notation'
import { SheetMusic, groupNotesIntoMeasures, getKeySignature, getKeySignatureForScale } from '@core/notation'
import { PracticeLayout } from './PracticeLayout.tsx'
import styles from './PracticeView.module.css'

const BEATS_PER_MEASURE = 4

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
  /** Note duration for rendering (defaults to quarter) */
  noteDuration?: NoteDuration
  /** Rest indices for strong-beat padding */
  restIndices?: Set<number>
  /** Clef type for notation rendering */
  clef?: ClefType
  /** Root pitch class for key signature (e.g. "Gb", "F#") */
  rootPitchClass?: string
  /** Scale type display name for key signature computation */
  scaleTypeName?: string
}

export function PracticeView({
  scaleNotes,
  sessionState,
  noteResult,
  onSkipNote,
  chordSymbol,
  chordSymbols,
  noteDuration = 'quarter',
  restIndices,
  clef,
  rootPitchClass,
  scaleTypeName,
}: PracticeViewProps) {
  const holdProgress =
    sessionState.minHoldDetections > 0
      ? sessionState.currentHoldCount / sessionState.minHoldDetections
      : 0

  // Compute key signature
  const keySig = useMemo(() => {
    if (rootPitchClass) {
      const cofKeySig = getKeySignatureForScale(rootPitchClass, scaleTypeName)
      if (cofKeySig) return cofKeySig
    }
    return getKeySignature(scaleNotes)
  }, [scaleNotes, rootPitchClass, scaleTypeName])

  // Build measure labels from chord symbols
  const durationBeats = NOTE_DURATION_BEATS[noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)

  const measureLabels = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()

    if (chordSymbol && !chordSymbols?.length) {
      labels.set(0, [{ noteIndex: 0, text: chordSymbol }])
    }

    if (chordSymbols?.length) {
      for (const cs of chordSymbols) {
        const measureIndex = Math.floor(cs.noteIndex / notesPerMeasure)
        const noteIndexInMeasure = cs.noteIndex % notesPerMeasure
        const existing = labels.get(measureIndex) ?? []
        existing.push({ noteIndex: noteIndexInMeasure, text: cs.symbol })
        labels.set(measureIndex, existing)
      }
    }

    return labels
  }, [chordSymbol, chordSymbols, notesPerMeasure])

  const measures = useMemo(
    () => groupNotesIntoMeasures(scaleNotes, noteDuration, { restIndices, measureLabels }),
    [scaleNotes, noteDuration, restIndices, measureLabels],
  )

  return (
    <PracticeLayout
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
    />
  )
}
