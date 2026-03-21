/**
 * Tests for the arpeggio sequence adapter — converts arpeggio types
 * into formats compatible with the rhythm engine.
 *
 * Covers buildAllArpeggioStepsNotes and arpeggioToScaleSequence.
 */
import { describe, it, expect, vi } from 'vitest'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioSequence } from '@core/arpeggio/types.ts'

// ---------------------------------------------------------------------------
// WASM mocks — same pattern as arpeggio-builder tests
// ---------------------------------------------------------------------------

const PC_OFFSET: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function fakeNoteFromName(name: string): Note {
  const match = name.match(/^([A-G][#b]?)(\d+)$/)
  if (!match) return { name, pitchClass: name, octave: 0, midi: 0, frequency: 0 }
  const pc = match[1]
  const oct = parseInt(match[2])
  const midi = (oct + 1) * 12 + (PC_OFFSET[pc] ?? 0)
  return { name, pitchClass: pc, octave: oct, midi, frequency: 440 * Math.pow(2, (midi - 69) / 12) }
}

function fakeNoteFromMidi(midi: number): Note {
  const octave = Math.floor(midi / 12) - 1
  const pc = NOTE_NAMES[midi % 12]
  const name = `${pc}${octave}`
  return { name, pitchClass: pc, octave, midi, frequency: 440 * Math.pow(2, (midi - 69) / 12) }
}

vi.mock('@core/wasm/noteUtils.ts', () => ({
  noteFromName: vi.fn((n: string) => fakeNoteFromName(n)),
  noteFromMidi: vi.fn((m: number) => fakeNoteFromMidi(m)),
  frequencyToNote: vi.fn(),
  midiToFrequency: vi.fn(),
  frequencyToMidi: vi.fn(),
  centsDistance: vi.fn(),
}))

// Import after mocks
import { buildAllArpeggioStepsNotes, arpeggioToScaleSequence } from '@core/arpeggio/sequence.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSequence(stepCount: number, direction: 'ascending' | 'descending' | 'ascendingDescending' = 'ascending'): ArpeggioSequence {
  const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  return {
    id: 'test-seq',
    name: 'Test Sequence',
    description: 'Test',
    direction,
    steps: Array.from({ length: stepCount }, (_, i) => ({
      root: roots[i % roots.length],
      rootOctave: 2,
      arpeggioType: 'Major' as const,
    })),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildAllArpeggioStepsNotes', () => {
  it('concatenates notes from all steps into a single array', () => {
    const seq = makeSequence(2)
    const { allNotes, boundaries } = buildAllArpeggioStepsNotes(seq, false)

    // Each major triad has 3 notes ascending, so 2 steps = 6 notes
    expect(allNotes).toHaveLength(6)
    expect(boundaries).toHaveLength(2)
  })

  it('boundaries have contiguous startNoteIndex and endNoteIndex', () => {
    const seq = makeSequence(3)
    const { boundaries } = buildAllArpeggioStepsNotes(seq, false)

    expect(boundaries[0].startNoteIndex).toBe(0)
    for (let i = 1; i < boundaries.length; i++) {
      expect(boundaries[i].startNoteIndex).toBe(boundaries[i - 1].endNoteIndex)
    }
  })

  it('last boundary endNoteIndex equals total note count', () => {
    const seq = makeSequence(3)
    const { allNotes, boundaries } = buildAllArpeggioStepsNotes(seq, false)

    expect(boundaries[boundaries.length - 1].endNoteIndex).toBe(allNotes.length)
  })

  it('boundaries contain step labels', () => {
    const seq = makeSequence(2)
    const { boundaries } = buildAllArpeggioStepsNotes(seq, false)

    for (const boundary of boundaries) {
      expect(boundary.label).toBeTruthy()
    }
  })

  it('boundaries contain ScaleStep-shaped step with scaleTypeIndex -1', () => {
    const seq = makeSequence(1)
    const { boundaries } = buildAllArpeggioStepsNotes(seq, false)

    expect(boundaries[0].step.scaleTypeIndex).toBe(-1)
    expect(boundaries[0].step.rootNote).toBe('C')
    expect(boundaries[0].step.rootOctave).toBe(2)
  })

  it('single step has startNoteIndex 0', () => {
    const seq = makeSequence(1)
    const { boundaries } = buildAllArpeggioStepsNotes(seq, false)

    expect(boundaries[0].startNoteIndex).toBe(0)
  })

  it('handles ascendingDescending direction (more notes per step)', () => {
    const seq = makeSequence(1, 'ascendingDescending')
    const { allNotes } = buildAllArpeggioStepsNotes(seq, false)

    // Major triad ascending-descending: C E G E C = 5 notes
    expect(allNotes).toHaveLength(5)
  })
})

describe('arpeggioToScaleSequence', () => {
  it('maps basic fields from ArpeggioSequence to ScaleSequence', () => {
    const arpSeq = makeSequence(2)
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)

    expect(scaleSeq.id).toBe(arpSeq.id)
    expect(scaleSeq.name).toBe(arpSeq.name)
    expect(scaleSeq.description).toBe(arpSeq.description)
  })

  it('maps ascending direction to ascending', () => {
    const arpSeq = makeSequence(1, 'ascending')
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)
    expect(scaleSeq.direction).toBe('ascending')
  })

  it('maps descending direction to descending', () => {
    const arpSeq = makeSequence(1, 'descending')
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)
    expect(scaleSeq.direction).toBe('descending')
  })

  it('maps ascendingDescending direction to both', () => {
    const arpSeq = makeSequence(1, 'ascendingDescending')
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)
    expect(scaleSeq.direction).toBe('both')
  })

  it('preserves shiftSemitones and skipTransition', () => {
    const arpSeq: ArpeggioSequence = {
      ...makeSequence(1),
      shiftSemitones: 5,
      skipTransition: true,
    }
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)
    expect(scaleSeq.shiftSemitones).toBe(5)
    expect(scaleSeq.skipTransition).toBe(true)
  })

  it('converts ArpeggioSteps to ScaleSteps with scaleTypeIndex -1', () => {
    const arpSeq = makeSequence(2)
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)

    expect(scaleSeq.steps).toHaveLength(2)
    for (const step of scaleSeq.steps) {
      expect(step.scaleTypeIndex).toBe(-1)
    }
  })

  it('uses arpeggio root as ScaleStep rootNote', () => {
    const arpSeq = makeSequence(2)
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)

    expect(scaleSeq.steps[0].rootNote).toBe('C')
    expect(scaleSeq.steps[1].rootNote).toBe('D')
  })

  it('generates labels with octave when ignoreOctave is false', () => {
    const arpSeq = makeSequence(1)
    const scaleSeq = arpeggioToScaleSequence(arpSeq, false)
    expect(scaleSeq.steps[0].label).toContain('2')
  })

  it('strips octave from labels when ignoreOctave is true', () => {
    const arpSeq = makeSequence(1)
    const scaleSeq = arpeggioToScaleSequence(arpSeq, true)
    expect(scaleSeq.steps[0].label).not.toMatch(/\d/)
  })
})
