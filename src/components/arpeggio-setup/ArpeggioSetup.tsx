import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import {
  ARPEGGIO_PRESETS,
  ARPEGGIO_PRESET_CATEGORIES,
} from '@core/arpeggio/presets.ts'
import type { ArpeggioPresetTemplate } from '@core/arpeggio/presets.ts'
import type { ArpeggioSequence, ArpeggioStep, ArpeggioDirection } from '@core/arpeggio/types.ts'
import { transpose } from '@core/endless/presets.ts'
import { ArpeggioStaffPreview } from './ArpeggioStaffPreview.tsx'
import styles from './ArpeggioSetup.module.css'

const PITCH_CLASSES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

const BASS_DEFAULT_OCTAVE = 2

const CATEGORY_ORDER: (keyof typeof ARPEGGIO_PRESET_CATEGORIES)[] = [
  'triads',
  'seventh',
  'jazz',
]

const SHIFT_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '\u00BD Step', value: 1 },
  { label: 'Whole Step', value: 2 },
  { label: '4ths', value: 5 },
  { label: '5ths', value: 7 },
] as const

const DIRECTION_OPTIONS: { label: string; value: ArpeggioDirection }[] = [
  { label: '\u2191 Up', value: 'ascending' },
  { label: '\u2193 Down', value: 'descending' },
  { label: '\u2195 Both', value: 'ascendingDescending' },
]

interface ArpeggioSetupProps {
  onStart: (sequence: ArpeggioSequence) => void
  settingsSlot?: ReactNode
}

const ARPEGGIO_SETUP_KEY = 'practicebuddy:arpeggios:setup'

interface ArpeggioSetupState {
  selectedPresetId: string | null
  rootKey: string
  direction: ArpeggioDirection
  shiftSemitones: number
  numOctaves: number
}

