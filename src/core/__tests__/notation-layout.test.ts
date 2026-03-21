/**
 * Tests for notation layout pure functions.
 *
 * Covers staveLayout (staveContentStartX, ACCIDENTAL_LEFT_MARGIN),
 * config (staffHeight, middleLineY, bottomLineY, createConfig),
 * keySignatureLayout (keySignatureWidth),
 * and pitch (diatonicStep, noteToStaffY, getLedgerLines).
 */
import { describe, it, expect } from 'vitest'
import {
  staveContentStartX,
  ACCIDENTAL_LEFT_MARGIN,
} from '@core/notation/components/staveLayout.ts'
import {
  DEFAULT_MEASURE_CONFIG,
  staffHeight,
  middleLineY,
  bottomLineY,
  createConfig,
} from '@core/notation/config.ts'
import {
  keySignatureWidth,
  KEY_SIG_SPACING,
} from '@core/notation/glyphs/keySignatureLayout.ts'
import {
  diatonicStep,
  noteToStaffY,
  getLedgerLines,
  BASS_CLEF_BOTTOM_STEP,
} from '@core/notation/pitch.ts'

// ---------------------------------------------------------------------------
// staveContentStartX
// ---------------------------------------------------------------------------

describe('staveContentStartX', () => {
  const config = DEFAULT_MEASURE_CONFIG

  it('returns at least ACCIDENTAL_LEFT_MARGIN with no options', () => {
    const x = staveContentStartX(config)
    expect(x).toBeGreaterThanOrEqual(ACCIDENTAL_LEFT_MARGIN)
  })

  it('returns at least ACCIDENTAL_LEFT_MARGIN with all options disabled', () => {
    const x = staveContentStartX(config, {
      showClef: false,
      showTimeSignature: false,
      keySigAccidentalCount: 0,
    })
    expect(x).toBeGreaterThanOrEqual(ACCIDENTAL_LEFT_MARGIN)
  })

  it('includes clef width when showClef is true', () => {
    const withClef = staveContentStartX(config, { showClef: true })
    const without = staveContentStartX(config, { showClef: false })
    expect(withClef).toBeGreaterThanOrEqual(without)
  })

  it('includes time signature width when showTimeSignature is true', () => {
    const withTimeSig = staveContentStartX(config, { showTimeSignature: true })
    const without = staveContentStartX(config, { showTimeSignature: false })
    expect(withTimeSig).toBeGreaterThanOrEqual(without)
  })

  it('includes key signature width when accidentals are present', () => {
    const withKeySig = staveContentStartX(config, { keySigAccidentalCount: 3 })
    const without = staveContentStartX(config, { keySigAccidentalCount: 0 })
    expect(withKeySig).toBeGreaterThan(without)
  })

  it('sums clef, time sig, and key sig when all enabled', () => {
    const x = staveContentStartX(config, {
      showClef: true,
      showTimeSignature: true,
      keySigAccidentalCount: 2,
    })
    const expectedMin = config.clefWidth + config.timeSigWidth + keySignatureWidth(2)
    expect(x).toBeGreaterThanOrEqual(expectedMin)
  })
})

// ---------------------------------------------------------------------------
// ACCIDENTAL_LEFT_MARGIN
// ---------------------------------------------------------------------------

