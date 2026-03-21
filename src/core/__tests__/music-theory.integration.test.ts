/**
 * Integration tests for music theory pure functions:
 * - pitchClassesMatch (enharmonic comparison)
 * - isPitchMatch (pitch detection matching)
 * - computeTimingWindows (BPM-relative timing)
 * - buildAllStepsNotes + getActiveStepIndex (scale sequence building)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeNote } from '../../__test-utils__/helpers.ts'
import { pitchClassesMatch } from '@core/music/pitchClass.ts'
import { isPitchMatch } from '@core/rhythm/evaluation.ts'
import { computeTimingWindows } from '@core/rhythm/types.ts'
import type { Note } from '@core/wasm/types.ts'

// ---------------------------------------------------------------------------
// WASM mocks for buildAllStepsNotes (which calls buildScaleNotes -> buildScale)
// ---------------------------------------------------------------------------

let mockScaleNotes: Note[] = []

vi.mock('@core/wasm/scales.ts', () => ({
  buildScale: vi.fn((): Note[] => mockScaleNotes),
  getScaleType: vi.fn(() => ({})),
  listScaleTypes: vi.fn(() => []),
}))

vi.mock('@core/wasm/noteUtils.ts', () => ({
  frequencyToNote: vi.fn(),
}))

vi.mock('@core/wasm/init.ts', () => ({
  initWasm: vi.fn(async () => ({})),
  getWasm: vi.fn(() => ({})),
}))

// Import after mocks are declared so Vitest hoisting takes effect
import { buildAllStepsNotes, getActiveStepIndex } from '@core/rhythm/sequence.ts'
import { buildScale } from '@core/wasm/scales.ts'

// Cast the hoisted mock so we can call mockImplementation/mockClear
const mockBuildScale = vi.mocked(buildScale)

// ===========================================================================
// pitchClassesMatch
// ===========================================================================

describe('pitchClassesMatch', () => {
  it('returns true for the same note', () => {
    expect(pitchClassesMatch('C', 'C')).toBe(true)
  })

  it('returns true for enharmonic sharp/flat (C# and Db)', () => {
    expect(pitchClassesMatch('C#', 'Db')).toBe(true)
  })

  it('returns true for enharmonic E and Fb', () => {
    expect(pitchClassesMatch('E', 'Fb')).toBe(true)
  })

  it('returns true for enharmonic B# and C', () => {
    expect(pitchClassesMatch('B#', 'C')).toBe(true)
  })

  it('returns false for different notes (C and D)', () => {
    expect(pitchClassesMatch('C', 'D')).toBe(false)
  })

  it('verifies all 12 semitones with enharmonic equivalents', () => {
    // Each entry: [semitone, ...enharmonic spellings]
    const enharmonicGroups: string[][] = [
      ['C', 'B#'],       // 0
      ['C#', 'Db'],      // 1
      ['D'],             // 2
      ['D#', 'Eb'],      // 3
      ['E', 'Fb'],       // 4
      ['F', 'E#'],       // 5
      ['F#', 'Gb'],      // 6
      ['G'],             // 7
      ['G#', 'Ab'],      // 8
      ['A'],             // 9
      ['A#', 'Bb'],      // 10
      ['B', 'Cb'],       // 11
    ]

    // Within each group, all pairs should match
    for (const group of enharmonicGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i; j < group.length; j++) {
          expect(pitchClassesMatch(group[i], group[j])).toBe(true)
        }
      }
    }

    // Across groups, no pair should match
    for (let g1 = 0; g1 < enharmonicGroups.length; g1++) {
      for (let g2 = g1 + 1; g2 < enharmonicGroups.length; g2++) {
        for (const a of enharmonicGroups[g1]) {
          for (const b of enharmonicGroups[g2]) {
            expect(pitchClassesMatch(a, b)).toBe(false)
          }
        }
      }
    }
  })

  it('returns false gracefully for an invalid pitch class', () => {
    expect(pitchClassesMatch('C', 'X')).toBe(false)
    expect(pitchClassesMatch('Z', 'D')).toBe(false)
    expect(pitchClassesMatch('', '')).toBe(false)
  })
})

// ===========================================================================
// isPitchMatch
// ===========================================================================

describe('isPitchMatch', () => {
  it('returns true for same MIDI within cents tolerance', () => {
    const detected = makeNote('C', 4, 60)
    const expected = makeNote('C', 4, 60)
    expect(isPitchMatch(detected, expected, 10, 40, false)).toBe(true)
  })

  it('returns false for same MIDI outside cents tolerance', () => {
    const detected = makeNote('C', 4, 60)
    const expected = makeNote('C', 4, 60)
    expect(isPitchMatch(detected, expected, 50, 40, false)).toBe(false)
  })

  it('returns true for different MIDI, same pitchClass, ignoreOctave=true', () => {
    const detected = makeNote('C', 3, 48) // C3
    const expected = makeNote('C', 4, 60) // C4
    expect(isPitchMatch(detected, expected, 5, 40, true)).toBe(true)
  })

  it('returns false for different MIDI, same pitchClass, ignoreOctave=false', () => {
    const detected = makeNote('C', 3, 48) // C3
    const expected = makeNote('C', 4, 60) // C4
    expect(isPitchMatch(detected, expected, 5, 40, false)).toBe(false)
  })

  it('returns true for enharmonic match with ignoreOctave (C# detected, Db expected)', () => {
    const detected = makeNote('C#', 3, 49)
    const expected = makeNote('Db', 4, 61)
    expect(isPitchMatch(detected, expected, 0, 40, true)).toBe(true)
  })

  it('returns true when cents offset is exactly at the tolerance boundary', () => {
    const detected = makeNote('C', 4, 60)
    const expected = makeNote('C', 4, 60)
    expect(isPitchMatch(detected, expected, 40, 40, false)).toBe(true)
    // Also check negative offset (Math.abs handles it)
    expect(isPitchMatch(detected, expected, -40, 40, false)).toBe(true)
  })

  it('returns false when cents offset is 1 cent over tolerance', () => {
    const detected = makeNote('C', 4, 60)
    const expected = makeNote('C', 4, 60)
    expect(isPitchMatch(detected, expected, 41, 40, false)).toBe(false)
    expect(isPitchMatch(detected, expected, -41, 40, false)).toBe(false)
  })
})

// ===========================================================================
// computeTimingWindows
// ===========================================================================

describe('computeTimingWindows', () => {
  it('computes correct windows at 120 BPM', () => {
    const windows = computeTimingWindows(120)
    // beatMs = 60000 / 120 = 500
    // perfectMs = clamp(500 * 0.08, 25, 75) = clamp(40, 25, 75) = 40
    // goodMs    = clamp(500 * 0.18, 50, 150) = clamp(90, 50, 150) = 90
    // lateMs    = clamp(500 * 0.40, 100, 300) = clamp(200, 100, 300) = 200
    expect(windows.perfectMs).toBe(40)
    expect(windows.goodMs).toBe(90)
    expect(windows.lateMs).toBe(200)
  })

  it('hits ceilings at 60 BPM', () => {
    const windows = computeTimingWindows(60)
    // beatMs = 60000 / 60 = 1000
    // perfectMs = clamp(1000 * 0.08, 25, 75) = clamp(80, 25, 75) = 75
    // goodMs    = clamp(1000 * 0.18, 50, 150) = clamp(180, 50, 150) = 150
    // lateMs    = clamp(1000 * 0.40, 100, 300) = clamp(400, 100, 300) = 300
    expect(windows.perfectMs).toBe(75)
    expect(windows.goodMs).toBe(150)
    expect(windows.lateMs).toBe(300)
  })

  it('hits floor for perfectMs at 240 BPM', () => {
    const windows = computeTimingWindows(240)
    // beatMs = 60000 / 240 = 250
    // perfectMs = clamp(250 * 0.08, 25, 75) = clamp(20, 25, 75) = 25
    // goodMs    = clamp(250 * 0.18, 50, 150) = clamp(45, 50, 150) = 50
    // lateMs    = clamp(250 * 0.40, 100, 300) = clamp(100, 100, 300) = 100
    expect(windows.perfectMs).toBe(25)
    expect(windows.goodMs).toBe(50)
    expect(windows.lateMs).toBe(100)
  })

  it('hits all ceilings at 30 BPM', () => {
    const windows = computeTimingWindows(30)
    // beatMs = 60000 / 30 = 2000
    // perfectMs = clamp(2000 * 0.08, 25, 75) = clamp(160, 25, 75) = 75
    // goodMs    = clamp(2000 * 0.18, 50, 150) = clamp(360, 50, 150) = 150
    // lateMs    = clamp(2000 * 0.40, 100, 300) = clamp(800, 100, 300) = 300
    expect(windows.perfectMs).toBe(75)
    expect(windows.goodMs).toBe(150)
    expect(windows.lateMs).toBe(300)
  })

  it('maintains monotonicity: perfectMs < goodMs < lateMs for various BPMs', () => {
    const bpmValues = [30, 60, 80, 100, 120, 150, 180, 200, 240, 300]
    for (const bpm of bpmValues) {
      const windows = computeTimingWindows(bpm)
      expect(windows.perfectMs).toBeLessThan(windows.goodMs)
      expect(windows.goodMs).toBeLessThan(windows.lateMs)
    }
  })
})

// ===========================================================================
// buildAllStepsNotes + getActiveStepIndex
// ===========================================================================

describe('buildAllStepsNotes + getActiveStepIndex', () => {
  beforeEach(() => {
    mockScaleNotes = []
    mockBuildScale.mockClear()
    mockBuildScale.mockImplementation(() => mockScaleNotes)
  })

  it('builds notes and boundaries for a single step', () => {
    mockScaleNotes = [
      makeNote('C', 3),
      makeNote('D', 3),
      makeNote('E', 3),
      makeNote('F', 3),
      makeNote('G', 3),
    ]

    const sequence = {
      id: 'test',
      name: 'Test',
      description: 'Single step test',
      steps: [{ rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 }],
      direction: 'ascending' as const,
    }

    const { allNotes, boundaries } = buildAllStepsNotes(sequence, false)

    expect(allNotes).toHaveLength(5)
    expect(boundaries).toHaveLength(1)
    expect(boundaries[0].startNoteIndex).toBe(0)
    expect(boundaries[0].endNoteIndex).toBe(5)
  })

  it('builds non-overlapping boundaries that cover all notes for two steps', () => {
    const step1Notes = [makeNote('C', 3), makeNote('D', 3), makeNote('E', 3)]
    const step2Notes = [makeNote('F', 3), makeNote('G', 3)]

    // buildScale is called once per step; alternate return values
    let callCount = 0
    mockBuildScale.mockImplementation(() => {
      callCount++
      return callCount === 1 ? step1Notes : step2Notes
    })

    const sequence = {
      id: 'test',
      name: 'Test',
      description: 'Two step test',
      steps: [
        { rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 },
        { rootNote: 'F', rootOctave: 3, scaleTypeIndex: 0 },
      ],
      direction: 'ascending' as const,
    }

    const { allNotes, boundaries } = buildAllStepsNotes(sequence, false)

    expect(allNotes).toHaveLength(5) // 3 + 2
    expect(boundaries).toHaveLength(2)

    // Boundaries should not overlap
    expect(boundaries[0].startNoteIndex).toBe(0)
    expect(boundaries[0].endNoteIndex).toBe(3)
    expect(boundaries[1].startNoteIndex).toBe(3)
    expect(boundaries[1].endNoteIndex).toBe(5)

    // Boundaries should be contiguous (no gaps)
    expect(boundaries[0].endNoteIndex).toBe(boundaries[1].startNoteIndex)
  })

  it('getActiveStepIndex finds correct step for noteIndex at step boundaries', () => {
    const boundaries = [
      { step: { rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 1', startNoteIndex: 0, endNoteIndex: 4 },
      { step: { rootNote: 'D', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 2', startNoteIndex: 4, endNoteIndex: 8 },
      { step: { rootNote: 'E', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 3', startNoteIndex: 8, endNoteIndex: 12 },
    ]

    // At the exact start of each step
    expect(getActiveStepIndex(boundaries, 0)).toBe(0)
    expect(getActiveStepIndex(boundaries, 4)).toBe(1)
    expect(getActiveStepIndex(boundaries, 8)).toBe(2)
  })

  it('getActiveStepIndex finds correct step for noteIndex in the middle of a step', () => {
    const boundaries = [
      { step: { rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 1', startNoteIndex: 0, endNoteIndex: 4 },
      { step: { rootNote: 'D', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 2', startNoteIndex: 4, endNoteIndex: 8 },
    ]

    expect(getActiveStepIndex(boundaries, 2)).toBe(0)
    expect(getActiveStepIndex(boundaries, 6)).toBe(1)
  })

  it('getActiveStepIndex finds correct step for the last note of the last step', () => {
    const boundaries = [
      { step: { rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 1', startNoteIndex: 0, endNoteIndex: 4 },
      { step: { rootNote: 'D', rootOctave: 3, scaleTypeIndex: 0 }, label: 'Step 2', startNoteIndex: 4, endNoteIndex: 8 },
    ]

    // Last note is at index 7 (endNoteIndex 8 is exclusive)
    expect(getActiveStepIndex(boundaries, 7)).toBe(1)
  })
})
