import type { ChordQuality } from '@core/walking-bass/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'

// ---- Melody Events ----

export interface MelodyNote {
  type: 'note'
  pitchClass: string
  octave: number
  duration: NoteDuration
}

export interface MelodyRest {
  type: 'rest'
  duration: NoteDuration
}

export type MelodyEvent = MelodyNote | MelodyRest

// ---- Chord Changes ----

export interface ChordChange {
  /** Display text, e.g. "Fm7" */
  symbol: string
  /** Pitch class, e.g. "F" */
  root: string
  quality: ChordQuality
  /** 1-indexed beat position within the measure */
  beat: number
}

// ---- Measure ----

export interface JazzStandardMeasure {
  chords: ChordChange[]
  melody: MelodyEvent[]
  /** If true, this is a pickup (anacrusis) measure — only the notes matter, leading rests are ignored */
  pickup?: boolean
}

// ---- Full Standard ----

export interface JazzStandard {
  id: string
  title: string
  composer: string
  key: string
  timeSignature: { beats: number; value: number }
  tempo?: number
  form: string
  measures: JazzStandardMeasure[]
  melodyClef: ClefType
  tags?: string[]
}

// ---- Summary (no measures) ----

export interface JazzStandardSummary {
  id: string
  title: string
  composer: string
  key: string
  form: string
  tags?: string[]
}

// ---- Sub-mode ----

export type JazzStandardSubMode = 'melody' | 'walking-bass'
