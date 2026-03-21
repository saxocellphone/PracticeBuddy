import { frequencyToNote } from '@core/wasm/noteUtils.ts'
import { pitchClassesMatch } from '@core/music/pitchClass.ts'
import { gradeTimingOffset } from './types.ts'
import type { DetectedPitch, Note } from '@core/wasm/types.ts'
import type { RhythmNoteEvent, TimingResult, TimingWindows } from './types.ts'

/** Maximum number of pitch samples to keep per note window */
export const MAX_PITCH_SAMPLES = 20

export interface PitchSample {
  pitch: DetectedPitch
  offsetMs: number
}

/**
 * Check whether a detected note matches the expected note,
 * using enharmonic-aware pitch class comparison.
 */
export function isPitchMatch(
  detected: Note,
  expected: Note,
  centsOffset: number,
  centsTolerance: number,
  ignoreOctave: boolean,
): boolean {
  const withinTolerance = Math.abs(centsOffset) <= centsTolerance
  if (ignoreOctave) {
    return pitchClassesMatch(detected.pitchClass, expected.pitchClass) && withinTolerance
  }
  return detected.midi === expected.midi && withinTolerance
}

/**
 * Evaluate the pitch match for a note whose time window just expired.
 *
 * Instead of relying on a single "best" detection (closest to the
 * scheduled beat), we look at ALL samples collected during the window:
 *
 *  1. Check if any sample matches the expected pitch (enharmonic-aware).
 *     Among matches, pick the one closest to the scheduled time.
 *  2. If no sample matches, pick the one with the highest clarity
 *     (most reliable detection) to report what was actually played.
 *  3. Timing is graded from the best matching sample when a pitch match
 *     exists, or from the closest sample when no match is found.
 *     This ensures consistency with live feedback timing.
 */
export function evaluateNote(
  noteIndex: number,
  expectedNote: Note,
  scheduledTime: number,
  samples: PitchSample[],
  closestSample: PitchSample | null,
  timingWindows: TimingWindows,
  centsTolerance: number,
  ignoreOctave: boolean,
): RhythmNoteEvent {
  if (samples.length === 0 || !closestSample) {
    return {
      noteIndex,
      expectedNote,
      scheduledTime,
      pitchCorrect: false,
      detectedNote: null,
      centsOff: 0,
      timingResult: 'missed',
      timingOffsetMs: 0,
    }
  }

  // Analyze all samples for pitch correctness
  let bestMatch: { noteResult: ReturnType<typeof frequencyToNote>; sample: PitchSample } | null = null
  let bestNonMatch: { noteResult: ReturnType<typeof frequencyToNote>; clarity: number } | null = null

  for (const sample of samples) {
    const noteResult = frequencyToNote(sample.pitch.frequency)
    const matches = isPitchMatch(noteResult.note, expectedNote, noteResult.centsOffset, centsTolerance, ignoreOctave)

    if (matches) {
      // Among matching samples, prefer the one closest to scheduled time
      if (
        !bestMatch ||
        Math.abs(sample.offsetMs) < Math.abs(bestMatch.sample.offsetMs)
      ) {
        bestMatch = { noteResult, sample }
      }
    } else {
      // Among non-matching samples, prefer the one with highest clarity
      if (!bestNonMatch || sample.pitch.clarity > bestNonMatch.clarity) {
        bestNonMatch = { noteResult, clarity: sample.pitch.clarity }
      }
    }
  }

  if (bestMatch) {
    // Use timing from the best matching sample — this reflects when the
    // correct note was actually played, matching the live feedback logic.
    const timingOffsetMs = bestMatch.sample.offsetMs
    const absoluteOffset = Math.abs(timingOffsetMs)
    const timingResult = gradeTimingOffset(absoluteOffset, timingWindows)
    return {
      noteIndex,
      expectedNote,
      scheduledTime,
      pitchCorrect: true,
      detectedNote: bestMatch.noteResult.note,
      centsOff: bestMatch.noteResult.centsOffset,
      timingResult,
      timingOffsetMs,
    }
  }

  // No matching sample found — use closestSample for timing (reflects when
  // the player played, even though the note was wrong).
  const timingOffsetMs = closestSample.offsetMs
  const absoluteOffset = Math.abs(timingOffsetMs)
  const timingResult = gradeTimingOffset(absoluteOffset, timingWindows)
  const fallback = bestNonMatch!
  return {
    noteIndex,
    expectedNote,
    scheduledTime,
    pitchCorrect: false,
    detectedNote: fallback.noteResult.note,
    centsOff: fallback.noteResult.centsOffset,
    timingResult,
    timingOffsetMs,
  }
}

/**
 * Compute live feedback for a pitch detection against the current expected note.
 * Returns null if no feedback should be shown.
 */
export function computeLiveFeedback(
  pitch: DetectedPitch,
  expectedNote: Note,
  offsetMs: number,
  timingWindows: TimingWindows,
  centsTolerance: number,
  ignoreOctave: boolean,
  currentFeedback: { noteIndex: number; pitchCorrect: boolean; timingResult: TimingResult; timingOffsetMs: number } | null,
  noteIndex: number,
): { noteIndex: number; pitchCorrect: boolean; timingResult: TimingResult; timingOffsetMs: number } | null {
  const alreadyCorrect = currentFeedback?.noteIndex === noteIndex && currentFeedback.pitchCorrect

  // Skip if we already confirmed a correct pitch for this note
  if (alreadyCorrect) return null

  const noteResult = frequencyToNote(pitch.frequency)
  const matches = isPitchMatch(noteResult.note, expectedNote, noteResult.centsOffset, centsTolerance, ignoreOctave)
  const absoluteOffset = Math.abs(offsetMs)
  const timingResult = gradeTimingOffset(absoluteOffset, timingWindows)

  // Show on first detection, or upgrade from wrong to correct
  if (currentFeedback?.noteIndex !== noteIndex || matches) {
    return { noteIndex, pitchCorrect: matches, timingResult, timingOffsetMs: offsetMs }
  }

  return null
}
