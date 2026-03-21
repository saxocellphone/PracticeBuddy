/**
 * Tests for getArpeggioStepLabel — display labels for arpeggio steps.
 *
 * Verifies that labels use proper chord abbreviations (e.g., "Cmaj7", "Dm7b5")
 * and that ignoreOctave correctly strips octave digits from labels.
 */
import { describe, it, expect } from 'vitest'
import { getArpeggioStepLabel } from '@core/arpeggio/presets.ts'
import { ARPEGGIO_TYPE_LABELS } from '@core/arpeggio/types.ts'
import type { ArpeggioStep, ArpeggioType } from '@core/arpeggio/types.ts'

function step(root: string, octave: number, type: ArpeggioType, label?: string): ArpeggioStep {
  return { root, rootOctave: octave, arpeggioType: type, label }
}

describe('getArpeggioStepLabel', () => {
  // ---- Auto-generated labels use chord symbol format ----

  it('generates chord symbol with root + octave + suffix when no custom label', () => {
    const s = step('C', 2, 'Major')
    expect(getArpeggioStepLabel(s)).toBe('C2maj')
  })

  it('uses ARPEGGIO_TYPE_LABELS suffix for each type', () => {
    const allTypes: ArpeggioType[] = [
      'Major', 'Minor', 'Dominant7', 'Major7', 'Minor7',
      'Diminished', 'Augmented', 'MinorMajor7', 'HalfDiminished7', 'Diminished7',
    ]

    for (const type of allTypes) {
      const s = step('C', 2, type)
      const expected = `C2${ARPEGGIO_TYPE_LABELS[type]}`
      expect(getArpeggioStepLabel(s)).toBe(expected)
    }
  })

  it('generates correct chord abbreviations for jazz types', () => {
    expect(getArpeggioStepLabel(step('D', 2, 'Minor7'))).toBe('D2m7')
    expect(getArpeggioStepLabel(step('G', 2, 'Dominant7'))).toBe('G27')
    expect(getArpeggioStepLabel(step('C', 3, 'Major7'))).toBe('C3maj7')
    expect(getArpeggioStepLabel(step('D', 2, 'HalfDiminished7'))).toBe('D2m7b5')
    expect(getArpeggioStepLabel(step('C', 2, 'MinorMajor7'))).toBe('C2m(maj7)')
    expect(getArpeggioStepLabel(step('C', 2, 'Diminished7'))).toBe('C2dim7')
  })

  it('generates correct labels for triads', () => {
    expect(getArpeggioStepLabel(step('C', 2, 'Major'))).toBe('C2maj')
    expect(getArpeggioStepLabel(step('C', 2, 'Minor'))).toBe('C2m')
    expect(getArpeggioStepLabel(step('C', 2, 'Diminished'))).toBe('C2dim')
    expect(getArpeggioStepLabel(step('C', 2, 'Augmented'))).toBe('C2aug')
  })

  // ---- ignoreOctave on auto-generated labels ----

  it('strips octave from auto-generated label when ignoreOctave is true', () => {
    const s = step('C', 2, 'Major')
    expect(getArpeggioStepLabel(s, true)).toBe('Cmaj')
  })

  it('preserves octave in auto-generated label when ignoreOctave is false', () => {
    const s = step('C', 2, 'Major')
    expect(getArpeggioStepLabel(s, false)).toBe('C2maj')
  })

  it('ignoreOctave works for seventh chord types', () => {
    expect(getArpeggioStepLabel(step('D', 2, 'Minor7'), true)).toBe('Dm7')
    expect(getArpeggioStepLabel(step('G', 3, 'Dominant7'), true)).toBe('G7')
  })

  // ---- Custom labels ----

  it('returns custom label as-is when provided', () => {
    const s = step('D', 2, 'Minor7', 'ii - Dm7')
    expect(getArpeggioStepLabel(s)).toBe('ii - Dm7')
  })

  it('uses structured root+suffix when ignoreOctave is true (even with custom label)', () => {
    const s = step('D', 2, 'Minor7', 'D2m7')
    expect(getArpeggioStepLabel(s, true)).toBe('Dm7')
  })

  it('preserves digits in custom label when ignoreOctave is false', () => {
    const s = step('D', 2, 'Minor7', 'D2m7')
    expect(getArpeggioStepLabel(s, false)).toBe('D2m7')
  })

  // ---- Accidental roots ----

  it('handles sharp root notes correctly', () => {
    expect(getArpeggioStepLabel(step('F#', 2, 'Minor'))).toBe('F#2m')
  })

  it('handles flat root notes correctly', () => {
    expect(getArpeggioStepLabel(step('Bb', 3, 'Dominant7'))).toBe('Bb37')
  })
})
