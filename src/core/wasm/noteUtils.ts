import { getWasm } from './init.ts'
import type { Note, FrequencyToNoteResult } from './types.ts'

export function frequencyToMidi(frequency: number): number {
  return getWasm().frequencyToMidi(frequency)
}

export function midiToFrequency(midi: number): number {
  return getWasm().midiToFrequency(midi)
}

export function centsDistance(freqA: number, freqB: number): number {
  return getWasm().centsDistance(freqA, freqB)
}

export function frequencyToNote(frequency: number): FrequencyToNoteResult {
  return getWasm().frequencyToNote(frequency) as FrequencyToNoteResult
}

export function noteFromName(name: string): Note {
  return getWasm().noteFromName(name) as Note
}

export function noteFromMidi(midi: number): Note {
  return getWasm().noteFromMidi(midi) as Note
}
