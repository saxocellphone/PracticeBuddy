import type { ScaleDirection, SessionScore, Note } from '@core/wasm/types.ts'

/** A single scale in a scale sequence */
export interface ScaleStep {
  rootNote: string
  rootOctave: number
  scaleTypeIndex: number
  /** Display label override (e.g., "ii - D Dorian"). Auto-generated if omitted. */
  label?: string
  /** Chord symbol displayed above the staff (e.g., "Dm7", "G7"). Auto-generated if omitted. */
  chordSymbol?: string
}

/** A chord symbol positioned at a specific note index in a combined note array */
export interface PositionedChordSymbol {
  noteIndex: number
  symbol: string
}

/** A named, ordered collection of scale steps */
export interface ScaleSequence {
  id: string
  name: string
  description: string
  steps: ScaleStep[]
  direction: ScaleDirection
  /** Semitones to shift the entire sequence after each loop. 0 = no shift. */
  shiftSemitones?: number
  /** When true, skip the transition screen between scales and go straight to the next. */
  skipTransition?: boolean
  /** Number of octaves to play (1-3). Defaults to 1. */
  numOctaves?: number
  /** How many times to repeat the sequence when shiftSemitones is 0. Defaults to 1. */
  loopCount?: number
  /** Pitch class to stop shifting at (e.g., "Eb"). Computes transpositions from first step's root to this key. */
  shiftUntilKey?: string
}

/** A preset template that generates a ScaleSequence for a given key */
export interface PresetTemplate {
  id: string
  name: string
  description: string
  category: 'basic' | 'jazz' | 'theory' | 'technique'
  transposable: boolean
  generate: (rootNote: string, rootOctave: number, scaleTypeIndex?: number) => ScaleSequence
}

/** Score for a single completed scale within a practice run */
export interface ScaleRunResult {
  step: ScaleStep
  label: string
  scaleNotes: Note[]
  score: SessionScore
  completedAt: number
}

export type ScalePhase = 'idle' | 'playing' | 'transitioning' | 'stopped'

export interface CumulativeStats {
  totalScalesCompleted: number
  totalNotesAttempted: number
  totalCorrect: number
  totalIncorrect: number
  totalMissed: number
  overallAccuracyPercent: number
  averageCentsOffset: number
}

export interface ScaleSessionState {
  phase: ScalePhase
  sequence: ScaleSequence
  currentStepIndex: number
  completedLoops: number
  results: ScaleRunResult[]
  currentScaleNotes: Note[]
  currentLabel: string
  /** Chord symbol for the current step (single mode) or first step (combined) */
  currentChordSymbol: string | null
  /** Chord symbols positioned at note indices (for combined mode with multiple scales) */
  chordSymbols: PositionedChordSymbol[]
  nextLabel: string | null
  cumulativeStats: CumulativeStats
  restIndices?: Set<number>
}

/** Persisted custom sequence */
export interface SavedCustomSequence {
  id: string
  name: string
  steps: ScaleStep[]
  direction: ScaleDirection
  shiftSemitones?: number
  skipTransition?: boolean
  createdAt: number
}
