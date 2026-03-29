/**
 * MeasureStaff -- renders one measure of musical notes on a staff.
 *
 * Drop-in replacement for the former StaffNote component. Composes
 * Stave + Voice from the notation building blocks using DEFAULT_MEASURE_CONFIG.
 *
 * The outer <svg> handles viewBox, dimensions, and dimming opacity.
 */

import { memo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { StaffConfig } from './types.ts'
import { DEFAULT_MEASURE_CONFIG } from './config.ts'
import { Stave } from './components/Stave.tsx'
import { Voice } from './components/Voice.tsx'
import { staveContentStartX } from './components/staveLayout.ts'

/** A label positioned above a specific note within a measure */
export interface MeasureLabel {
  /** Index of the note within this measure (0-based) */
  noteIndex: number
  /** Text to display (e.g. chord symbol) */
  text: string
}

interface MeasureStaffProps {
  notes: Array<{ note: Note; duration: NoteDuration }>
  showClef?: boolean
  showTimeSignature?: boolean
  showKeySignature?: boolean
  keySignature?: {
    type: 'sharp' | 'flat' | 'none'
    accidentals: string[]
    steps: number[]
  }
  beatsPerMeasure?: number
  /** Override the beats shown in the time signature (e.g. show 4/4 on a pickup measure) */
  timeSigBeats?: number
  beatValue?: number
  width: number
  height: number
  dimmed?: boolean
  /** Index of the currently active note within this measure (-1 for none) */
  activeNoteIndex?: number
  /** Show a barline at the right edge of the measure */
  showBarline?: boolean
  /** Show a final barline (thin + thick) at the right edge — indicates end of piece */
  showFinalBarline?: boolean
  /** Single label displayed above the staff start (e.g. chord symbol or scale name) */
  label?: string
  /** Per-note labels positioned above specific notes within the measure */
  labels?: MeasureLabel[]
  /** Global note indices that should render as rests instead of note heads */
  restIndices?: Set<number>
  /** Offset added to each note's local index to get its global index for restIndices lookup */
  globalIndexOffset?: number
  /** Override the default note color */
  noteColor?: string
  /** Override the active note color */
  activeNoteColor?: string
  /** Color for notes before the active note (past notes) */
  pastNoteColor?: string
  /** When true, per-note accidentals are suppressed (e.g. when a key signature covers them) */
  hideAccidentals?: boolean
  /** Override the clef type (defaults to bass) */
  clef?: ClefType
  /** Override the chord symbol font family */
  chordFontFamily?: string
}

export const MeasureStaff = memo(function MeasureStaff({
  notes,
  showClef = false,
  showTimeSignature = false,
  showKeySignature = false,
  keySignature,
  beatsPerMeasure = 4,
  timeSigBeats,
  beatValue = 4,
  width,
  height,
  dimmed = false,
  activeNoteIndex = -1,
  showBarline = false,
  showFinalBarline = false,
  label,
  labels,
  restIndices,
  globalIndexOffset,
  noteColor,
  activeNoteColor,
  pastNoteColor,
  hideAccidentals,
  clef,
  chordFontFamily,
}: MeasureStaffProps) {
  const chordFont = chordFontFamily || 'var(--chord-font-family, var(--font-family-mono, monospace))'
  const config: StaffConfig = clef ? { ...DEFAULT_MEASURE_CONFIG, clef } : DEFAULT_MEASURE_CONFIG

  const keySigCount = showKeySignature && keySignature ? keySignature.accidentals.length : 0
  // Content starts after clef + time signature + key signature
  const startX = staveContentStartX(config, { showClef, showTimeSignature, keySigAccidentalCount: keySigCount })
  const availableWidth = width - startX

  // Compute per-note x positions at beat onset (mirrors Voice layout)
  let labelBeatPos = 0
  const noteCenterXs = notes.map(({ duration }) => {
    const durBeats = NOTE_DURATION_BEATS[duration]
    const positionDur = Math.min(durBeats, 1)
    const x = startX + ((labelBeatPos + positionDur / 2) / beatsPerMeasure) * availableWidth
    labelBeatPos += durBeats
    return x
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        pointerEvents: 'none',
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {/* Single label at the start of the measure */}
      {label && !labels?.length && (
        <text
          x={startX}
          y={70}
          textAnchor="start"
          fill="var(--color-text-primary)"
          fontSize="54"
          fontWeight={700}
          fontFamily={chordFont}
        >
          {label}
        </text>
      )}

      {/* Per-note labels positioned above specific notes */}
      {labels?.map((ml) => (
        <text
          key={ml.noteIndex}
          x={noteCenterXs[ml.noteIndex] ?? startX}
          y={70}
          textAnchor="middle"
          fill="var(--color-text-primary)"
          fontSize="54"
          fontWeight={700}
          fontFamily={chordFont}
        >
          {ml.text}
        </text>
      ))}

      <Stave
        config={config}
        width={width}
        showClef={showClef}
        showTimeSignature={showTimeSignature}
        showKeySignature={showKeySignature}
        keySignature={keySignature}
        showBarline={showBarline}
        showFinalBarline={showFinalBarline}
        beatsPerMeasure={timeSigBeats ?? beatsPerMeasure}
        beatValue={beatValue}
      >
        <Voice
          notes={notes}
          config={config}
          startX={startX}
          availableWidth={availableWidth}
          beatsPerMeasure={beatsPerMeasure}
          activeNoteIndex={activeNoteIndex}
          color={noteColor}
          activeNoteColor={activeNoteColor}
          pastNoteColor={pastNoteColor}
          hideAccidentals={hideAccidentals}
          restIndices={restIndices}
          globalIndexOffset={globalIndexOffset}
        />
      </Stave>
    </svg>
  )
})
