import { useEffect, useRef, useState, useMemo } from 'react'
import { buildAllWalkingBassStepsNotes } from '@core/walking-bass/sequence.ts'
import type { Note } from '@core/wasm/types.ts'
import type { WalkingBassSequence } from '@core/walking-bass/types.ts'
import { MeasureStaff, ACCIDENTAL_LEFT_MARGIN, getKeySignature, getKeySignatureForScale, keySignatureWidth } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import styles from './WalkingBassSetup.module.css'

const MIN_PX_PER_NOTE = 45
const CLEF_EXTRA_WIDTH = 54
const TIME_SIG_EXTRA_WIDTH = 34
const STAFF_LINE_HEIGHT = 230
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4
const NOTES_PER_MEASURE = 4

interface WalkingBassStaffPreviewProps {
  sequence: WalkingBassSequence | null
  range?: { minMidi: number; maxMidi: number }
}

interface StaffLineLayout {
  measures: Note[][]
  startMeasureIndex: number
  isFirstLine: boolean
}

function groupIntoMeasures(notes: Note[]): Note[][] {
  const measures: Note[][] = []
  for (let i = 0; i < notes.length; i += NOTES_PER_MEASURE) {
    measures.push(notes.slice(i, i + NOTES_PER_MEASURE))
  }
  return measures
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

export function WalkingBassStaffPreview({
  sequence,
  range,
}: WalkingBassStaffPreviewProps) {
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

  const { allNotes, boundaries } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], boundaries: [] }
    try {
      return buildAllWalkingBassStepsNotes(sequence, range)
    } catch (err) {
      console.error('WalkingBassStaffPreview build failed:', err)
      return { allNotes: [] as Note[], boundaries: [] }
    }
  }, [sequence, range])

  const measures = useMemo(() => groupIntoMeasures(allNotes), [allNotes])

  const measureLabelsMap = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()
    for (const boundary of boundaries) {
      const measureIndex = Math.floor(boundary.startNoteIndex / NOTES_PER_MEASURE)
      const noteIndexInMeasure = boundary.startNoteIndex % NOTES_PER_MEASURE
      const existing = labels.get(measureIndex) ?? []
      existing.push({ noteIndex: noteIndexInMeasure, text: boundary.label })
      labels.set(measureIndex, existing)
    }
    return labels
  }, [boundaries])

  const keySig = useMemo(() => {
    if (sequence && sequence.steps.length > 0) {
      const root = sequence.steps[0].root
      const cofKeySig = getKeySignatureForScale(root, 'Major')
      if (cofKeySig) return cofKeySig
    }
    return getKeySignature(allNotes)
  }, [sequence, allNotes])
  const keySigExtraWidth = keySignatureWidth(keySig.accidentals.length)

  const baseMeasureWidth = NOTES_PER_MEASURE * MIN_PX_PER_NOTE + ACCIDENTAL_LEFT_MARGIN

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
        let lineNaturalWidth = 0
        for (let mi = 0; mi < line.measures.length; mi++) {
          const gmi = line.startMeasureIndex + mi
          let w = baseMeasureWidth
          if (gmi === 0) w += CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
          else if (mi === 0) w += CLEF_EXTRA_WIDTH
          lineNaturalWidth += w
        }
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
                    showFinalBarline={globalMeasureIndex === measures.length - 1}
                    labels={measureLabelsMap.get(globalMeasureIndex)}
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
