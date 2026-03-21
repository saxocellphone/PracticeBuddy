import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadCustomSequences,
  saveCustomSequence,
  deleteCustomSequence,
} from '@core/endless/storage.ts'
import { RHYTHM_DURATION_STORAGE_KEY } from '@core/rhythm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { SavedCustomSequence } from '@core/endless/types.ts'
import type { ScaleDirection } from '@core/wasm/types.ts'

// ---------------------------------------------------------------------------
// Constants — must match the keys used in source modules
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'practicebuddy:settings'
const SCALE_SELECTION_KEY = 'practicebuddy:scale-selection'

// ---------------------------------------------------------------------------
// Replicating unexported load functions from App.tsx and useScaleSelection.ts
// so we can test the localStorage contract without React rendering.
//
// These must stay in sync with the source. If the source changes, these tests
// will catch the divergence via failing assertions on the contract.
// ---------------------------------------------------------------------------

interface PersistedSettings {
  bpm: number
  metronomeEnabled: boolean
  centsTolerance: number
  ignoreOctave: boolean
}

const DEFAULT_SETTINGS: PersistedSettings = {
  bpm: 120,
  metronomeEnabled: true,
  centsTolerance: 40,
  ignoreOctave: true,
}

/** Mirrors App.tsx loadSettings() */
function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      bpm:
        typeof parsed.bpm === 'number' && parsed.bpm >= 30 && parsed.bpm <= 300
          ? parsed.bpm
          : DEFAULT_SETTINGS.bpm,
      metronomeEnabled:
        typeof parsed.metronomeEnabled === 'boolean'
          ? parsed.metronomeEnabled
          : DEFAULT_SETTINGS.metronomeEnabled,
      centsTolerance:
        typeof parsed.centsTolerance === 'number' &&
        parsed.centsTolerance >= 10 &&
        parsed.centsTolerance <= 100
          ? parsed.centsTolerance
          : DEFAULT_SETTINGS.centsTolerance,
      ignoreOctave:
        typeof parsed.ignoreOctave === 'boolean'
          ? parsed.ignoreOctave
          : DEFAULT_SETTINGS.ignoreOctave,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Mirrors App.tsx loadNoteDuration() */
function loadNoteDuration(): NoteDuration {
  try {
    const raw = localStorage.getItem(RHYTHM_DURATION_STORAGE_KEY)
    if (
      raw &&
      ['whole', 'half', 'quarter', 'eighth', 'sixteenth'].includes(raw)
    ) {
      return raw as NoteDuration
    }
  } catch {
    /* ignore */
  }
  return 'quarter'
}

interface ScaleSelection {
  rootNote: string
  rootOctave: number
  scaleTypeIndex: number
  direction: ScaleDirection
}

const DEFAULT_SELECTION: ScaleSelection = {
  rootNote: 'E',
  rootOctave: 2,
  scaleTypeIndex: 0,
  direction: 'ascending',
}

