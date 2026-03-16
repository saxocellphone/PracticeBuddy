import type { ScaleDirection, SessionScore, Note } from '@core/wasm/types.ts'

/** A single scale in an endless sequence */
export interface ScaleStep {
  rootNote: string
  rootOctave: number
  scaleTypeIndex: number
  /** Display label override (e.g., "ii - D Dorian"). Auto-generated if omitted. */
  label?: string
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
}

/** A preset template that generates a ScaleSequence for a given key */
export interface PresetTemplate {
  id: string
  name: string
  description: string
  category: 'jazz' | 'theory' | 'technique'
  transposable: boolean
  generate: (rootNote: string, rootOctave: number) => ScaleSequence
}

/** Score for a single completed scale within an endless run */
export interface ScaleRunResult {
  step: ScaleStep
  label: string
  scaleNotes: Note[]
  score: SessionScore
  completedAt: number
}

export type EndlessPhase = 'idle' | 'playing' | 'transitioning' | 'stopped'

export interface CumulativeStats {
  totalScalesCompleted: number
  totalNotesAttempted: number
  totalCorrect: number
  totalIncorrect: number
  totalMissed: number
  overallAccuracyPercent: number
  averageCentsOffset: number
}

export interface EndlessSessionState {
  phase: EndlessPhase
  sequence: ScaleSequence
  currentStepIndex: number
  completedLoops: number
  results: ScaleRunResult[]
  currentScaleNotes: Note[]
  currentLabel: string
  nextLabel: string | null
  cumulativeStats: CumulativeStats
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
