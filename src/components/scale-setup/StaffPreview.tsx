import { useEffect, useRef, useState, useMemo } from 'react'
import { buildAllStepsNotes } from '@core/rhythm/sequence.ts'
import type { ScaleStartPosition } from '@core/rhythm/types.ts'
import { getStepChordSymbol } from '@core/scales/presets.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { Note, ScaleDirection } from '@core/wasm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { ScaleSequence } from '@core/scales/types.ts'
import { MeasureStaff, ACCIDENTAL_LEFT_MARGIN, getKeySignature, getKeySignatureForScale, keySignatureWidth } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import styles from './ScaleSetup.module.css'

/**
 * Minimum pixels per note to avoid cramping.
 * VexFlow typically uses ~45-55px per note at standard sizes.
 */
const MIN_PX_PER_NOTE = 45

/** Extra width added for the bass clef glyph */
const CLEF_EXTRA_WIDTH = 54

/** Extra width added for the time signature */
const TIME_SIG_EXTRA_WIDTH = 34

/** Height of each staff line in pixels — must accommodate ledger lines below staff (E1 needs ~190px) */
const STAFF_LINE_HEIGHT = 230

/** Default time signature */
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

interface StaffPreviewProps {
  sequence: ScaleSequence | null
  direction: ScaleDirection
  numOctaves: number
  noteDuration?: NoteDuration
  scaleStartPosition?: ScaleStartPosition
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
}

/**
 * Thin wrapper around the shared buildAllStepsNotes so the preview
 * matches rhythm-mode layout exactly (rest padding on strong beats).
 */
function buildAllPreviewNotes(
  sequence: ScaleSequence,
  direction: ScaleDirection,
  numOctaves: number,
  noteDuration: NoteDuration,
  scaleStartPosition?: ScaleStartPosition,
  range?: { minMidi: number; maxMidi: number },
): { notes: Note[]; stepStartNoteIndices: number[]; restIndices: Set<number> } {
  const adjusted = { ...sequence, direction, numOctaves }
  const { allNotes, boundaries, restIndices } = buildAllStepsNotes(adjusted, false, noteDuration, scaleStartPosition, range)
  const stepStartNoteIndices = boundaries.map(b => b.startNoteIndex)
  return { notes: allNotes, stepStartNoteIndices, restIndices }
}

/**
 * Group an array of notes into measures based on time signature and note duration.
 */
function groupIntoMeasures(notes: Note[], noteDuration: NoteDuration): Note[][] {
  const durationBeats = NOTE_DURATION_BEATS[noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)
  const measures: Note[][] = []
  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    measures.push(notes.slice(i, i + notesPerMeasure))
  }
  return measures
}

interface StaffLineLayout {
  /** Measures in this line (each measure is an array of notes) */
  measures: Note[][]
  /** Index of the first measure in this line within the overall measure list */
  startMeasureIndex: number
  /** Whether this is the first line (shows clef + time signature) */
  isFirstLine: boolean
}

/**
 * Compute how measures are distributed into wrapped lines based on
 * the available container width.
 */
function computeLineLayouts(
  measures: Note[][],
  containerWidth: number,
  baseMeasureWidth: number,
  keySigExtraWidth: number,
): StaffLineLayout[] {
  if (measures.length === 0 || containerWidth <= 0) return []

  const lines: StaffLineLayout[] = []
  let measureIndex = 0

  while (measureIndex < measures.length) {
    const isFirstLine = measureIndex === 0
    let usedWidth = 0
    const lineMeasures: Note[][] = []

    while (measureIndex < measures.length) {
      // First measure of the first line gets clef + time sig + key sig extra width
      // First measure of subsequent lines gets clef extra width only
      let measureWidth = baseMeasureWidth
      if (lineMeasures.length === 0) {
        if (isFirstLine) {
          measureWidth += CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
        } else {
          measureWidth += CLEF_EXTRA_WIDTH
        }
      }

      if (usedWidth + measureWidth > containerWidth && lineMeasures.length > 0) {
        break
      }

      lineMeasures.push(measures[measureIndex])
      usedWidth += measureWidth
      measureIndex++
    }

    lines.push({
      measures: lineMeasures,
      startMeasureIndex: measureIndex - lineMeasures.length,
      isFirstLine,
    })
  }

  return lines
}

