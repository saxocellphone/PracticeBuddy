import type { Note } from '@core/wasm/types.ts'
import { scoreNote } from './types.ts'
import type {
  RhythmNoteEvent,
  RhythmTimingStats,
  RhythmScaleRunResult,
  RhythmCumulativeStats,
} from './types.ts'

export function computeTimingStats(events: RhythmNoteEvent[]): RhythmTimingStats {
  let perfectCount = 0
  let goodCount = 0
  let lateCount = 0
  let missedCount = 0
  let offsetSum = 0
  let offsetCount = 0

  for (const event of events) {
    switch (event.timingResult) {
      case 'perfect':
        perfectCount++
        break
      case 'good':
        goodCount++
        break
      case 'late':
        lateCount++
        break
      case 'missed':
        missedCount++
        break
    }
    if (event.timingResult !== 'missed') {
      offsetSum += event.timingOffsetMs
      offsetCount++
    }
  }

  return {
    perfectCount,
    goodCount,
    lateCount,
    missedCount,
    averageOffsetMs: offsetCount > 0 ? offsetSum / offsetCount : 0,
  }
}

export function computeRhythmCumulativeStats(
  results: RhythmScaleRunResult[],
): RhythmCumulativeStats {
  const totalScalesCompleted = results.length
  let totalNotesAttempted = 0
  let totalCorrect = 0
  let totalIncorrect = 0
  let totalMissed = 0
  let weightedCentsSum = 0
  let totalPoints = 0

  const allEvents: RhythmNoteEvent[] = []

  for (const r of results) {
    totalNotesAttempted += r.noteEvents.length

    for (const event of r.noteEvents) {
      allEvents.push(event)
      totalPoints += scoreNote(event.pitchCorrect, event.timingResult)
      if (event.pitchCorrect && event.timingResult !== 'missed') {
        totalCorrect++
        weightedCentsSum += Math.abs(event.centsOff)
      } else if (event.timingResult === 'missed') {
        totalMissed++
      } else {
        totalIncorrect++
      }
    }
  }

  const overallAccuracyPercent =
    totalNotesAttempted > 0 ? (totalCorrect / totalNotesAttempted) * 100 : 0
  const overallScorePercent =
    totalNotesAttempted > 0 ? (totalPoints / (10 * totalNotesAttempted)) * 100 : 0
  const averageCentsOffset =
    totalCorrect > 0 ? weightedCentsSum / totalCorrect : 0

  return {
    totalScalesCompleted,
    totalNotesAttempted,
    totalCorrect,
    totalIncorrect,
    totalMissed,
    overallAccuracyPercent,
    averageCentsOffset,
    overallScorePercent,
    timing: computeTimingStats(allEvents),
  }
}

export const EMPTY_TIMING_STATS: RhythmTimingStats = {
  perfectCount: 0,
  goodCount: 0,
  lateCount: 0,
  missedCount: 0,
  averageOffsetMs: 0,
}

export const EMPTY_CUMULATIVE: RhythmCumulativeStats = {
  totalScalesCompleted: 0,
  totalNotesAttempted: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalMissed: 0,
  overallAccuracyPercent: 0,
  averageCentsOffset: 0,
  overallScorePercent: 0,
  timing: EMPTY_TIMING_STATS,
}

export function makeEmptyNoteEvents(notes: Note[]): RhythmNoteEvent[] {
  return notes.map((note, i) => ({
    noteIndex: i,
    expectedNote: note,
    scheduledTime: 0,
    pitchCorrect: false,
    detectedNote: null,
    centsOff: 0,
    timingResult: 'missed' as const,
    timingOffsetMs: 0,
  }))
}