function loadArpeggioSetup(): Partial<ArpeggioSetupState> {
  try {
    const raw = localStorage.getItem(ARPEGGIO_SETUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Expand a base sequence by applying a loop shift to generate all transpositions.
 * If shift is 0 or the base sequence already has multiple steps (jazz progressions),
 * returns the base sequence as-is.
 */
function expandSequenceForPreview(
  baseSequence: ArpeggioSequence,
  shiftSemitones: number,
): ArpeggioSequence {
  // For multi-step presets (jazz progressions) or no shift, return as-is
  if (shiftSemitones === 0 || baseSequence.steps.length > 1) {
    return baseSequence
  }

  const baseStep = baseSequence.steps[0]
  if (!baseStep) return baseSequence

  // Compute how many unique transpositions before cycling back
  // GCD determines cycle length: 12 / gcd(12, shift)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const numSteps = 12 / gcd(12, shiftSemitones)

  const steps: ArpeggioStep[] = []
  for (let i = 0; i < numSteps; i++) {
    const totalShift = (i * shiftSemitones) % 12
    const { pitchClass, octave } = transpose(baseStep.root, baseStep.rootOctave, totalShift)
    steps.push({
      root: pitchClass,
      rootOctave: octave,
      arpeggioType: baseStep.arpeggioType,
    })
  }

  return { ...baseSequence, steps }
}

export function ArpeggioSetup({ onStart, settingsSlot }: ArpeggioSetupProps) {
  const [saved] = useState(loadArpeggioSetup)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(saved.selectedPresetId ?? null)
  const [rootKey, setRootKey] = useState(saved.rootKey ?? 'C')
  const [direction, setDirection] = useState<ArpeggioDirection>(saved.direction ?? 'ascending')
  const [shiftSemitones, setShiftSemitones] = useState(saved.shiftSemitones ?? 0)
  const [numOctaves, setNumOctaves] = useState(saved.numOctaves ?? 1)

  // Persist setup state
  const persistSetup = useCallback(() => {
    const state: ArpeggioSetupState = { selectedPresetId, rootKey, direction, shiftSemitones, numOctaves }
    localStorage.setItem(ARPEGGIO_SETUP_KEY, JSON.stringify(state))
  }, [selectedPresetId, rootKey, direction, shiftSemitones, numOctaves])

  useEffect(() => { persistSetup() }, [persistSetup])

  const selectedPreset = ARPEGGIO_PRESETS.find((p) => p.id === selectedPresetId)

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    return selectedPreset.generate(rootKey, BASS_DEFAULT_OCTAVE)
  }, [selectedPreset, rootKey])

  // Expand the sequence for preview based on loop shift
  const previewSequence = useMemo(() => {
    if (!generatedSequence) return null
    return expandSequenceForPreview(generatedSequence, shiftSemitones)
  }, [generatedSequence, shiftSemitones])

  const handleStart = () => {
    if (!generatedSequence) return
    onStart({
      ...generatedSequence,
      direction,
      shiftSemitones,
      numOctaves,
    })
  }

  const presetsByCategory = useMemo(() => {
    const grouped: Record<string, ArpeggioPresetTemplate[]> = {}
    for (const preset of ARPEGGIO_PRESETS) {
      if (!grouped[preset.category]) grouped[preset.category] = []
      grouped[preset.category].push(preset)
    }
    return grouped
  }, [])

  return (
    <div className={styles.threeColumnLayout}>
      {/* Column 1: preset list */}
      <div className={styles.leftColumn}>
        <section>
          <h3 className={styles.sectionTitle}>Presets</h3>
          {CATEGORY_ORDER.map((category) => {
            const presets = presetsByCategory[category]
            if (!presets || presets.length === 0) return null
            return (
              <div key={category} className={styles.categoryGroup}>
                <span className={styles.categoryHeader}>
                  {ARPEGGIO_PRESET_CATEGORIES[category]}
                </span>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`${styles.presetRow} ${selectedPresetId === preset.id ? styles.presetRowActive : ''}`}
                    onClick={() => {
                      if (selectedPresetId === preset.id) {
                        setSelectedPresetId(null)
                      } else {
                        setSelectedPresetId(preset.id)
                        const seq = preset.generate(rootKey, BASS_DEFAULT_OCTAVE)
                        setShiftSemitones(seq.shiftSemitones ?? 0)
                      }
                    }}
                  >
                    <span className={styles.presetName}>{preset.name}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </section>
      </div>

      {/* Placeholder when no preset selected */}
      {!selectedPreset && (
        <div className={styles.emptyStatePlaceholder}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Select a preset to get started</span>
        </div>
      )}

      {/* Column 2: config panel */}
      {selectedPreset && (
        <div className={styles.middleColumn}>
          <div className={styles.presetConfig}>
            {/* Preset header */}
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderName}>{selectedPreset.name}</span>
              <span className={styles.panelHeaderDesc}>{selectedPreset.description}</span>
            </div>

            {/* Root Note */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Root Note</span>
              <div className={styles.chipRow}>
                {PITCH_CLASSES.map((pc) => (
                  <button
                    key={pc}
                    className={`${styles.chip} ${rootKey === pc ? styles.chipActive : ''}`}
                    onClick={() => setRootKey(pc)}
                  >
                    {pc}
                  </button>
                ))}
              </div>
            </div>

            {/* Octaves */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Octaves</span>
              <div className={styles.chipRow}>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`${styles.chip} ${numOctaves === n ? styles.chipActive : ''}`}
                    onClick={() => setNumOctaves(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Direction</span>
              <div className={styles.chipRow}>
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.chip} ${direction === opt.value ? styles.chipActive : ''}`}
                    onClick={() => setDirection(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loop Shift */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Loop Shift</span>
              <div className={styles.chipRow}>
                {SHIFT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.chip} ${shiftSemitones === opt.value ? styles.chipActive : ''}`}
                    onClick={() => setShiftSemitones(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Settings slot (metronome, advanced) */}
            {settingsSlot}

            <button className={styles.startButton} onClick={handleStart}>
              Start Practice
            </button>
          </div>
        </div>
      )}

      {/* Column 3: preview */}
      {selectedPreset && previewSequence && (
        <div className={styles.previewColumn}>
          <ArpeggioStaffPreview
            sequence={previewSequence}
            direction={direction}
            numOctaves={numOctaves}
          />
        </div>
      )}
    </div>
  )
}
