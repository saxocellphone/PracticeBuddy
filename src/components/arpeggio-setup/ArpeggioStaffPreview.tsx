import { useEffect, useRef, useState, useMemo } from 'react'
import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'
import { getArpeggioStepLabel } from '@core/arpeggio/presets.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioSequence, ArpeggioDirection } from '@core/arpeggio/types.ts'
import { MeasureStaff, ACCIDENTAL_LEFT_MARGIN, getKeySignature, keySignatureWidth } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import styles from './ArpeggioSetup.module.css'

const MIN_PX_PER_NOTE = 45
const CLEF_EXTRA_WIDTH = 54
const TIME_SIG_EXTRA_WIDTH = 34
const STAFF_LINE_HEIGHT = 170
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

interface ArpeggioStaffPreviewProps {
  sequence: ArpeggioSequence | null
  direction: ArpeggioDirection
  numOctaves?: number
}

function buildAllPreviewNotes(
  sequence: ArpeggioSequence,
  direction: ArpeggioDirection,
  numOctaves: number,
): { notes: Note[]; stepStartNoteIndices: number[] } {
  const notes: Note[] = []
  const stepStartNoteIndices: number[] = []
  for (const step of sequence.steps) {
    stepStartNoteIndices.push(notes.length)
    const { notes: stepNotes } = buildArpeggioNotes(step, direction, numOctaves)
    notes.push(...stepNotes)
  }
  return { notes, stepStartNoteIndices }
}

function groupIntoMeasures(notes: Note[]): Note[][] {
  const notesPerMeasure = BEATS_PER_MEASURE
  const measures: Note[][] = []
  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    measures.push(notes.slice(i, i + notesPerMeasure))
  }
  return measures
}

interface StaffLineLayout {
  measures: Note[][]
  startMeasureIndex: number
  isFirstLine: boolean
}

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

export function ArpeggioStaffPreview({
  sequence,
  direction,
  numOctaves = 1,
}: ArpeggioStaffPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

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

  const { allNotes, stepStartNoteIndices } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[] }
    try {
      const result = buildAllPreviewNotes(sequence, direction, numOctaves)
      return { allNotes: result.notes, stepStartNoteIndices: result.stepStartNoteIndices }
    } catch (err) {
      console.error('ArpeggioStaffPreview buildAllPreviewNotes failed:', err)
      return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[] }
    }
  }, [sequence, direction, numOctaves])

  const measures = useMemo(() => groupIntoMeasures(allNotes), [allNotes])

  // Compute per-note chord symbol labels within each measure
  const measureLabelsMap = useMemo(() => {
    if (!sequence) return new Map<number, MeasureLabel[]>()
    const nPerMeasure = BEATS_PER_MEASURE
    const labels = new Map<number, MeasureLabel[]>()
    for (let i = 0; i < sequence.steps.length; i++) {
      const noteIndex = stepStartNoteIndices[i]
      const measureIndex = Math.floor(noteIndex / nPerMeasure)
      const noteIndexInMeasure = noteIndex % nPerMeasure
      const existing = labels.get(measureIndex) ?? []
      existing.push({ noteIndex: noteIndexInMeasure, text: getArpeggioStepLabel(sequence.steps[i], true) })
      labels.set(measureIndex, existing)
    }
    return labels
  }, [sequence, stepStartNoteIndices])

  const keySig = useMemo(() => getKeySignature(allNotes), [allNotes])
  const keySigExtraWidth = keySignatureWidth(keySig.accidentals.length)

  const baseMeasureWidth = BEATS_PER_MEASURE * MIN_PX_PER_NOTE + ACCIDENTAL_LEFT_MARGIN

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
      {lineLayouts.map((line, lineIndex) => (
        <div key={lineIndex} className={styles.staffPreviewLine}>
          {line.measures.map((measureNotes, measureInLineIndex) => {
            const globalMeasureIndex = line.startMeasureIndex + measureInLineIndex
            const isFirstMeasureOfFirstLine = globalMeasureIndex === 0
            const isFirstMeasureOfLine = measureInLineIndex === 0

            let cellWidth = baseMeasureWidth
            if (isFirstMeasureOfFirstLine) {
              cellWidth += CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
            } else if (isFirstMeasureOfLine) {
              cellWidth += CLEF_EXTRA_WIDTH
            }

            return (
              <div
                key={globalMeasureIndex}
                className={styles.staffPreviewMeasure}
                style={{ width: `${cellWidth}px` }}
              >
                <MeasureStaff
                  notes={measureNotes.map((note) => ({
                    note,
                    duration: 'quarter',
                  }))}
                  showClef={isFirstMeasureOfLine}
                  showTimeSignature={isFirstMeasureOfFirstLine}
                  showKeySignature={isFirstMeasureOfFirstLine}
                  keySignature={keySig}
                  beatsPerMeasure={BEATS_PER_MEASURE}
                  beatValue={BEAT_VALUE}
                  width={cellWidth}
                  height={STAFF_LINE_HEIGHT}
                  showBarline
                  labels={measureLabelsMap.get(globalMeasureIndex)}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