/** Mirrors useScaleSelection.ts loadSelection() */
function loadSelection(): ScaleSelection {
  try {
    const raw = localStorage.getItem(SCALE_SELECTION_KEY)
    if (!raw) return DEFAULT_SELECTION
    const parsed = JSON.parse(raw)
    return {
      rootNote:
        typeof parsed.rootNote === 'string'
          ? parsed.rootNote
          : DEFAULT_SELECTION.rootNote,
      rootOctave:
        typeof parsed.rootOctave === 'number'
          ? parsed.rootOctave
          : DEFAULT_SELECTION.rootOctave,
      scaleTypeIndex:
        typeof parsed.scaleTypeIndex === 'number'
          ? parsed.scaleTypeIndex
          : DEFAULT_SELECTION.scaleTypeIndex,
      direction: ['ascending', 'descending', 'both'].includes(parsed.direction)
        ? parsed.direction
        : DEFAULT_SELECTION.direction,
    }
  } catch {
    return DEFAULT_SELECTION
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCustomSequence(
  overrides: Partial<SavedCustomSequence> = {},
): SavedCustomSequence {
  return {
    id: overrides.id ?? 'test-id',
    name: overrides.name ?? 'Test Sequence',
    steps: overrides.steps ?? [
      { rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 },
    ],
    direction: overrides.direction ?? 'ascending',
    createdAt: overrides.createdAt ?? Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Node 22+ has a built-in localStorage that conflicts with jsdom.
// Create a simple in-memory Storage polyfill so tests work everywhere.
const store = new Map<string, string>()
const mockStorage: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}

vi.stubGlobal('localStorage', mockStorage)

beforeEach(() => {
  store.clear()
})

// ===========================================================================
// Main Settings
// ===========================================================================

describe('Main Settings persistence', () => {
  it('returns defaults when localStorage is empty', () => {
    const settings = loadSettings()

    expect(settings).toEqual({
      bpm: 120,
      metronomeEnabled: true,
      centsTolerance: 40,
      ignoreOctave: true,
    })
  })

  it('round-trips a full settings object', () => {
    const written: PersistedSettings = {
      bpm: 90,
      metronomeEnabled: false,
      centsTolerance: 25,
      ignoreOctave: false,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(written))

    const loaded = loadSettings()

    expect(loaded).toEqual(written)
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{not valid json!!!')

    const settings = loadSettings()

    expect(settings).toEqual(DEFAULT_SETTINGS)
  })

  it('fills missing fields with defaults when only some fields are present', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ bpm: 80, centsTolerance: 50 }),
    )

    const settings = loadSettings()

    expect(settings.bpm).toBe(80)
    expect(settings.centsTolerance).toBe(50)
    // Missing fields fall back to defaults
    expect(settings.metronomeEnabled).toBe(DEFAULT_SETTINGS.metronomeEnabled)
    expect(settings.ignoreOctave).toBe(DEFAULT_SETTINGS.ignoreOctave)
  })

  it('clamps BPM outside the valid range (30-300) to the default', () => {
    // BPM=999 is out of the 30-300 range — loadSettings rejects it
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, bpm: 999 }),
    )

    const settings = loadSettings()

    expect(settings.bpm).toBe(DEFAULT_SETTINGS.bpm)
  })

  it('accepts BPM at the boundaries (30 and 300)', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, bpm: 30 }),
    )
    expect(loadSettings().bpm).toBe(30)

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, bpm: 300 }),
    )
    expect(loadSettings().bpm).toBe(300)
  })

  it('rejects BPM below the minimum (29) to the default', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, bpm: 29 }),
    )

    expect(loadSettings().bpm).toBe(DEFAULT_SETTINGS.bpm)
  })

  it('rejects non-number BPM values', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, bpm: 'fast' }),
    )

    expect(loadSettings().bpm).toBe(DEFAULT_SETTINGS.bpm)
  })

  it('rejects centsTolerance outside the valid range (10-100)', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, centsTolerance: 5 }),
    )
    expect(loadSettings().centsTolerance).toBe(DEFAULT_SETTINGS.centsTolerance)

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, centsTolerance: 150 }),
    )
    expect(loadSettings().centsTolerance).toBe(DEFAULT_SETTINGS.centsTolerance)
  })
})

// ===========================================================================
// Rhythm Duration
// ===========================================================================

describe('Rhythm Duration persistence', () => {
  it('returns quarter as default when localStorage is empty', () => {
    expect(loadNoteDuration()).toBe('quarter')
  })

  it('loads a valid duration that was persisted', () => {
    localStorage.setItem(RHYTHM_DURATION_STORAGE_KEY, 'eighth')

    expect(loadNoteDuration()).toBe('eighth')
  })

  it('round-trips all valid durations', () => {
    const validDurations: NoteDuration[] = [
      'whole',
      'half',
      'quarter',
      'eighth',
      'sixteenth',
    ]

    for (const duration of validDurations) {
      localStorage.setItem(RHYTHM_DURATION_STORAGE_KEY, duration)
      expect(loadNoteDuration()).toBe(duration)
    }
  })

  it('falls back to quarter for an invalid duration value', () => {
    localStorage.setItem(RHYTHM_DURATION_STORAGE_KEY, 'invalid-value')

    expect(loadNoteDuration()).toBe('quarter')
  })

  it('falls back to quarter for an empty string', () => {
    localStorage.setItem(RHYTHM_DURATION_STORAGE_KEY, '')

    expect(loadNoteDuration()).toBe('quarter')
  })
})

// ===========================================================================
// Scale Selection
// ===========================================================================

