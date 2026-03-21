import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'

export interface StaffColors {
  note: string
  staffLine: string
  clef: string
  activeNote: string
}

export interface StaffConfig {
  lineSpacing: number
  staffTopMargin: number
  noteRadius: number
  stemLengthMultiplier: number
  beamThickness: number
  beamGap: number
  clefWidth: number
  timeSigWidth: number
  colors: StaffColors
}

export interface NoteLayout {
  note: Note
  duration: NoteDuration
  x: number
  y: number
  index: number
}

export interface RestLayout {
  x: number
  durationBeats: number
}

export type AccidentalType = 'sharp' | 'flat' | null
