/**
 * ScaleStaff -- renders a scale as wrapped sheet music with measure lines.
 *
 * Notes are grouped into measures, measures wrap across multiple lines
 * based on container width, and each measure is rendered using MeasureStaff.
 * Includes auto-scroll to the line containing the current note, key
 * signature computation, per-note coloring (past/current/future), and
 * chord symbol positioning.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import type { ClefType } from '@core/instruments.ts'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { PositionedChordSymbol } from '@core/endless/types.ts'
import type { MeasureLabel } from './MeasureStaff.tsx'
import { MeasureStaff } from './MeasureStaff.tsx'
import { getKeySignature, getKeySignatureForScale } from './keySignature.ts'
import { keySignatureWidth } from './glyphs/keySignatureLayout.ts'
import { ACCIDENTAL_LEFT_MARGIN } from './components/staveLayout.ts'
import styles from './ScaleStaff.module.css'

/** Minimum pixels per note to avoid cramping. */
const MIN_PX_PER_NOTE = 45

/** Extra width for the bass clef glyph. */
const CLEF_EXTRA_WIDTH = 54

/** Extra width for the time signature. */
const TIME_SIG_EXTRA_WIDTH = 34

/** Height of each staff line in pixels. */
const STAFF_LINE_HEIGHT = 230

/** Default time signature. */
const BEATS_PER_MEASURE = 4
const BEAT_VALUE = 4

/** Per-note colors for practice mode. */
const COLOR_PAST = '#16a34a'
const COLOR_CURRENT = '#4f46e5'
const COLOR_FUTURE = '#b0b0c0'

interface ScaleStaffProps {
  scaleNotes: Note[]
  currentNoteIndex: number
  /** Optional chord symbol displayed above the staff (e.g. "Cmaj7") */
  chordSymbol?: string
  /** Positioned chord symbols for combined mode (multiple scales in one staff) */
  chordSymbols?: PositionedChordSymbol[]
  /** Duration for rendered notes (default: 'quarter') */
  noteDuration?: NoteDuration
  /** Root pitch class for circle-of-fifths key signature (e.g. "Gb", "F#") */
  rootPitchClass?: string
  /** Scale type display name for key signature computation (e.g. "Major", "Dorian") */
  scaleTypeName?: string
  /** Note indices that are rests (for strong-beat alignment padding) */
  restIndices?: Set<number>
  /** Override the clef type (defaults to bass) */
  clef?: ClefType
}

interface StaffLineLayout {
  measures: Note[][]
  startMeasureIndex: number
  isFirstLine: boolean
}

/**
 * Group notes into measures based on time signature and note duration.
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

export function ScaleStaff({
  scaleNotes,
  currentNoteIndex,
  chordSymbol,
  chordSymbols,
  noteDuration = 'quarter',
  rootPitchClass,
  scaleTypeName,
  restIndices,
  clef,
}: ScaleStaffProps) {
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

  // Compute key signature — prefer circle-of-fifths when root is available
  const keySig = useMemo(() => {
    if (rootPitchClass) {
      const cofKeySig = getKeySignatureForScale(rootPitchClass, scaleTypeName)
      if (cofKeySig) return cofKeySig
    }
    return getKeySignature(scaleNotes)
  }, [scaleNotes, rootPitchClass, scaleTypeName])
  const keySigExtraWidth = keySignatureWidth(keySig.accidentals.length)
  const hideAccidentals = keySig.type !== 'none'

  // Group notes into measures
  const durationBeats = NOTE_DURATION_BEATS[noteDuration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)

  const measures = useMemo(
    () => groupIntoMeasures(scaleNotes, noteDuration),
    [scaleNotes, noteDuration],
  )

  // Compute per-measure chord symbol labels
  const measureLabelsMap = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()

    // Single chord symbol → label on the first measure
    if (chordSymbol && !chordSymbols?.length) {
      labels.set(0, [{ noteIndex: 0, text: chordSymbol }])
    }

    // Positioned chord symbols → map to measure/note index
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

  // Compute measure widths and line layouts
  const baseMeasureWidth = notesPerMeasure * MIN_PX_PER_NOTE + ACCIDENTAL_LEFT_MARGIN

  const lineLayouts = useMemo(
    () => computeLineLayouts(measures, containerWidth, baseMeasureWidth, keySigExtraWidth),
    [measures, containerWidth, baseMeasureWidth, keySigExtraWidth],
  )

  // Which measure contains the current note, and the local index within it
  const currentMeasureIndex = Math.floor(currentNoteIndex / notesPerMeasure)
  const currentLocalIndex = currentNoteIndex % notesPerMeasure

  // Auto-scroll to the line containing the current note
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Find which line contains the current measure
    const lineIndex = lineLayouts.findIndex((line) => {
      const endMeasure = line.startMeasureIndex + line.measures.length - 1
      return currentMeasureIndex >= line.startMeasureIndex && currentMeasureIndex <= endMeasure
    })
    if (lineIndex < 0) return

    const lineEl = el.querySelector(`[data-line-index="${lineIndex}"]`) as HTMLElement | null
    if (!lineEl) return

    // Scroll so the active line is near the top with some padding
    const lineTop = lineEl.offsetTop - el.offsetTop
    const targetScroll = lineTop - 20
    el.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
  }, [currentMeasureIndex, lineLayouts])

  return (
    <div className={styles.staffContainer} ref={containerRef}>
      {lineLayouts.map((line, lineIndex) => {
        // Compute stretch factor to fill line width
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
        <div key={lineIndex} className={styles.staffLine} data-line-index={lineIndex}>
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

            // Determine coloring based on measure position relative to current note
            const isMeasurePast = globalMeasureIndex < currentMeasureIndex
            const isMeasureCurrent = globalMeasureIndex === currentMeasureIndex
            const localActiveIndex = isMeasureCurrent ? currentLocalIndex : -1

            // Past measures: all notes green, no active
            // Current measure: future=gray, active=indigo, past=green
            // Future measures: all notes gray, no active
            const noteColor = isMeasurePast ? COLOR_PAST : COLOR_FUTURE
            const activeNoteColor = isMeasureCurrent ? COLOR_CURRENT : undefined
            const pastNoteColor = isMeasureCurrent ? COLOR_PAST : undefined

            return (
              <div
                key={globalMeasureIndex}
                className={styles.staffMeasure}
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
                  activeNoteIndex={localActiveIndex}
                  showBarline
                  showFinalBarline={globalMeasureIndex === measures.length - 1}
                  labels={measureLabelsMap.get(globalMeasureIndex)}
                  noteColor={noteColor}
                  activeNoteColor={activeNoteColor}
                  pastNoteColor={pastNoteColor}
                  hideAccidentals={hideAccidentals}
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
