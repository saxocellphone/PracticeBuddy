import type { RestLayout } from './types.ts'

/** Candidate rest durations in descending order, including dotted values. */
const REST_CANDIDATES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25] as const

/**
 * Find the largest rest that fits the remaining beats at the current beat position.
 * Enforces the standard engraving rule: never use a single rest that crosses
 * beat 3 (the middle of a 4/4 bar), unless it is a whole rest filling the bar.
 */
function largestRestThatFits(remaining: number, beatPosition: number): number {
  for (const candidate of REST_CANDIDATES) {
    if (candidate > remaining) continue
    // A rest smaller than 4 beats must not cross beat 3
    if (candidate < 4 && beatPosition < 3 && (beatPosition + candidate) > 3) continue
    return candidate
  }
  return remaining // fallback
}

/**
 * Compute rest layout to fill an incomplete measure after a set of notes.
 *
 * Given the number of notes actually present, their duration in beats,
 * the total beats per measure, and the layout geometry, returns rest
 * positions and durations that correctly fill the remaining time.
 *
 * @param noteCount          - Number of notes already in the measure
 * @param noteDurationBeats  - Beat value of each note (e.g. 1 for quarter, 0.5 for eighth)
 * @param beatsPerMeasure    - Total beats in the measure (e.g. 4 for 4/4 time)
 * @param leftPad            - X offset for the start of the note area
 * @param availableWidth     - Total width available for notes (SVG units)
 * @param expectedNotesPerMeasure - How many notes a full measure would contain
 */
export function computeRestLayout(
  noteCount: number,
  noteDurationBeats: number,
  beatsPerMeasure: number,
  leftPad: number,
  availableWidth: number,
  expectedNotesPerMeasure: number,
): RestLayout[] {
  if (noteCount >= expectedNotesPerMeasure) return []

  const noteSpacing = availableWidth / expectedNotesPerMeasure
  const beatsFilled = noteCount * noteDurationBeats
  let remainingBeats = beatsPerMeasure - beatsFilled
  let beatPosition = beatsFilled + 1 // 1-indexed beat where rests start

  const rests: RestLayout[] = []

  while (remainingBeats > 0.001) { // float tolerance
    const restBeats = largestRestThatFits(remainingBeats, beatPosition)
    // Center x: convert center beat position to slot position on the note grid
    const centerBeat = beatPosition + restBeats / 2
    const centerSlot = (centerBeat - 1) / noteDurationBeats
    const x = leftPad + noteSpacing * centerSlot
    rests.push({ x, durationBeats: restBeats })
    beatPosition += restBeats
    remainingBeats -= restBeats
  }

  return rests
}
