import type { Note } from '@core/wasm/types.ts'

// ---- Chord Quality ----

export type ChordQuality = 'maj7' | 'dom7' | 'min7' | 'm7b5'

/** Map chord symbol suffixes to ChordQuality */
export function parseChordQuality(chordSymbol: string): ChordQuality {
  const s = chordSymbol.toLowerCase()
  if (s.includes('m7b5') || s.includes('m7♭5') || s.includes('ø')) return 'm7b5'
  if (s.includes('maj7') || s.includes('maj') || s.includes('Δ')) return 'maj7'
  if (s.includes('m7') || s.includes('min7') || s.includes('-7')) return 'min7'
  // Default to dominant for plain "7" chords
  return 'dom7'
}

// ---- Approach Notes ----

export type ApproachType = 'chromatic-below' | 'chromatic-above' | 'diatonic' | 'dominant'

export const APPROACH_TYPE_LABELS: Record<ApproachType, string> = {
  'chromatic-below': 'Half-step below',
  'chromatic-above': 'Half-step above',
  'diatonic': 'Whole-step below',
  'dominant': 'Dominant (5th)',
}

// ---- Patterns ----

export interface WalkingBassPattern {
  id: string
  name: string
  description: string
  /**
   * Intervals from root for each chord quality. Each array has exactly 4 entries.
   * `null` = approach note (computed from next chord's root).
   */
  intervals: Record<ChordQuality, (number | null)[]>
  /** Beat indices (0-3) that use approach notes */
  approachBeats: number[]
}

// ---- Steps & Sequences ----

export interface WalkingBassStep {
  /** Root pitch class (e.g., "F", "Bb") */
  root: string
  /** Starting octave */
  rootOctave: number
  /** Chord quality */
  quality: ChordQuality
  /** Display chord symbol (e.g., "F7", "Bbmaj7") */
  chordSymbol: string
  /** Optional display label override */
  label?: string
}

export interface WalkingBassSequence {
  id: string
  name: string
  description: string
  steps: WalkingBassStep[]
  /** Pattern to use (null = random/mixed) */
  patternId: string | null
  /** Approach note strategy */
  approachType: ApproachType
  /** Semitones to shift after each loop. 0 = no shift. */
  shiftSemitones?: number
  /** How many times to repeat */
  loopCount?: number
  /** Pitch class to stop shifting at */
  shiftUntilKey?: string
}

// ---- Session State ----

export interface WalkingBassRunResult {
  step: WalkingBassStep
  label: string
  notes: Note[]
  score: { correctNotes: number; incorrectNotes: number; totalNotes: number }
  completedAt: number
}

export interface CumulativeWalkingBassStats {
  totalNotes: number
  correctNotes: number
  incorrectNotes: number
  missedNotes: number
  runsCompleted: number
}

export const EMPTY_WALKING_BASS_STATS: CumulativeWalkingBassStats = {
  totalNotes: 0,
  correctNotes: 0,
  incorrectNotes: 0,
  missedNotes: 0,
  runsCompleted: 0,
}

export type WalkingBassPhase = 'idle' | 'playing' | 'stopped'

export interface WalkingBassSessionState {
  phase: WalkingBassPhase
  sequence: WalkingBassSequence
  currentStepIndex: number
  completedLoops: number
  results: WalkingBassRunResult[]
  currentNotes: Note[]
  currentLabel: string
  currentChordSymbol: string | null
  nextLabel: string | null
  cumulativeStats: CumulativeWalkingBassStats
}
