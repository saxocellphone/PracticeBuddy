import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { MeasureLabel } from '../MeasureStaff.tsx'
import type { SheetMeasure } from './types.ts'

const BEATS_PER_MEASURE = 4

/**
 * Convert a flat Note[] + uniform duration into SheetMeasure[].
 * Converts global restIndices to per-measure local sets.
 */
export function groupNotesIntoMeasures(
  notes: Note[],
  duration: NoteDuration,
  options?: {
    restIndices?: Set<number>
    measureLabels?: Map<number, MeasureLabel[]>
  },
): SheetMeasure[] {
  const durationBeats = NOTE_DURATION_BEATS[duration]
  const notesPerMeasure = Math.round(BEATS_PER_MEASURE / durationBeats)
  const measures: SheetMeasure[] = []

  for (let i = 0; i < notes.length; i += notesPerMeasure) {
    const slice = notes.slice(i, i + notesPerMeasure)
    const measureIndex = measures.length

    // Convert global restIndices to local
    let localRests: Set<number> | undefined
    if (options?.restIndices) {
      const local = new Set<number>()
      for (let j = 0; j < slice.length; j++) {
        if (options.restIndices.has(i + j)) {
          local.add(j)
        }
      }
      if (local.size > 0) localRests = local
    }

    measures.push({
      notes: slice.map(note => ({ note, duration })),
      labels: options?.measureLabels?.get(measureIndex),
      restIndices: localRests,
    })
  }
  return measures
}
