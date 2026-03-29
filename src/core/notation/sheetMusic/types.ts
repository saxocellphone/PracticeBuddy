import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { KeySignatureInfo } from '@core/notation/keySignature.ts'
import type { MeasureLabel } from '../MeasureStaff.tsx'

/**
 * A single measure ready for rendering. Canonical input format
 * for the SheetMusic layout engine.
 */
export interface SheetMeasure {
  notes: Array<{ note: Note; duration: NoteDuration }>
  labels?: MeasureLabel[]
  /** Rest indices local to this measure (0-based within the measure) */
  restIndices?: Set<number>
  /** Pickup (anacrusis) measure — exempt from fixed-count line grouping */
  pickup?: boolean
}

/**
 * Strategy for distributing measures across lines.
 *
 * - 'width': Fit as many measures as the container allows.
 * - { count: number }: Fixed number of full measures per line.
 *   Pickup measures prepend to the first group without counting.
 */
export type LineWrapStrategy =
  | 'width'
  | { count: number }

/**
 * Controls whether/how the layout is scaled to fit inside its container.
 *
 * - 'none': No scaling, uses container width directly (practice mode).
 * - { scale, minNotesPerLine? }: Virtual width layout with CSS transform.
 */
export type ScaleMode =
  | 'none'
  | { scale: number; minNotesPerLine?: number }

/**
 * Configuration for active-note highlighting during practice.
 */
export interface ActiveNoteConfig {
  /** Global index of the currently active note across all measures */
  currentNoteIndex: number
  pastColor?: string     // default '#16a34a'
  activeColor?: string   // default '#4f46e5'
  futureColor?: string   // default '#b0b0c0'
  autoScroll?: boolean   // default true
}

/**
 * Props for the unified SheetMusic component.
 */
export interface SheetMusicProps {
  measures: SheetMeasure[]
  keySignature: KeySignatureInfo

  lineWrap?: LineWrapStrategy        // default: 'width'
  scaling?: ScaleMode                // default: 'none'
  maxStretch?: number | 'uncapped'   // default: 1.5

  activeNote?: ActiveNoteConfig
  showTies?: boolean                 // default: false

  clef?: ClefType
  beatsPerMeasure?: number           // default: 4
  beatValue?: number                 // default: 4
  hideAccidentals?: boolean
  /** Override the chord symbol font family (e.g. 'Caveat, cursive') */
  chordFontFamily?: string
}
