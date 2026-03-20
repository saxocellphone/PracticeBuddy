import type { Note } from '@core/wasm/types.ts'
import type { ScaleSequence, ScaleStep, CumulativeStats } from '@core/endless/types.ts'

// ---- Note duration ----

export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'

/** Beat multiplier for each note duration relative to a quarter note */
export const NOTE_DURATION_BEATS: Record<NoteDuration, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
}

export const NOTE_DURATION_LABELS: Record<NoteDuration, string> = {
  whole: 'Whole',
  half: 'Half',
  quarter: 'Quarter',
  eighth: 'Eighth',
  sixteenth: 'Sixteenth',
}

export const NOTE_DURATIONS: NoteDuration[] = [
  'whole', 'half', 'quarter', 'eighth', 'sixteenth',
]

export const RHYTHM_DURATION_STORAGE_KEY = 'practicebuddy:rhythmDuration'
export const TIMING_WINDOWS_STORAGE_KEY = 'practicebuddy:timingWindows'

// ---- Timing grading ----

export type TimingResult = 'perfect' | 'good' | 'late' | 'missed'

export interface TimingWindows {
  perfectMs: number
  goodMs: number
  lateMs: number
}

/** Clamp a value between a minimum and maximum */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Compute BPM-relative timing windows.
 *
 * At slow tempos, players have more time per beat so the windows widen;
 * at fast tempos they tighten.  The clamp ensures the windows stay
 * within playable bounds at extreme BPM values.
 */
export function computeTimingWindows(bpm: number): TimingWindows {
  const beatMs = 60000 / bpm
  return {
    perfectMs: clamp(beatMs * 0.08, 25, 75),
    goodMs:    clamp(beatMs * 0.18, 50, 150),
    lateMs:    clamp(beatMs * 0.40, 100, 300),
  }
}

export function gradeTimingOffset(
  absoluteOffsetMs: number,
  windows: TimingWindows,
): TimingResult {
  if (absoluteOffsetMs <= windows.perfectMs) return 'perfect'
  if (absoluteOffsetMs <= windows.goodMs) return 'good'
  if (absoluteOffsetMs <= windows.lateMs) return 'late'
  return 'missed'
}

// ---- Unified scoring ----

/** Points awarded for a single note based on pitch correctness and timing */
export function scoreNote(pitchCorrect: boolean, timingResult: TimingResult): number {
  if (pitchCorrect) {
    switch (timingResult) {
      case 'perfect': return 10
      case 'good': return 8
      case 'late': return 5
      case 'missed': return 2
    }
  } else {
    switch (timingResult) {
      case 'perfect': return 1
      case 'good': return 1
      case 'late': return 0
      case 'missed': return 0
    }
  }
}

/** Human-readable label for a given point value */
export function scoreLabel(points: number): string {
  if (points >= 10) return 'Great'
  if (points >= 8) return 'Good'
  if (points >= 5) return 'OK'
  if (points >= 2) return 'Late'
  if (points >= 1) return 'Wrong note'
  return 'Missed'
}

// ---- Per-note rhythm result ----

export interface RhythmNoteEvent {
  /** Index within the flattened note array for this scale run */
  noteIndex: number
  /** The expected note */
  expectedNote: Note
  /** Scheduled onset time (AudioContext seconds) */
  scheduledTime: number
  /** Whether pitch was correct */
  pitchCorrect: boolean
  /** Detected note (if any) */
  detectedNote: Note | null
  /** Cents offset (0 if missed) */
  centsOff: number
  /** Timing result */
  timingResult: TimingResult
  /** Timing offset in ms (negative = early, positive = late) */
  timingOffsetMs: number
}

// ---- Rhythm session state ----

export type RhythmPhase = 'idle' | 'countdown' | 'playing' | 'stopped'

export interface RhythmSessionState {
  phase: RhythmPhase
  /** Countdown beats remaining (3, 2, 1) — only meaningful during 'countdown' */
  countdownBeat: number
  /** Current note index being played */
  currentNoteIndex: number
  /** All scheduled note events with results filled in as they complete */
  noteEvents: RhythmNoteEvent[]
  /** Total notes in the current scale */
  totalNotes: number
  /** Start time of the first note (AudioContext seconds) */
  startTime: number
  /** Current AudioContext time (updated per frame) */
  currentTime: number
  /** Current metronome beat index (0-based, mod beatsPerMeasure), driven by onBeat subscription */
  currentBeat: number
  /** BPM */
  bpm: number
  /** Note duration setting */
  noteDuration: NoteDuration
  /** Seconds per note */
  secondsPerNote: number
  /** Live feedback for the current note, shown immediately on pitch detection */
  liveFeedback: {
    noteIndex: number
    pitchCorrect: boolean
    timingResult: TimingResult
  } | null
}

// ---- Rhythm cumulative stats ----

export interface RhythmTimingStats {
  perfectCount: number
  goodCount: number
  lateCount: number
  missedCount: number
  averageOffsetMs: number
}

export interface RhythmScaleRunResult {
  step: ScaleStep
  label: string
  scaleNotes: Note[]
  noteEvents: RhythmNoteEvent[]
  /** Unified score percentage (0-100) combining pitch and timing */
  scorePercent: number
  timingStats: RhythmTimingStats
  completedAt: number
}

export interface RhythmCumulativeStats extends CumulativeStats {
  /** Unified score percentage (0-100) combining pitch and timing */
  overallScorePercent: number
  timing: RhythmTimingStats
}

/**
 * Tracks where each step's notes begin and end within the concatenated note array.
 * Used to split per-step results and update the active step label during playback.
 */
export interface StepBoundary {
  step: ScaleStep
  label: string
  /** Index of the first note in the concatenated array belonging to this step */
  startNoteIndex: number
  /** Index one past the last note (exclusive) */
  endNoteIndex: number
}

export interface RhythmEndlessState {
  phase: RhythmPhase | 'transitioning'
  sequence: ScaleSequence
  currentStepIndex: number
  completedLoops: number
  results: RhythmScaleRunResult[]
  currentScaleNotes: Note[]
  currentLabel: string
  nextLabel: string | null
  cumulativeStats: RhythmCumulativeStats
  /** Boundaries for each step within the concatenated note array */
  stepBoundaries: StepBoundary[]
}
