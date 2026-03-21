/**
 * Tests for arpeggio type definitions and interval lookups.
 *
 * Validates that getArpeggioIntervals returns the correct semitone
 * intervals from root for each ArpeggioType.
 */
import { describe, it, expect } from 'vitest'
import { getArpeggioIntervals } from '@core/arpeggio/types.ts'
import type { ArpeggioType } from '@core/arpeggio/types.ts'

const ALL_ARPEGGIO_TYPES: ArpeggioType[] = [
  'Major',
  'Minor',
  'Dominant7',
  'Major7',
  'Minor7',
  'Diminished',
  'Augmented',
  'MinorMajor7',
  'HalfDiminished7',
  'Diminished7',
]

describe('getArpeggioIntervals', () => {
  // ---- Triads ----

  it('returns [0, 4, 7] for Major', () => {
    expect(getArpeggioIntervals('Major')).toEqual([0, 4, 7])
  })

  it('returns [0, 3, 7] for Minor', () => {
    expect(getArpeggioIntervals('Minor')).toEqual([0, 3, 7])
  })

  it('returns [0, 3, 6] for Diminished', () => {
    expect(getArpeggioIntervals('Diminished')).toEqual([0, 3, 6])
  })

  it('returns [0, 4, 8] for Augmented', () => {
    expect(getArpeggioIntervals('Augmented')).toEqual([0, 4, 8])
  })

  // ---- Seventh chords ----

  it('returns [0, 4, 7, 10] for Dominant7', () => {
    expect(getArpeggioIntervals('Dominant7')).toEqual([0, 4, 7, 10])
  })

  it('returns [0, 4, 7, 11] for Major7', () => {
    expect(getArpeggioIntervals('Major7')).toEqual([0, 4, 7, 11])
  })

  it('returns [0, 3, 7, 10] for Minor7', () => {
    expect(getArpeggioIntervals('Minor7')).toEqual([0, 3, 7, 10])
  })

  it('returns [0, 3, 7, 11] for MinorMajor7', () => {
    expect(getArpeggioIntervals('MinorMajor7')).toEqual([0, 3, 7, 11])
  })

  it('returns [0, 3, 6, 10] for HalfDiminished7', () => {
    expect(getArpeggioIntervals('HalfDiminished7')).toEqual([0, 3, 6, 10])
  })

  it('returns [0, 3, 6, 9] for Diminished7', () => {
    expect(getArpeggioIntervals('Diminished7')).toEqual([0, 3, 6, 9])
  })

  // ---- Structural invariants ----

  it('all arpeggio types have intervals starting with 0', () => {
    for (const type of ALL_ARPEGGIO_TYPES) {
      const intervals = getArpeggioIntervals(type)
      expect(intervals[0]).toBe(0)
    }
  })

  it('all intervals are sorted ascending', () => {
    for (const type of ALL_ARPEGGIO_TYPES) {
      const intervals = getArpeggioIntervals(type)
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
      }
    }
  })

  it('all intervals are non-negative and less than 12', () => {
    for (const type of ALL_ARPEGGIO_TYPES) {
      const intervals = getArpeggioIntervals(type)
      for (const interval of intervals) {
        expect(interval).toBeGreaterThanOrEqual(0)
        expect(interval).toBeLessThan(12)
      }
    }
  })

  it('triads have 3 notes and seventh chords have 4 notes', () => {
    const triads: ArpeggioType[] = ['Major', 'Minor', 'Diminished', 'Augmented']
    const sevenths: ArpeggioType[] = [
      'Dominant7', 'Major7', 'Minor7', 'MinorMajor7', 'HalfDiminished7', 'Diminished7',
    ]

    for (const type of triads) {
      expect(getArpeggioIntervals(type)).toHaveLength(3)
    }
    for (const type of sevenths) {
      expect(getArpeggioIntervals(type)).toHaveLength(4)
    }
  })
})
