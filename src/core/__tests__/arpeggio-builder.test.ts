/**
 * Tests for buildArpeggioNotes — constructs Note arrays from arpeggio steps.
 *
 * WASM noteFromName and noteFromMidi are mocked to produce Note objects
 * with correct MIDI numbers, allowing us to verify interval construction,
 * direction handling, and bass-range octave shifting.
 */
import { describe, it, expect, vi } from 'vitest'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioStep } from '@core/arpeggio/types.ts'

// ---------------------------------------------------------------------------
// WASM mocks
// ---------------------------------------------------------------------------

/** Pitch class → semitone offset from C */
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
import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function majorStep(root: string, octave: number): ArpeggioStep {
  return { root, rootOctave: octave, arpeggioType: 'Major' }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildArpeggioNotes', () => {
  // ---- Ascending direction ----

  describe('ascending', () => {
    it('builds a major triad with correct MIDI intervals', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'ascending')
      expect(notes).toHaveLength(3) // [0, 4, 7]
      // C2, E2, G2
      expect(notes[0].midi).toBe(fakeNoteFromName('C2').midi)
      expect(notes[1].midi - notes[0].midi).toBe(4) // major third
      expect(notes[2].midi - notes[0].midi).toBe(7) // perfect fifth
    })

    it('builds a minor7 arpeggio with 4 notes', () => {
      const step: ArpeggioStep = { root: 'D', rootOctave: 2, arpeggioType: 'Minor7' }
      const { notes } = buildArpeggioNotes(step, 'ascending')
      expect(notes).toHaveLength(4) // [0, 3, 7, 10]
      expect(notes[1].midi - notes[0].midi).toBe(3)
      expect(notes[2].midi - notes[0].midi).toBe(7)
      expect(notes[3].midi - notes[0].midi).toBe(10)
    })

    it('builds a diminished triad with 3 notes', () => {
      const step: ArpeggioStep = { root: 'B', rootOctave: 2, arpeggioType: 'Diminished' }
      const { notes } = buildArpeggioNotes(step, 'ascending')
      expect(notes).toHaveLength(3) // [0, 3, 6]
      expect(notes[1].midi - notes[0].midi).toBe(3)
      expect(notes[2].midi - notes[0].midi).toBe(6)
    })

    it('notes are in ascending MIDI order', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'ascending')
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].midi).toBeGreaterThan(notes[i - 1].midi)
      }
    })
  })

  // ---- Descending direction ----

  describe('descending', () => {
    it('reverses the note order', () => {
      const { notes: asc } = buildArpeggioNotes(majorStep('C', 2), 'ascending')
      const { notes: desc } = buildArpeggioNotes(majorStep('C', 2), 'descending')
      expect(desc).toHaveLength(asc.length)
      expect(desc[0].midi).toBe(asc[asc.length - 1].midi)
      expect(desc[desc.length - 1].midi).toBe(asc[0].midi)
    })

    it('notes are in descending MIDI order', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'descending')
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].midi).toBeLessThan(notes[i - 1].midi)
      }
    })
  })

  // ---- Ascending-descending direction ----

  describe('ascendingDescending', () => {
    it('plays up then back down without repeating the top note', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'ascendingDescending')
      // Major triad: [C, E, G] ascending = 3 notes, descending skip top = 2 notes => 5 total
      expect(notes).toHaveLength(5) // C E G E C
    })

    it('first note equals last note', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'ascendingDescending')
      expect(notes[0].midi).toBe(notes[notes.length - 1].midi)
    })

    it('has a symmetric structure around the top note', () => {
      const { notes } = buildArpeggioNotes(majorStep('C', 2), 'ascendingDescending')
      // C E G E C — first half ascending, second half descending
      expect(notes[0].midi).toBeLessThan(notes[1].midi) // ascending
      expect(notes[1].midi).toBeLessThan(notes[2].midi) // ascending
      expect(notes[2].midi).toBeGreaterThan(notes[3].midi) // descending
      expect(notes[3].midi).toBeGreaterThan(notes[4].midi) // descending
    })
  })

  // ---- Octave range shifting ----

  describe('octave range shifting', () => {
    it('shifts down when notes exceed bass max MIDI (67)', () => {
      // G4 is MIDI 67, so an arpeggio starting at G4 would have notes above 67
      const step: ArpeggioStep = { root: 'G', rootOctave: 4, arpeggioType: 'Major' }
      const { notes, octaveShift } = buildArpeggioNotes(step, 'ascending')
      // G Major = G, B, D — at octave 4: G4(67), B4(71), D5(74)
      // B4 and D5 exceed BASS_MAX_MIDI, so should shift down
      expect(octaveShift).toBeLessThan(0)
      for (const note of notes) {
        expect(note.midi).toBeLessThanOrEqual(67)
      }
    })

    it('shifts up when notes are below bass min MIDI (28)', () => {
      // E1 is MIDI 28, C1 would be MIDI 24
      const step: ArpeggioStep = { root: 'C', rootOctave: 1, arpeggioType: 'Major' }
      const { notes, octaveShift } = buildArpeggioNotes(step, 'ascending')
      // C1(24) is below min — should shift up
      expect(octaveShift).toBeGreaterThan(0)
      for (const note of notes) {
        expect(note.midi).toBeGreaterThanOrEqual(28)
      }
    })

    it('returns octaveShift 0 when notes are within bass range', () => {
      const step: ArpeggioStep = { root: 'C', rootOctave: 2, arpeggioType: 'Major' }
      const { octaveShift } = buildArpeggioNotes(step, 'ascending')
      // C2(36), E2(40), G2(43) — all within [28, 67]
      expect(octaveShift).toBe(0)
    })
  })

  // ---- Accidental respelling ----

  describe('accidental respelling', () => {
    it('respells flat accidentals to sharps for sharp-convention roots', () => {
      // D major = D, F#, A — root 'D' uses sharp convention
      const step: ArpeggioStep = { root: 'D', rootOctave: 2, arpeggioType: 'Major' }
      const { notes } = buildArpeggioNotes(step, 'ascending')
      // The third (F#) should use sharp, not Gb
      const third = notes[1]
      expect(third.pitchClass).not.toBe('Gb')
      // MIDI interval should be 4 (major third)
      expect(third.midi - notes[0].midi).toBe(4)
    })

    it('respells sharp accidentals to flats for flat-convention roots', () => {
      // F major = F, A, C — but Bb major = Bb, D, F
      const step: ArpeggioStep = { root: 'Bb', rootOctave: 2, arpeggioType: 'Major' }
      const { notes } = buildArpeggioNotes(step, 'ascending')
      // Root should remain Bb (not A#)
      expect(notes[0].pitchClass).toBe('Bb')
    })
  })
})