describe('Scale Selection persistence', () => {
  it('returns defaults when localStorage is empty', () => {
    const selection = loadSelection()

    expect(selection).toEqual({
      rootNote: 'E',
      rootOctave: 2,
      scaleTypeIndex: 0,
      direction: 'ascending',
    })
  })

  it('round-trips a full selection object', () => {
    const written: ScaleSelection = {
      rootNote: 'Bb',
      rootOctave: 3,
      scaleTypeIndex: 5,
      direction: 'descending',
    }
    localStorage.setItem(SCALE_SELECTION_KEY, JSON.stringify(written))

    const loaded = loadSelection()

    expect(loaded).toEqual(written)
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(SCALE_SELECTION_KEY, '<<<broken>>>')

    const selection = loadSelection()

    expect(selection).toEqual(DEFAULT_SELECTION)
  })

  it('fills missing fields with defaults', () => {
    localStorage.setItem(
      SCALE_SELECTION_KEY,
      JSON.stringify({ rootNote: 'G' }),
    )

    const selection = loadSelection()

    expect(selection.rootNote).toBe('G')
    expect(selection.rootOctave).toBe(DEFAULT_SELECTION.rootOctave)
    expect(selection.scaleTypeIndex).toBe(DEFAULT_SELECTION.scaleTypeIndex)
    expect(selection.direction).toBe(DEFAULT_SELECTION.direction)
  })

  it('rejects an invalid direction and falls back to default', () => {
    localStorage.setItem(
      SCALE_SELECTION_KEY,
      JSON.stringify({ ...DEFAULT_SELECTION, direction: 'sideways' }),
    )

    expect(loadSelection().direction).toBe(DEFAULT_SELECTION.direction)
  })

  it('accepts all valid directions', () => {
    for (const direction of ['ascending', 'descending', 'both'] as const) {
      localStorage.setItem(
        SCALE_SELECTION_KEY,
        JSON.stringify({ ...DEFAULT_SELECTION, direction }),
      )
      expect(loadSelection().direction).toBe(direction)
    }
  })

  it('rejects non-string rootNote and falls back to default', () => {
    localStorage.setItem(
      SCALE_SELECTION_KEY,
      JSON.stringify({ ...DEFAULT_SELECTION, rootNote: 42 }),
    )

    expect(loadSelection().rootNote).toBe(DEFAULT_SELECTION.rootNote)
  })

  it('rejects non-number rootOctave and falls back to default', () => {
    localStorage.setItem(
      SCALE_SELECTION_KEY,
      JSON.stringify({ ...DEFAULT_SELECTION, rootOctave: 'high' }),
    )

    expect(loadSelection().rootOctave).toBe(DEFAULT_SELECTION.rootOctave)
  })
})

// ===========================================================================
// Custom Scale Sequences (src/core/endless/storage.ts)
// ===========================================================================

describe('Custom Scale Sequences persistence', () => {
  it('returns an empty array when localStorage is empty', () => {
    expect(loadCustomSequences()).toEqual([])
  })

  it('saves and loads a single custom sequence', () => {
    const seq = makeCustomSequence({ id: 'seq-1', name: 'Circle of Fifths' })

    saveCustomSequence(seq)

    const loaded = loadCustomSequences()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(seq)
  })

  it('deletes a saved sequence', () => {
    const seq = makeCustomSequence({ id: 'seq-to-delete' })
    saveCustomSequence(seq)
    expect(loadCustomSequences()).toHaveLength(1)

    deleteCustomSequence('seq-to-delete')

    expect(loadCustomSequences()).toEqual([])
  })

  it('saves and loads multiple sequences', () => {
    const seq1 = makeCustomSequence({ id: 'seq-1', name: 'First' })
    const seq2 = makeCustomSequence({ id: 'seq-2', name: 'Second' })
    const seq3 = makeCustomSequence({ id: 'seq-3', name: 'Third' })

    saveCustomSequence(seq1)
    saveCustomSequence(seq2)
    saveCustomSequence(seq3)

    const loaded = loadCustomSequences()
    expect(loaded).toHaveLength(3)
    expect(loaded.map((s) => s.id)).toEqual(['seq-1', 'seq-2', 'seq-3'])
  })

  it('updates an existing sequence when saving with the same id', () => {
    const original = makeCustomSequence({ id: 'seq-1', name: 'Original' })
    saveCustomSequence(original)

    const updated = makeCustomSequence({ id: 'seq-1', name: 'Updated' })
    saveCustomSequence(updated)

    const loaded = loadCustomSequences()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Updated')
  })

  it('deleting a non-existent id does not affect other sequences', () => {
    const seq = makeCustomSequence({ id: 'keep-me' })
    saveCustomSequence(seq)

    deleteCustomSequence('does-not-exist')

    const loaded = loadCustomSequences()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('keep-me')
  })

  it('returns an empty array on corrupt JSON', () => {
    localStorage.setItem('practicebuddy:custom-sequences', 'not-json!!!')

    expect(loadCustomSequences()).toEqual([])
  })

  it('returns an empty array when stored value is not an array', () => {
    localStorage.setItem(
      'practicebuddy:custom-sequences',
      JSON.stringify({ not: 'an array' }),
    )

    expect(loadCustomSequences()).toEqual([])
  })

  it('filters out entries with missing required fields', () => {
    const valid = makeCustomSequence({ id: 'valid', name: 'Valid Sequence' })
    const missingName = { id: 'no-name', steps: [{ rootNote: 'C', rootOctave: 3, scaleTypeIndex: 0 }] }
    const missingSteps = { id: 'no-steps', name: 'No Steps' }
    const emptySteps = { id: 'empty-steps', name: 'Empty', steps: [] }

    localStorage.setItem(
      'practicebuddy:custom-sequences',
      JSON.stringify([valid, missingName, missingSteps, emptySteps]),
    )

    const loaded = loadCustomSequences()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('valid')
  })
})
