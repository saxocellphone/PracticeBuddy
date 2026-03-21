/**
 * Tests for arpeggio preset templates.
 *
 * Validates that all presets generate valid ArpeggioSequences,
 * single-quality presets have 1 step, and progression presets
 * use the correct arpeggio quality pattern.
 */
import { describe, it, expect } from 'vitest'
import { ARPEGGIO_PRESETS } from '@core/arpeggio/presets.ts'
import type { ArpeggioType } from '@core/arpeggio/types.ts'

const VALID_NOTE_NAMES = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
]

describe('arpeggio presets', () => {
  it('all presets are valid ArpeggioSequences with name and non-empty steps', () => {
    for (const preset of ARPEGGIO_PRESETS) {
      const seq = preset.generate('C', 2)
      expect(seq.name).toBeTruthy()
      expect(seq.id).toBeTruthy()
      expect(seq.steps.length).toBeGreaterThan(0)
      expect(seq.direction).toBeTruthy()
    }
  })

  it('all preset step roots are valid note names', () => {
    for (const preset of ARPEGGIO_PRESETS) {
      const seq = preset.generate('C', 2)
      for (const step of seq.steps) {
        expect(VALID_NOTE_NAMES).toContain(step.root)
      }
    }
  })

  it('all presets produce valid steps from different root notes', () => {
    const roots = ['C', 'F', 'Bb', 'E', 'Ab']
    for (const preset of ARPEGGIO_PRESETS) {
      for (const root of roots) {
        const seq = preset.generate(root, 2)
        expect(seq.steps.length).toBeGreaterThan(0)
        for (const step of seq.steps) {
          expect(VALID_NOTE_NAMES).toContain(step.root)
        }
      }
    }
  })

  // ---- Single-quality presets ----

  it('single-quality presets generate exactly 1 step', () => {
    const singleQualityIds = [
      'arp-major-triads',
      'arp-minor-triads',
      'arp-dominant-7',
      'arp-major-7',
      'arp-minor-7',
    ]

    for (const id of singleQualityIds) {
      const preset = ARPEGGIO_PRESETS.find((p) => p.id === id)
      expect(preset).toBeDefined()
      const seq = preset!.generate('C', 2)
      expect(seq.steps).toHaveLength(1)
    }
  })

  it('single-quality presets use the correct arpeggio type', () => {
    const presets: { id: string; expectedType: ArpeggioType }[] = [
      { id: 'arp-major-triads', expectedType: 'Major' },
      { id: 'arp-minor-triads', expectedType: 'Minor' },
      { id: 'arp-dominant-7', expectedType: 'Dominant7' },
      { id: 'arp-major-7', expectedType: 'Major7' },
      { id: 'arp-minor-7', expectedType: 'Minor7' },
    ]

    for (const { id, expectedType } of presets) {
      const preset = ARPEGGIO_PRESETS.find((p) => p.id === id)!
      const seq = preset.generate('C', 2)
      expect(seq.steps[0].arpeggioType).toBe(expectedType)
    }
  })

  it('single-quality presets use the given root note', () => {
    const preset = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-major-triads')!
    const seq = preset.generate('Eb', 3)
    expect(seq.steps[0].root).toBe('Eb')
    expect(seq.steps[0].rootOctave).toBe(3)
  })

  // ---- Progression presets ----

  it('ii-V-I major preset has quality pattern: Minor7 → Dominant7 → Major7', () => {
    const preset = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i')
    expect(preset).toBeDefined()

    const seq = preset!.generate('C', 2)
    expect(seq.steps).toHaveLength(3)
    expect(seq.steps[0].arpeggioType).toBe('Minor7')
    expect(seq.steps[1].arpeggioType).toBe('Dominant7')
    expect(seq.steps[2].arpeggioType).toBe('Major7')
  })

  it('ii-V-i minor preset has quality pattern: HalfDiminished7 → Dominant7 → Minor7', () => {
    const preset = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i-minor')
    expect(preset).toBeDefined()

    const seq = preset!.generate('C', 2)
    expect(seq.steps).toHaveLength(3)
    expect(seq.steps[0].arpeggioType).toBe('HalfDiminished7')
    expect(seq.steps[1].arpeggioType).toBe('Dominant7')
    expect(seq.steps[2].arpeggioType).toBe('Minor7')
  })

  it('ii-V-I presets have shiftSemitones set for cycling through keys', () => {
    const iiVI = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i')!
    const iiViMinor = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i-minor')!

    const seqMajor = iiVI.generate('C', 2)
    const seqMinor = iiViMinor.generate('C', 2)

    expect(seqMajor.shiftSemitones).toBe(5)
    expect(seqMinor.shiftSemitones).toBe(5)
  })

  it('ii-V-I presets have skipTransition enabled', () => {
    const iiVI = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i')!
    const iiViMinor = ARPEGGIO_PRESETS.find((p) => p.id === 'arp-ii-v-i-minor')!

    expect(iiVI.generate('C', 2).skipTransition).toBe(true)
    expect(iiViMinor.generate('C', 2).skipTransition).toBe(true)
  })

  // ---- Preset template metadata ----

  it('all presets have unique IDs', () => {
    const ids = ARPEGGIO_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all presets have a valid category', () => {
    const validCategories = ['triads', 'seventh', 'jazz']
    for (const preset of ARPEGGIO_PRESETS) {
      expect(validCategories).toContain(preset.category)
    }
  })
})
