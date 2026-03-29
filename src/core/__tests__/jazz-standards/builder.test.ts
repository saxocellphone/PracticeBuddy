import { describe, it, expect, vi } from 'vitest'
import type { Note } from '@core/wasm/types.ts'
import type { JazzStandard, JazzStandardMeasure } from '@core/jazz-standards/types.ts'

// ---------------------------------------------------------------------------
// WASM mocks
// ---------------------------------------------------------------------------

const PC_OFFSET: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

function fakeNoteFromName(name: string): Note {
  const match = name.match(/^([A-G][#b]?)(\d+)$/)
  if (!match) return { name, pitchClass: name, octave: 0, midi: 0, frequency: 0 }
  const pc = match[1]
  const oct = parseInt(match[2])
  const midi = (oct + 1) * 12 + (PC_OFFSET[pc] ?? 0)
  return { name, pitchClass: pc, octave: oct, midi, frequency: 440 * Math.pow(2, (midi - 69) / 12) }
}

vi.mock('@core/wasm/noteUtils.ts', () => ({
  noteFromName: vi.fn((n: string) => fakeNoteFromName(n)),
  noteFromMidi: vi.fn(),
  frequencyToNote: vi.fn(),
  midiToFrequency: vi.fn(),
  frequencyToMidi: vi.fn(),
  centsDistance: vi.fn(),
}))

// Import after mocks
import {
  standardToMelodyMeasures,
  standardToWalkingBassSequence,
} from '@core/jazz-standards/builder.ts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeStandard(measures: JazzStandardMeasure[]): JazzStandard {
  return {
    id: 'test-standard',
    title: 'Test Standard',
    composer: 'Test Composer',
    key: 'C',
    timeSignature: { beats: 4, value: 4 },
    form: 'AB',
    measures,
    melodyClef: 'treble',
  }
}

// ---------------------------------------------------------------------------
// standardToMelodyMeasures
// ---------------------------------------------------------------------------

describe('standardToMelodyMeasures', () => {
  it('converts melody notes to Note objects with correct durations', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Cmaj7', root: 'C', quality: 'maj7', beat: 1 }],
        melody: [
          { type: 'note', pitchClass: 'C', octave: 5, duration: 'half' },
          { type: 'note', pitchClass: 'E', octave: 5, duration: 'quarter' },
          { type: 'note', pitchClass: 'G', octave: 5, duration: 'quarter' },
        ],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result).toHaveLength(1)
    expect(result[0].notes).toHaveLength(3)
    expect(result[0].notes[0].note.pitchClass).toBe('C')
    expect(result[0].notes[0].note.octave).toBe(5)
    expect(result[0].notes[0].duration).toBe('half')
    expect(result[0].notes[1].note.pitchClass).toBe('E')
    expect(result[0].notes[1].duration).toBe('quarter')
    expect(result[0].notes[2].note.pitchClass).toBe('G')
    expect(result[0].notes[2].duration).toBe('quarter')
  })

  it('marks rest events in restIndices with placeholder notes', () => {
    const standard = makeStandard([
      {
        chords: [],
        melody: [
          { type: 'note', pitchClass: 'D', octave: 4, duration: 'half' },
          { type: 'rest', duration: 'half' },
        ],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result[0].notes).toHaveLength(2)
    expect(result[0].restIndices.has(0)).toBe(false)
    expect(result[0].restIndices.has(1)).toBe(true)
    // Rest placeholder should be B3
    expect(result[0].notes[1].note.pitchClass).toBe('B')
    expect(result[0].notes[1].note.octave).toBe(3)
    expect(result[0].notes[1].duration).toBe('half')
  })

  it('maps chord changes to MeasureLabel at correct note indices', () => {
    const standard = makeStandard([
      {
        chords: [
          { symbol: 'Fm7', root: 'F', quality: 'min7', beat: 1 },
          { symbol: 'Bb7', root: 'Bb', quality: 'dom7', beat: 3 },
        ],
        melody: [
          { type: 'note', pitchClass: 'Ab', octave: 4, duration: 'quarter' },  // beat 1
          { type: 'note', pitchClass: 'G', octave: 4, duration: 'quarter' },   // beat 2
          { type: 'note', pitchClass: 'F', octave: 4, duration: 'quarter' },   // beat 3
          { type: 'note', pitchClass: 'Eb', octave: 4, duration: 'quarter' },  // beat 4
        ],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result[0].labels).toHaveLength(2)
    expect(result[0].labels[0]).toEqual({ noteIndex: 0, text: 'Fm7' })
    expect(result[0].labels[1]).toEqual({ noteIndex: 2, text: 'Bb7' })
  })

  it('maps chord on beat 1 to eighth-note subdivisions correctly', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Dm7', root: 'D', quality: 'min7', beat: 1 }],
        melody: [
          { type: 'note', pitchClass: 'D', octave: 4, duration: 'eighth' },    // beat 1
          { type: 'note', pitchClass: 'E', octave: 4, duration: 'eighth' },    // beat 1.5
          { type: 'note', pitchClass: 'F', octave: 4, duration: 'quarter' },   // beat 2
          { type: 'note', pitchClass: 'A', octave: 4, duration: 'half' },      // beat 3
        ],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result[0].labels).toHaveLength(1)
    expect(result[0].labels[0]).toEqual({ noteIndex: 0, text: 'Dm7' })
  })

  it('handles multiple measures', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Cmaj7', root: 'C', quality: 'maj7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'C', octave: 5, duration: 'whole' }],
      },
      {
        chords: [{ symbol: 'Dm7', root: 'D', quality: 'min7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'D', octave: 5, duration: 'whole' }],
      },
      {
        chords: [{ symbol: 'G7', root: 'G', quality: 'dom7', beat: 1 }],
        melody: [{ type: 'rest', duration: 'whole' }],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result).toHaveLength(3)
    expect(result[0].notes[0].note.pitchClass).toBe('C')
    expect(result[1].notes[0].note.pitchClass).toBe('D')
    expect(result[2].restIndices.has(0)).toBe(true)
  })

  it('returns empty labels when measure has no chords', () => {
    const standard = makeStandard([
      {
        chords: [],
        melody: [{ type: 'note', pitchClass: 'C', octave: 4, duration: 'whole' }],
      },
    ])

    const result = standardToMelodyMeasures(standard)

    expect(result[0].labels).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// standardToWalkingBassSequence
// ---------------------------------------------------------------------------

describe('standardToWalkingBassSequence', () => {
  it('extracts one step per chord from single-chord measures', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Cmaj7', root: 'C', quality: 'maj7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'C', octave: 5, duration: 'whole' }],
      },
      {
        chords: [{ symbol: 'Dm7', root: 'D', quality: 'min7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'D', octave: 5, duration: 'whole' }],
      },
    ])

    const steps = standardToWalkingBassSequence(standard, 2)

    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({
      root: 'C',
      rootOctave: 2,
      quality: 'maj7',
      chordSymbol: 'Cmaj7',
    })
    expect(steps[1]).toEqual({
      root: 'D',
      rootOctave: 2,
      quality: 'min7',
      chordSymbol: 'Dm7',
    })
  })

  it('produces two steps for a measure with two chords', () => {
    const standard = makeStandard([
      {
        chords: [
          { symbol: 'Fm7', root: 'F', quality: 'min7', beat: 1 },
          { symbol: 'Bb7', root: 'Bb', quality: 'dom7', beat: 3 },
        ],
        melody: [
          { type: 'note', pitchClass: 'F', octave: 4, duration: 'half' },
          { type: 'note', pitchClass: 'Bb', octave: 4, duration: 'half' },
        ],
      },
    ])

    const steps = standardToWalkingBassSequence(standard, 2)

    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({
      root: 'F',
      rootOctave: 2,
      quality: 'min7',
      chordSymbol: 'Fm7',
    })
    expect(steps[1]).toEqual({
      root: 'Bb',
      rootOctave: 2,
      quality: 'dom7',
      chordSymbol: 'Bb7',
    })
  })

  it('uses the provided rootOctave for all steps', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Ebmaj7', root: 'Eb', quality: 'maj7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'Eb', octave: 5, duration: 'whole' }],
      },
    ])

    const steps3 = standardToWalkingBassSequence(standard, 3)
    expect(steps3[0].rootOctave).toBe(3)

    const steps1 = standardToWalkingBassSequence(standard, 1)
    expect(steps1[0].rootOctave).toBe(1)
  })

  it('handles empty measures (no chords) by skipping them', () => {
    const standard = makeStandard([
      {
        chords: [{ symbol: 'Cmaj7', root: 'C', quality: 'maj7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'C', octave: 5, duration: 'whole' }],
      },
      {
        chords: [],
        melody: [{ type: 'rest', duration: 'whole' }],
      },
      {
        chords: [{ symbol: 'G7', root: 'G', quality: 'dom7', beat: 1 }],
        melody: [{ type: 'note', pitchClass: 'G', octave: 4, duration: 'whole' }],
      },
    ])

    const steps = standardToWalkingBassSequence(standard, 2)

    expect(steps).toHaveLength(2)
    expect(steps[0].root).toBe('C')
    expect(steps[1].root).toBe('G')
  })
})
