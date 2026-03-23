/**
 * MeasureSheetLayout — shared layout engine for all staff previews.
 *
 * Handles measure grouping, line wrapping, scaling for small screens,
 * and rendering MeasureStaff instances. Each preview component only
 * needs to prepare its notes, labels, and key signature, then delegate
 * to this component.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { KeySignatureInfo } from '@core/notation/keySignature.ts'
import { MeasureStaff, ACCIDENTAL_LEFT_MARGIN, keySignatureWidth } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import styles from './MeasureSheetLayout.module.css'

/** Minimum pixels per note to avoid cramping */
const MIN_PX_PER_NOTE = 45

/**
 * Minimum notes visible per line before scaling kicks in.
 * Translates to more measures for longer notes (whole -> 16 measures)
 * and fewer for shorter notes (sixteenth -> 1 measure).
 */
const MIN_NOTES_PER_LINE = 16

/** Visual scale applied to the entire preview */
const PREVIEW_SCALE = 0.6

const CLEF_EXTRA_WIDTH = 54
const TIME_SIG_EXTRA_WIDTH = 34
const STAFF_LINE_HEIGHT = 230
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

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

export interface MeasureSheetLayoutProps {
  /** Flat array of all notes to display */
  notes: Note[]
  /** Note duration for rendering */
  noteDuration: NoteDuration
  /** Per-measure labels (chord symbols, scale names) keyed by measure index */
  measureLabels: Map<number, MeasureLabel[]>
  /** Key signature to display */
  keySignature: KeySignatureInfo
  /** Global note indices that render as rests */
  restIndices?: Set<number>
  /** Clef type override */
  clef?: ClefType
}

export function MeasureSheetLayout({
  notes,
  noteDuration,
  measureLabels,
  keySignature,
  restIndices,
  clef,
}: MeasureSheetLayoutProps) {
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

  const durationBeats = NOTE_DURATION_BEATS[noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)

  const measures = useMemo(() => {
    const result: Note[][] = []
    for (let i = 0; i < notes.length; i += notesPerMeasure) {
      result.push(notes.slice(i, i + notesPerMeasure))
    }
    return result
  }, [notes, notesPerMeasure])

  const keySigExtraWidth = keySignatureWidth(keySignature.accidentals.length)
  const baseMeasureWidth = notesPerMeasure * MIN_PX_PER_NOTE + ACCIDENTAL_LEFT_MARGIN

  // Duration-independent minimum layout width so the staff doesn't
  // visually resize when switching note durations.
  const minWidthForNotes = MIN_NOTES_PER_LINE * MIN_PX_PER_NOTE
    + CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
  // Render at a wider virtual width so that after scaling down by PREVIEW_SCALE
  // the content exactly fills the container. On small screens, minWidthForNotes
  // may be larger, scaling down further to guarantee enough notes per line.
  const layoutWidth = containerWidth > 0
    ? Math.max(containerWidth / PREVIEW_SCALE, minWidthForNotes)
    : 0
  const totalScale = containerWidth > 0 ? containerWidth / layoutWidth : 1

  const lineLayouts = useMemo(
    () => computeLineLayouts(measures, layoutWidth, baseMeasureWidth, keySigExtraWidth),
    [measures, layoutWidth, baseMeasureWidth, keySigExtraWidth],
  )

  if (notes.length === 0) {
    return (
      <div ref={containerRef} className={styles.container}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Preview unavailable</span>
      </div>
    )
  }

  const scaledHeight = lineLayouts.length * STAFF_LINE_HEIGHT * totalScale

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height: `${scaledHeight}px` }}
    >
      <div
        className={styles.scaled}
        style={{
          width: `${layoutWidth}px`,
          transform: `scale(${totalScale})`,
          transformOrigin: 'top left',
        }}
      >
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
          const stretch = layoutWidth > 0 && !isLastLine && lineNaturalWidth < layoutWidth
            ? Math.min(layoutWidth / lineNaturalWidth, 1.5)
            : 1

          return (
            <div key={lineIndex} className={styles.line}>
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
                    className={styles.measure}
                    style={{ width: `${cellWidth}px` }}
                  >
                    <MeasureStaff
                      notes={measureNotes.map((note) => ({
                        note,
                        duration: noteDuration,
                      }))}
                      showClef={isFirstMeasureOfLine}
                      showTimeSignature={isFirstMeasureOfFirstLine}
                      showKeySignature={isFirstMeasureOfFirstLine}
                      keySignature={keySignature}
                      beatsPerMeasure={BEATS_PER_MEASURE}
                      beatValue={BEAT_VALUE}
                      width={cellWidth}
                      height={STAFF_LINE_HEIGHT}
                      showBarline
                      showFinalBarline={globalMeasureIndex === measures.length - 1}
                      labels={measureLabels.get(globalMeasureIndex)}
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
    </div>
  )
}
