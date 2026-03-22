import type { Note, SessionScore } from '@core/wasm/types.ts'

// ---- Arpeggio quality ----

export type ArpeggioType =
  | 'Major'
  | 'Minor'
  | 'Dominant7'
  | 'Major7'
  | 'Minor7'
  | 'Diminished'
  | 'Augmented'
  | 'MinorMajor7'
  | 'HalfDiminished7'
  | 'Diminished7'

export const ARPEGGIO_TYPE_LABELS: Record<ArpeggioType, string> = {
  Major: 'maj',
  Minor: 'm',
  Dominant7: '7',
  Major7: 'maj7',
  Minor7: 'm7',
  Diminished: 'dim',
  Augmented: 'aug',
  MinorMajor7: 'm(maj7)',
  HalfDiminished7: 'm7b5',
  Diminished7: 'dim7',
}

/** Semitone intervals from root for each arpeggio type */
const ARPEGGIO_INTERVALS: Record<ArpeggioType, number[]> = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Dominant7: [0, 4, 7, 10],
  Major7: [0, 4, 7, 11],
  Minor7: [0, 3, 7, 10],
  Diminished: [0, 3, 6],
  Augmented: [0, 4, 8],
  MinorMajor7: [0, 3, 7, 11],
  HalfDiminished7: [0, 3, 6, 10],
  Diminished7: [0, 3, 6, 9],
}

/** Returns semitone intervals from the root for the given arpeggio type */
export function getArpeggioIntervals(type: ArpeggioType): number[] {
  return ARPEGGIO_INTERVALS[type]
}

// ---- Direction ----

export type ArpeggioDirection = 'ascending' | 'descending' | 'ascendingDescending'

// ---- Sequence definition ----

/** A single arpeggio in a sequence — each step can have a different quality */
export interface ArpeggioStep {
  root: string
  rootOctave: number
  arpeggioType: ArpeggioType
  /** Display label override (e.g., "ii - Dm7"). Auto-generated if omitted. */
  label?: string
}

/** A named, ordered collection of arpeggio steps */
export interface ArpeggioSequence {
  id: string
  name: string
  description: string
  steps: ArpeggioStep[]
  direction: ArpeggioDirection
  /** Number of octaves to play (1-3). Defaults to 1. */
  numOctaves?: number
  /** Semitones to shift the entire sequence after each loop. 0 = no shift. */
  shiftSemitones?: number
  /** When true, skip the transition screen between arpeggios. */
  skipTransition?: boolean
  /** How many times to repeat the sequence when shiftSemitones is 0. Defaults to 1. */
  loopCount?: number
  /** Pitch class to stop shifting at (e.g., "Eb"). Computes transpositions from first step's root to this key. */
  shiftUntilKey?: string
}

// ---- Session results ----

/** Score for a single completed arpeggio within a session */
export interface ArpeggioRunResult {
  step: ArpeggioStep
  label: string
  notes: Note[]
  score: SessionScore
  completedAt: number
}

export type ArpeggioPhase = 'idle' | 'playing' | 'stopped'

export interface CumulativeArpeggioStats {
  totalArpeggiosCompleted: number
  totalNotesAttempted: number
  totalCorrect: number
  totalIncorrect: number
  totalMissed: number
  overallAccuracyPercent: number
  averageCentsOffset: number
}

export interface ArpeggioSessionState {
  phase: ArpeggioPhase
  sequence: ArpeggioSequence
  currentStepIndex: number
  currentNoteIndex: number
  completedLoops: number
  results: ArpeggioRunResult[]
  currentNotes: Note[]
  currentLabel: string
  nextLabel: string | null
  cumulativeStats: CumulativeArpeggioStats
}