describe('ACCIDENTAL_LEFT_MARGIN', () => {
  it('is a positive number', () => {
    expect(ACCIDENTAL_LEFT_MARGIN).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// keySignatureWidth
// ---------------------------------------------------------------------------

describe('keySignatureWidth', () => {
  it('returns 0 for 0 accidentals', () => {
    expect(keySignatureWidth(0)).toBe(0)
  })

  it('returns positive width for 1+ accidentals', () => {
    expect(keySignatureWidth(1)).toBeGreaterThan(0)
    expect(keySignatureWidth(4)).toBeGreaterThan(0)
  })

  it('increases with more accidentals', () => {
    expect(keySignatureWidth(4)).toBeGreaterThan(keySignatureWidth(2))
    expect(keySignatureWidth(7)).toBeGreaterThan(keySignatureWidth(4))
  })

  it('uses KEY_SIG_SPACING in the formula', () => {
    const w1 = keySignatureWidth(1)
    const w2 = keySignatureWidth(2)
    expect(w2 - w1).toBe(KEY_SIG_SPACING)
  })
})

// ---------------------------------------------------------------------------
// staffHeight, middleLineY, bottomLineY
// ---------------------------------------------------------------------------

describe('staff geometry', () => {
  const config = DEFAULT_MEASURE_CONFIG

  it('staffHeight is 4 * lineSpacing', () => {
    expect(staffHeight(config)).toBe(4 * config.lineSpacing)
  })

  it('middleLineY is staffTopMargin + 2 * lineSpacing', () => {
    expect(middleLineY(config)).toBe(config.staffTopMargin + 2 * config.lineSpacing)
  })

  it('bottomLineY is staffTopMargin + staffHeight', () => {
    expect(bottomLineY(config)).toBe(config.staffTopMargin + staffHeight(config))
  })

  it('middleLineY is between staffTopMargin and bottomLineY', () => {
    expect(middleLineY(config)).toBeGreaterThan(config.staffTopMargin)
    expect(middleLineY(config)).toBeLessThan(bottomLineY(config))
  })
})

// ---------------------------------------------------------------------------
// createConfig
// ---------------------------------------------------------------------------

describe('createConfig', () => {
  it('returns default config when no overrides', () => {
    const config = createConfig({})
    expect(config.lineSpacing).toBe(DEFAULT_MEASURE_CONFIG.lineSpacing)
    expect(config.noteRadius).toBe(DEFAULT_MEASURE_CONFIG.noteRadius)
  })

  it('merges top-level overrides', () => {
    const config = createConfig({ lineSpacing: 20 })
    expect(config.lineSpacing).toBe(20)
    expect(config.noteRadius).toBe(DEFAULT_MEASURE_CONFIG.noteRadius)
  })

  it('deep-merges color overrides without losing other colors', () => {
    const config = createConfig({ colors: { note: '#ff0000' } })
    expect(config.colors.note).toBe('#ff0000')
    expect(config.colors.staffLine).toBe(DEFAULT_MEASURE_CONFIG.colors.staffLine)
  })
})

// ---------------------------------------------------------------------------
// diatonicStep
// ---------------------------------------------------------------------------

describe('diatonicStep', () => {
  it('maps C to 0', () => {
    expect(diatonicStep('C')).toBe(0)
  })

  it('maps D to 1', () => {
    expect(diatonicStep('D')).toBe(1)
  })

  it('maps G to 4', () => {
    expect(diatonicStep('G')).toBe(4)
  })

  it('maps B to 6', () => {
    expect(diatonicStep('B')).toBe(6)
  })

  it('handles accidentals by using the base letter', () => {
    expect(diatonicStep('C#')).toBe(0)
    expect(diatonicStep('Bb')).toBe(6)
    expect(diatonicStep('F#')).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// noteToStaffY
// ---------------------------------------------------------------------------

describe('noteToStaffY', () => {
  const config = DEFAULT_MEASURE_CONFIG

  it('G2 (bottom line of bass clef) maps to bottomLineY', () => {
    const note = { name: 'G2', pitchClass: 'G', octave: 2, midi: 43, frequency: 98 }
    expect(noteToStaffY(note, config)).toBe(bottomLineY(config))
  })

  it('higher notes have lower Y values', () => {
    const g2 = { name: 'G2', pitchClass: 'G', octave: 2, midi: 43, frequency: 98 }
    const a2 = { name: 'A2', pitchClass: 'A', octave: 2, midi: 45, frequency: 110 }
    expect(noteToStaffY(a2, config)).toBeLessThan(noteToStaffY(g2, config))
  })

  it('notes one diatonic step apart differ by half lineSpacing', () => {
    const g2 = { name: 'G2', pitchClass: 'G', octave: 2, midi: 43, frequency: 98 }
    const a2 = { name: 'A2', pitchClass: 'A', octave: 2, midi: 45, frequency: 110 }
    const diff = noteToStaffY(g2, config) - noteToStaffY(a2, config)
    expect(diff).toBe(config.lineSpacing / 2)
  })

  it('D3 (middle line) maps to middleLineY', () => {
    const d3 = { name: 'D3', pitchClass: 'D', octave: 3, midi: 50, frequency: 146.83 }
    expect(noteToStaffY(d3, config)).toBe(middleLineY(config))
  })
})

// ---------------------------------------------------------------------------
// BASS_CLEF_BOTTOM_STEP
// ---------------------------------------------------------------------------

describe('BASS_CLEF_BOTTOM_STEP', () => {
  it('equals 18 (G2: octave 2 * 7 + step G=4)', () => {
    expect(BASS_CLEF_BOTTOM_STEP).toBe(18)
  })
})

// ---------------------------------------------------------------------------
// getLedgerLines
// ---------------------------------------------------------------------------

describe('getLedgerLines', () => {
  const config = DEFAULT_MEASURE_CONFIG

  it('returns no ledger lines for notes within the staff', () => {
    const midY = middleLineY(config)
    const lines = getLedgerLines(midY, config)
    expect(lines).toHaveLength(0)
  })

  it('returns ledger lines for notes above the staff', () => {
    const aboveStaff = config.staffTopMargin - config.lineSpacing * 2
    const lines = getLedgerLines(aboveStaff, config)
    expect(lines.length).toBeGreaterThan(0)
    for (const y of lines) {
      expect(y).toBeLessThan(config.staffTopMargin)
    }
  })

  it('returns ledger lines for notes below the staff', () => {
    const bottom = bottomLineY(config)
    const belowStaff = bottom + config.lineSpacing * 2
    const lines = getLedgerLines(belowStaff, config)
    expect(lines.length).toBeGreaterThan(0)
    for (const y of lines) {
      expect(y).toBeGreaterThan(bottom)
    }
  })

  it('ledger lines are spaced by lineSpacing', () => {
    const aboveStaff = config.staffTopMargin - config.lineSpacing * 3
    const lines = getLedgerLines(aboveStaff, config).sort((a, b) => a - b)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i] - lines[i - 1]).toBe(config.lineSpacing)
    }
  })
})
