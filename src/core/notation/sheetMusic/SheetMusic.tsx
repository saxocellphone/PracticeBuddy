/**
 * SheetMusic — unified layout engine for all staff rendering.
 *
 * Handles measure grouping, line wrapping (width-based or fixed-count),
 * scaling, stretching, tie arcs, and active-note highlighting.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import { MeasureStaff, keySignatureWidth } from '@core/notation'
import { ACCIDENTAL_LEFT_MARGIN } from '../components/staveLayout.ts'
import { DEFAULT_MEASURE_CONFIG } from '../config.ts'
import type { StaffConfig } from '../types.ts'
import type { SheetMusicProps, SheetMeasure } from './types.ts'
import { computeWidthBasedLines, computeFixedCountLines } from './lineLayout.ts'
import type { StaffLineLayout } from './lineLayout.ts'
import { computeTies, computeTieArcsForLine } from './tieArcs.ts'
import styles from './SheetMusic.module.css'

const MIN_PX_PER_BEAT = 45
const CLEF_EXTRA_WIDTH = 54
const TIME_SIG_EXTRA_WIDTH = 34
const STAFF_LINE_HEIGHT = 260

const COLOR_PAST = '#16a34a'
const COLOR_CURRENT = '#4f46e5'
const COLOR_FUTURE = '#b0b0c0'

/**
 * Remove chord labels from a measure when the previous measure already
 * shows the same chord. Compares the full label text at noteIndex 0.
 */
function deduplicateLabels(measures: SheetMeasure[]): SheetMeasure[] {
  let prevChord: string | undefined
  return measures.map((m) => {
    const firstLabel = m.labels?.find((l) => l.noteIndex === 0)?.text
    if (firstLabel != null && firstLabel === prevChord) {
      // Strip the duplicate label; keep any labels on later notes in the measure
      const filtered = m.labels?.filter((l) => !(l.noteIndex === 0 && l.text === prevChord))
      const updated = { ...m, labels: filtered?.length ? filtered : undefined }
      // prevChord stays the same
      return updated
    }
    if (firstLabel != null) {
      prevChord = firstLabel
    }
    return m
  })
}

/** Compute total beats in a measure from its notes. */
function measureBeats(m: SheetMeasure): number {
  return m.notes.reduce((sum, n) => sum + NOTE_DURATION_BEATS[n.duration], 0)
}

/** Base pixel width for a single measure (before clef/keysig extras). */
function baseMeasureWidth(m: SheetMeasure): number {
  return measureBeats(m) * MIN_PX_PER_BEAT + ACCIDENTAL_LEFT_MARGIN
}

