import { getWasm } from './init.ts'
import type { NoteValidationResult } from './types.ts'

export function validateNote(
  detectedFrequency: number,
  detectedClarity: number,
  expectedMidi: number,
  centsTolerance: number = 50
): NoteValidationResult {
  return getWasm().validateNote(
    detectedFrequency,
    detectedClarity,
    expectedMidi,
    centsTolerance
  ) as NoteValidationResult
}