export function StaffPreview({
  sequence,
  direction,
  numOctaves,
  noteDuration = 'quarter',
  scaleStartPosition,
  clef,
  range,
}: StaffPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) setContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Build all notes from the sequence (shared with rhythm mode for consistency)
  const { allNotes, stepStartNoteIndices, restIndices } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    try {
      const result = buildAllPreviewNotes(sequence, direction, numOctaves, noteDuration, scaleStartPosition, range)
      return { allNotes: result.notes, stepStartNoteIndices: result.stepStartNoteIndices, restIndices: result.restIndices }
    } catch (err) {
      console.error('StaffPreview buildAllPreviewNotes failed:', err)
      return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    }
  }, [sequence, direction, numOctaves, noteDuration, scaleStartPosition, range])

  // Group into measures
  const measures = useMemo(
    () => groupIntoMeasures(allNotes, noteDuration),
    [allNotes, noteDuration],
  )

  // Compute per-note chord symbol labels within each measure
  const measureLabelsMap = useMemo(() => {
    if (!sequence) return new Map<number, MeasureLabel[]>()
    const dBeats = NOTE_DURATION_BEATS[noteDuration]
    const nPerMeasure = Math.round(BEATS_PER_MEASURE / dBeats)
    const labels = new Map<number, MeasureLabel[]>()
    for (let i = 0; i < sequence.steps.length; i++) {
      const noteIndex = stepStartNoteIndices[i]
      const measureIndex = Math.floor(noteIndex / nPerMeasure)
      const noteIndexInMeasure = noteIndex % nPerMeasure
      const step = sequence.steps[i]
      const chordText = getStepChordSymbol(step)
      if (chordText) {
        const existing = labels.get(measureIndex) ?? []
        existing.push({ noteIndex: noteIndexInMeasure, text: chordText })
        labels.set(measureIndex, existing)
      }
    }
    return labels
  }, [sequence, stepStartNoteIndices, noteDuration])

  // Compute key signature — use circle-of-fifths from first step's root when available,
  // fall back to note analysis for single-step sequences
  const keySig = useMemo(() => {
    if (sequence && sequence.steps.length === 1) {
      const step = sequence.steps[0]
      const cofKeySig = getKeySignatureForScale(step.rootNote, 'Major')
      if (cofKeySig) return cofKeySig
    }
    // For multi-step sequences (ii-V-I etc.), skip key signature —
    // the union of accidentals across different scales/modes is misleading
    if (sequence && sequence.steps.length > 1) {
      return { type: 'none' as const, accidentals: [], steps: [] }
    }
    return getKeySignature(allNotes)
  }, [sequence, allNotes])
  const keySigExtraWidth = keySignatureWidth(keySig.accidentals.length)

  // Compute measure width based on notes per measure so notes aren't cramped
  const durationBeats = NOTE_DURATION_BEATS[noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)
  const baseMeasureWidth = notesPerMeasure * MIN_PX_PER_NOTE + ACCIDENTAL_LEFT_MARGIN

  // Compute line layouts based on container width
  const lineLayouts = useMemo(
    () => computeLineLayouts(measures, containerWidth, baseMeasureWidth, keySigExtraWidth),
    [measures, containerWidth, baseMeasureWidth, keySigExtraWidth],
  )

  if (!sequence || allNotes.length === 0) {
    return (
      <div ref={containerRef} className={styles.staffPreviewContainer}>
        <span className={styles.previewUnavailable}>Preview unavailable</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.staffPreviewContainer}>
      {lineLayouts.map((line, lineIndex) => {
        // Compute total natural width of this line to determine stretch factor
        let lineNaturalWidth = 0
        for (let mi = 0; mi < line.measures.length; mi++) {
          const gmi = line.startMeasureIndex + mi
          let w = baseMeasureWidth
          if (gmi === 0) w += CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
          else if (mi === 0) w += CLEF_EXTRA_WIDTH
          lineNaturalWidth += w
        }
        // Stretch to fill the container (but don't stretch more than 1.5x)
        const isLastLine = lineIndex === lineLayouts.length - 1
        const stretch = containerWidth > 0 && !isLastLine && lineNaturalWidth < containerWidth
          ? Math.min(containerWidth / lineNaturalWidth, 1.5)
          : 1

        return (
        <div key={lineIndex} className={styles.staffPreviewLine}>
          {line.measures.map((measureNotes, measureInLineIndex) => {
            const globalMeasureIndex = line.startMeasureIndex + measureInLineIndex
            const isFirstMeasureOfFirstLine = globalMeasureIndex === 0
            const isFirstMeasureOfLine = measureInLineIndex === 0

            const showClef = isFirstMeasureOfLine
            const showTimeSignature = isFirstMeasureOfFirstLine

            // Compute width for this measure cell, stretched to fill line
            let cellWidth = baseMeasureWidth
            if (isFirstMeasureOfFirstLine) {
              cellWidth += CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
            } else if (isFirstMeasureOfLine) {
              cellWidth += CLEF_EXTRA_WIDTH
            }
            cellWidth = Math.round(cellWidth * stretch)

            return (
              <div
                key={globalMeasureIndex}
                className={styles.staffPreviewMeasure}
                style={{ width: `${cellWidth}px` }}
              >
                <MeasureStaff
                  notes={measureNotes.map((note) => ({
                    note,
                    duration: noteDuration,
                  }))}
                  showClef={showClef}
                  showTimeSignature={showTimeSignature}
                  showKeySignature={isFirstMeasureOfFirstLine}
                  keySignature={keySig}
                  beatsPerMeasure={BEATS_PER_MEASURE}
                  beatValue={BEAT_VALUE}
                  width={cellWidth}
                  height={STAFF_LINE_HEIGHT}
                  showBarline
                  showFinalBarline={globalMeasureIndex === measures.length - 1}
                  labels={measureLabelsMap.get(globalMeasureIndex)}
                  restIndices={restIndices}
                  globalIndexOffset={globalMeasureIndex * notesPerMeasure}
                  clef={clef}
                />
              </div>
            )
          })}
        </div>
        )
      })}
    </div>
  )
}
