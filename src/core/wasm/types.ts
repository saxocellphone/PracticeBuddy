// TypeScript interfaces matching Rust structs (camelCase via serde rename_all)

export interface Note {
  name: string
  pitchClass: string
  octave: number
  midi: number
  frequency: number
}

export interface FrequencyToNoteResult {
  note: Note
  centsOffset: number
}

export interface DetectedPitch {
  frequency: number
  clarity: number
}

export interface ScaleInfo {
  name: string
  displayName: string
  category: string
}

export interface NoteValidationResult {
  isCorrect: boolean
  centsOff: number
  expectedNote: Note
  detectedNote: Note
  detectedFrequency: number
  detectedClarity: number
  matchType: 'exact' | 'enharmonic' | 'wrongOctave' | 'octaveCorrected' | 'wrong'
}

export interface SessionConfig {
  scaleNotes: Note[]
  centsTolerance: number
  minHoldDetections: number
  ignoreOctave?: boolean
}

export type SessionPhase = 'Idle' | 'Playing' | 'Complete'

export interface SessionState {
  phase: SessionPhase
  currentNoteIndex: number
  totalNotes: number
  currentHoldCount: number
  minHoldDetections: number
  lastResult: string | null
  correctCount: number
  incorrectCount: number
}

export interface NoteAttempt {
  expectedNote: Note
  detectedNote: Note | null
  result: 'correct' | 'incorrect' | 'missed'
  centsOff: number
  detectedFrequency: number
}

export interface SessionScore {
  totalNotes: number
  correctNotes: number
  incorrectNotes: number
  missedNotes: number
  accuracyPercent: number
  averageCentsOffset: number
  noteResults: NoteAttempt[]
}

export type ScaleCategory = 'common' | 'pentatonic' | 'blues' | 'modes'
export type ScaleDirection = 'ascending' | 'descending' | 'both'