export function SheetMusic({
  measures,
  keySignature,
  lineWrap = 'width',
  scaling = 'none',
  maxStretch = 1.5,
  activeNote,
  showTies = false,
  clef,
  beatsPerMeasure: bpmProp,
  beatValue = 4,
  hideAccidentals = false,
  chordFontFamily,
}: SheetMusicProps) {
  // Strip repeated chord labels across consecutive measures
  const ms = useMemo(() => deduplicateLabels(measures), [measures])

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

  const config: StaffConfig = clef ? { ...DEFAULT_MEASURE_CONFIG, clef } : DEFAULT_MEASURE_CONFIG
  const keySigExtraWidth = keySignatureWidth(keySignature.accidentals.length)
  const firstLineExtra = CLEF_EXTRA_WIDTH + TIME_SIG_EXTRA_WIDTH + keySigExtraWidth
  const subsequentLineExtra = CLEF_EXTRA_WIDTH

  // Compute layout width and scale
  let layoutWidth: number
  let totalScale: number

  // For fixed-count wrapping, ensure the layout is wide enough for N measures
  const fixedCountMinWidth = typeof lineWrap === 'object'
    ? lineWrap.count * (4 * MIN_PX_PER_BEAT + ACCIDENTAL_LEFT_MARGIN) + firstLineExtra
    : 0

  if (scaling === 'none') {
    layoutWidth = containerWidth
    totalScale = 1
  } else {
    const { scale, minNotesPerLine } = scaling
    const notesMinWidth = minNotesPerLine
      ? minNotesPerLine * MIN_PX_PER_BEAT + firstLineExtra
      : 0
    const minWidth = Math.max(notesMinWidth, fixedCountMinWidth)
    layoutWidth = containerWidth > 0
      ? Math.max(containerWidth / scale, minWidth)
      : 0
    totalScale = containerWidth > 0 ? containerWidth / layoutWidth : 1
  }

  // Compute line layouts
  const lineLayouts: StaffLineLayout[] = useMemo(() => {
    if (typeof lineWrap === 'object') {
      return computeFixedCountLines(ms, lineWrap.count)
    }
    return computeWidthBasedLines(
      ms, layoutWidth, baseMeasureWidth, firstLineExtra, subsequentLineExtra,
    )
  }, [ms, lineWrap, layoutWidth, firstLineExtra, subsequentLineExtra])

  // Tie computation (only when enabled)
  const ties = useMemo(
    () => showTies ? computeTies(ms) : null,
    [showTies, ms],
  )

  // Active note: which measure, which local index
  const activeGlobalIdx = activeNote?.currentNoteIndex ?? -1
  const { activeMeasureIdx, activeLocalIdx } = useMemo(() => {
    if (activeGlobalIdx < 0) return { activeMeasureIdx: -1, activeLocalIdx: -1 }
    let running = 0
    for (let mi = 0; mi < ms.length; mi++) {
      const count = ms[mi].notes.length
      if (activeGlobalIdx < running + count) {
        return { activeMeasureIdx: mi, activeLocalIdx: activeGlobalIdx - running }
      }
      running += count
    }
    return { activeMeasureIdx: -1, activeLocalIdx: -1 }
  }, [activeGlobalIdx, ms])

  // Auto-scroll to the line containing the current note
  useEffect(() => {
    if (!activeNote?.autoScroll) return
    const el = containerRef.current
    if (!el || activeMeasureIdx < 0) return

    const lineIndex = lineLayouts.findIndex((line) => {
      const endMeasure = line.startMeasureIndex + line.measures.length - 1
      return activeMeasureIdx >= line.startMeasureIndex && activeMeasureIdx <= endMeasure
    })
    if (lineIndex < 0) return

    const lineEl = el.querySelector(`[data-line-index="${lineIndex}"]`) as HTMLElement | null
    if (!lineEl) return

    const lineTop = lineEl.offsetTop - el.offsetTop
    el.scrollTo({ top: Math.max(0, lineTop - 20), behavior: 'smooth' })
  }, [activeMeasureIdx, lineLayouts, activeNote?.autoScroll])

  // Empty state
  if (ms.length === 0) {
    const containerClass = activeNote ? styles.containerScrollable : styles.container
    return (
      <div ref={containerRef} className={containerClass}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Preview unavailable</span>
      </div>
    )
  }

  // Practice mode: scrollable, no scaling wrapper
  if (activeNote) {
    return (
      <div className={styles.containerScrollable} ref={containerRef}>
        {lineLayouts.map((line, lineIndex) => renderLine(line, lineIndex))}
      </div>
    )
  }

  // Preview mode: scaled wrapper
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
        {lineLayouts.map((line, lineIndex) => renderLine(line, lineIndex))}
      </div>
    </div>
  )

  function renderLine(line: StaffLineLayout, lineIndex: number) {
    // Compute natural widths, separating pickup from full measures
    let pickupNaturalWidth = 0
    let fullNaturalWidth = 0
    const cellWidths: number[] = []
    const naturalWidths: number[] = []
    for (let mi = 0; mi < line.measures.length; mi++) {
      const gmi = line.startMeasureIndex + mi
      let w = baseMeasureWidth(line.measures[mi])
      if (gmi === 0) w += firstLineExtra
      else if (mi === 0) w += subsequentLineExtra
      naturalWidths.push(w)
      if (line.measures[mi].pickup) {
        pickupNaturalWidth += w
      } else {
        fullNaturalWidth += w
      }
    }

    const effectiveWidth = activeNote ? containerWidth : layoutWidth
    const isLastLine = lineIndex === lineLayouts.length - 1
    // For fixed-count wrapping, stretch all lines (including last) for uniform appearance.
    // For width-based wrapping, skip the last line (it's a leftover partial line).
    const skipStretch = isLastLine && lineWrap === 'width'
    // Stretch only full measures; pickup measures stay at natural width
    let fullStretch = 1
    if (effectiveWidth > 0 && !skipStretch && fullNaturalWidth > 0) {
      const spaceForFull = effectiveWidth - pickupNaturalWidth
      if (spaceForFull > fullNaturalWidth) {
        const raw = spaceForFull / fullNaturalWidth
        fullStretch = maxStretch === 'uncapped' ? raw : Math.min(raw, maxStretch)
      }
    }

    // Build cell widths: pickup at 1x, full measures at fullStretch
    for (let mi = 0; mi < line.measures.length; mi++) {
      const s = line.measures[mi].pickup ? 1 : fullStretch
      cellWidths.push(Math.round(naturalWidths[mi] * s))
    }

    // Cumulative x offsets for tie overlay
    const measureXOffsets: number[] = []
    let cumX = 0
    for (const cw of cellWidths) {
      measureXOffsets.push(cumX)
      cumX += cw
    }
    const lineWidth = cumX

    // Tie arcs for this line
    const tieArcs = ties
      ? computeTieArcsForLine(line, measureXOffsets, cellWidths, ties, config, keySigExtraWidth)
      : []

    const pastColor = activeNote?.pastColor ?? COLOR_PAST
    const activeColor = activeNote?.activeColor ?? COLOR_CURRENT
    const futureColor = activeNote?.futureColor ?? COLOR_FUTURE

    return (
      <div key={lineIndex} className={styles.line} style={tieArcs.length > 0 ? { position: 'relative' } : undefined} data-line-index={lineIndex}>
        {line.measures.map((measure, measureInLineIndex) => {
          const globalMeasureIndex = line.startMeasureIndex + measureInLineIndex
          const isFirstMeasureOfFirstLine = globalMeasureIndex === 0
          const isFirstMeasureOfLine = measureInLineIndex === 0
          const beats = bpmProp ?? measureBeats(measure)

          // Active note coloring
          const isMeasurePast = activeNote && globalMeasureIndex < activeMeasureIdx
          const isMeasureCurrent = activeNote && globalMeasureIndex === activeMeasureIdx
          const localActiveIndex = isMeasureCurrent ? activeLocalIdx : -1
          const noteColor = activeNote
            ? (isMeasurePast ? pastColor : futureColor)
            : undefined
          const activeNoteColor = isMeasureCurrent ? activeColor : undefined
          const pastNoteColor = isMeasureCurrent ? pastColor : undefined

          return (
            <div
              key={globalMeasureIndex}
              className={styles.measure}
              style={{ width: `${cellWidths[measureInLineIndex]}px` }}
            >
              <MeasureStaff
                notes={measure.notes}
                showClef={isFirstMeasureOfLine}
                showTimeSignature={isFirstMeasureOfFirstLine}
                showKeySignature={isFirstMeasureOfFirstLine}
                keySignature={keySignature}
                beatsPerMeasure={beats}
                timeSigBeats={measure.pickup ? 4 : undefined}
                beatValue={beatValue}
                width={cellWidths[measureInLineIndex]}
                height={STAFF_LINE_HEIGHT}
                showBarline
                showFinalBarline={globalMeasureIndex === ms.length - 1}
                labels={measure.labels}
                restIndices={measure.restIndices}
                globalIndexOffset={0}
                clef={clef}
                chordFontFamily={chordFontFamily}
                activeNoteIndex={localActiveIndex}
                noteColor={noteColor}
                activeNoteColor={activeNoteColor}
                pastNoteColor={pastNoteColor}
                hideAccidentals={hideAccidentals}
              />
            </div>
          )
        })}

        {tieArcs.length > 0 && (
          <svg
            className={styles.tieOverlay}
            viewBox={`0 0 ${lineWidth} ${STAFF_LINE_HEIGHT}`}
            width={lineWidth}
            height={STAFF_LINE_HEIGHT}
          >
            {tieArcs.map((arc, i) => (
              <path key={i} d={arc.d} fill="none" stroke={config.colors.note} strokeWidth={1.5} />
            ))}
          </svg>
        )}
      </div>
    )
  }
}
