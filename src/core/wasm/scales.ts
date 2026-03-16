import { getWasm } from './init.ts'
import type { Note, ScaleInfo, ScaleDirection } from './types.ts'

// Re-export ScaleType enum from WASM
export function getScaleType() {
  return getWasm().ScaleType
}

export function buildScale(
  rootNote: string,
  scaleType: number, // ScaleType enum value
  direction: ScaleDirection = 'ascending'
): Note[] {
  return getWasm().buildScale(rootNote, scaleType, direction) as Note[]
}

export function listScaleTypes(): ScaleInfo[] {
  return getWasm().listScaleTypes() as ScaleInfo[]
}
