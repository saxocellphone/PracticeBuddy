import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { PRESETS, PRESET_CATEGORIES } from '@core/scales/presets.ts'
import {
  loadCustomSequences,
  saveCustomSequence,
  deleteCustomSequence,
} from '@core/scales/storage.ts'
import type { ScaleSequence, ScaleStep, SavedCustomSequence } from '@core/scales/types.ts'
import { isScalePlayable } from '@core/music/scaleBuilder.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { ClefType } from '@core/instruments.ts'
import type { ScaleInfo, ScaleDirection } from '@core/wasm/types.ts'
import { NOTE_DURATIONS, NOTE_DURATION_LABELS } from '@core/rhythm/types.ts'
import type { NoteDuration, ScaleStartPosition } from '@core/rhythm/types.ts'
import { PITCH_CLASSES } from '@core/music/pitchClass.ts'
import { RootNoteSelector } from '@components/common/RootNoteSelector.tsx'
import { LoopSection } from '@components/common/LoopSection.tsx'
import { SequenceBuilder } from './SequenceBuilder.tsx'
import { StaffPreview } from './StaffPreview.tsx'
import sharedStyles from '../common/SetupLayout.module.css'
import localStyles from './ScaleSetup.module.css'
const styles = { ...sharedStyles, ...localStyles }

const CATEGORY_ORDER: (keyof typeof PRESET_CATEGORIES)[] = ['basic', 'jazz', 'theory', 'technique']

interface ScaleSetupProps {
  availableScales: ScaleInfo[]
  onStartSequence: (sequence: ScaleSequence) => void
  /** Slot for metronome / advanced settings controls rendered in the config panel */
  settingsSlot?: ReactNode
  /** When true, hides the "Skip transition screen" toggle (e.g. Rhythm Mode) */
  hideSkipTransition?: boolean
  /** Note duration for the staff preview (defaults to 'quarter' for scale mode) */
  noteDuration?: NoteDuration
  /** Callback when note duration changes */
  onNoteDurationChange?: (d: NoteDuration) => void
  /** Current BPM for the note duration picker display */
  bpm?: number
  /** Where the next scale starts relative to the previous one */
  scaleStartPosition?: ScaleStartPosition
  /** Default starting octave for the instrument (defaults to 2 for bass) */
  defaultOctave?: number
  /** Clef to use for the staff preview */
  clef?: ClefType
  /** MIDI range for the instrument */
  range?: { minMidi: number; maxMidi: number }
  /** Custom label for the start button (defaults to "Start Practice") */
  startButtonLabel?: string
}

const SCALES_SETUP_KEY = 'practicebuddy:scales:setup'

interface ScalesSetupState {
  selectedPresetId: string | null
  presetKey: string
  numOctaves: number
  shiftSemitones: number
  basicScaleTypeIndex: number
  basicDirection: ScaleDirection
  loopCount: number
  shiftUntilKey: string
}

function loadScalesSetup(): Partial<ScalesSetupState> {
  try {
    const raw = localStorage.getItem(SCALES_SETUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function ScaleSetup({ availableScales, onStartSequence, settingsSlot, noteDuration, onNoteDurationChange, scaleStartPosition, defaultOctave, clef, range, startButtonLabel }: ScaleSetupProps) {
  const [saved] = useState(loadScalesSetup)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(saved.selectedPresetId ?? null)
  const [presetKey, setPresetKey] = useState(saved.presetKey ?? 'C')
  const [numOctaves, setNumOctaves] = useState(saved.numOctaves ?? 1)
  const [shiftSemitones, setShiftSemitones] = useState(saved.shiftSemitones ?? 0)
  const [loopCount, setLoopCount] = useState(saved.loopCount ?? 1)
  const [shiftUntilKey, setShiftUntilKey] = useState(saved.shiftUntilKey ?? presetKey)
  const skipTransition = (() => {
    try { return localStorage.getItem('practicebuddy:skipTransition') === 'true' } catch { return false }
  })()
  const [basicScaleTypeIndex, setBasicScaleTypeIndex] = useState(saved.basicScaleTypeIndex ?? 0)
  const [basicDirection, setBasicDirection] = useState<ScaleDirection>(saved.basicDirection ?? 'ascending')

  // Persist setup state
  const persistSetup = useCallback(() => {
    const state: ScalesSetupState = {
      selectedPresetId, presetKey, numOctaves, shiftSemitones, basicScaleTypeIndex, basicDirection,
      loopCount, shiftUntilKey,
    }
    localStorage.setItem(SCALES_SETUP_KEY, JSON.stringify(state))
  }, [selectedPresetId, presetKey, numOctaves, shiftSemitones, basicScaleTypeIndex, basicDirection, loopCount, shiftUntilKey])

  useEffect(() => { persistSetup() }, [persistSetup])
  const [customSequences, setCustomSequences] = useState<SavedCustomSequence[]>(
    loadCustomSequences
  )
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingSequence, setEditingSequence] = useState<SavedCustomSequence | undefined>()
  const [showMoreScaleTypes, setShowMoreScaleTypes] = useState(false)

  useEffect(() => {
    localStorage.setItem('practicebuddy:skipTransition', String(skipTransition))
  }, [skipTransition])

  const selectedPreset = PRESETS.find((p) => p.id === selectedPresetId)
  const isBasicPreset = selectedPreset?.category === 'basic'

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    return selectedPreset.generate(presetKey, (defaultOctave ?? 2), isBasicPreset ? basicScaleTypeIndex : undefined)
  }, [selectedPreset, presetKey, isBasicPreset, basicScaleTypeIndex, defaultOctave])

  // Expand the generated sequence for the preview (applies loop count / shift-until-key)
  const previewSequence = useMemo(() => {
    if (!generatedSequence) return null
    const withLoopParams = {
      ...generatedSequence,
      shiftSemitones,
      loopCount: shiftSemitones === 0 ? loopCount : undefined,
      shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
    }
    return expandSequenceWithLoops<ScaleSequence, ScaleStep>(
      withLoopParams,
      (step: ScaleStep) => ({ root: step.rootNote, octave: step.rootOctave }),
      (step: ScaleStep, pitchClass: string, octave: number) => ({ ...step, rootNote: pitchClass, rootOctave: octave, label: undefined, chordSymbol: undefined }),
    )
  }, [generatedSequence, shiftSemitones, loopCount, shiftUntilKey])

  // Filter octave options to only show playable ones for the current sequence
  const playableOctaves = useMemo(() => {
    if (!generatedSequence) return [1, 2, 3]
    const direction = basicDirection
    return [1, 2, 3].filter(n =>
      generatedSequence.steps.every(step => isScalePlayable(step, direction, n, range))
    )
  }, [generatedSequence, basicDirection, range])

  // Derive effective octave count — clamp to playable range without cascading setState
  const effectiveNumOctaves = playableOctaves.includes(numOctaves)
    ? numOctaves
    : (playableOctaves[playableOctaves.length - 1] ?? 1)

  const handleStartPreset = () => {
    if (generatedSequence) {
      const direction = basicDirection
      onStartSequence({
        ...generatedSequence,
        direction,
        shiftSemitones,
        skipTransition,
        numOctaves: effectiveNumOctaves,
        loopCount: shiftSemitones === 0 ? loopCount : undefined,
        shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
      })
    }
  }

  const handleStartCustom = (saved: SavedCustomSequence) => {
    const seq: ScaleSequence = {
      id: saved.id,
      name: saved.name,
      description: '',
      steps: saved.steps,
      direction: saved.direction,
      shiftSemitones: saved.shiftSemitones,
      skipTransition: saved.skipTransition,
      numOctaves: effectiveNumOctaves,
    }
    onStartSequence(seq)
  }

  const handleSaveCustom = (saved: SavedCustomSequence) => {
    saveCustomSequence(saved)
    setCustomSequences(loadCustomSequences())
    setShowBuilder(false)
    setEditingSequence(undefined)
  }

  const handleDeleteCustom = (id: string) => {
    deleteCustomSequence(id)
    setCustomSequences(loadCustomSequences())
  }

  const handleEditCustom = (saved: SavedCustomSequence) => {
    setEditingSequence(saved)
    setShowBuilder(true)
  }

  // Group presets by category
  const presetsByCategory = useMemo(() => {
    const grouped: Record<string, typeof PRESETS> = {}
    for (const preset of PRESETS) {
      if (!grouped[preset.category]) grouped[preset.category] = []
      grouped[preset.category].push(preset)
    }
    return grouped
  }, [])

  // Group available scales by category for the basic preset picker
  const scalesByCategory = useMemo(() => {
    return availableScales.reduce<Record<string, { info: ScaleInfo; index: number }[]>>(
      (acc, scale, i) => {
        const cat = scale.category
        if (!acc[cat]) acc[cat] = []
        acc[cat].push({ info: scale, index: i })
        return acc
      },
      {}
    )
  }, [availableScales])

  const categoryLabels: Record<string, string> = {
    common: 'Common',
    pentatonic: 'Pentatonic',
    blues: 'Blues',
    modes: 'Modes',
    jazz: 'Jazz',
  }

  if (showBuilder) {
    return (
      <SequenceBuilder
        pitchClasses={PITCH_CLASSES}
        availableScales={availableScales}
        initial={editingSequence}
        onSave={handleSaveCustom}
        onStartSequence={onStartSequence}
        onCancel={() => {
          setShowBuilder(false)
          setEditingSequence(undefined)
        }}
      />
    )
  }

  return (
    <div className={styles.threeColumnLayout}>
      {/* Column 1: preset list + custom sequences */}
      <div className={styles.leftColumn}>
        <section>
          <h3 className={styles.sectionTitle}>Presets</h3>
          {CATEGORY_ORDER.map((category) => {
            const presets = presetsByCategory[category]
            if (!presets || presets.length === 0) return null
            return (
              <div key={category} className={styles.categoryGroup}>
                <span className={styles.categoryHeader}>
                  {PRESET_CATEGORIES[category]}
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
                        const seq = preset.generate(presetKey, (defaultOctave ?? 2))
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

        {/* Custom Sequences */}
        <section className={styles.customSection}>
          <h3 className={styles.sectionTitle}>Custom Sequences</h3>
          {customSequences.length === 0 && (
            <p className={styles.customEmptyHint}>
              Build your own practice routine
            </p>
          )}
          {customSequences.length > 0 && (
            <div className={styles.customList}>
              {customSequences.map((seq) => (
                <div key={seq.id} className={styles.customRow}>
                  <span className={styles.customItemName}>{seq.name}</span>
                  <span className={styles.customItemSteps}>
                    {seq.steps.length} scales
                  </span>
                  <div className={styles.customRowActions}>
                    <button onClick={() => handleStartCustom(seq)}>Start</button>
                    <button onClick={() => handleEditCustom(seq)}>Edit</button>
                    <button
                      className={styles.customItemDelete}
                      onClick={() => handleDeleteCustom(seq.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className={styles.createLink}
            onClick={() => {
              setEditingSequence(undefined)
              setShowBuilder(true)
            }}
          >
            + Create Custom Sequence
          </button>
        </section>
      </div>

      {/* Columns 2–3: placeholder or config+preview */}
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
      {selectedPreset && <div className={styles.middleColumn}>
        {selectedPreset.transposable && (
          <div className={styles.presetConfig}>
            {/* Preset header */}
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderName}>{selectedPreset.name}</span>
              <span className={styles.panelHeaderDesc}>{selectedPreset.description}</span>
            </div>

            {/* Root Note */}
            <RootNoteSelector value={presetKey} onChange={setPresetKey} classes={styles} twoRows />

            {/* Note Duration */}
            {noteDuration && onNoteDurationChange && (
              <div className={styles.configSection}>
                <span className={styles.configLabel}>Note Duration</span>
                <div className={styles.chipRow}>
                  {NOTE_DURATIONS.map((d) => (
                    <button
                      key={d}
                      className={`${styles.chip} ${noteDuration === d ? styles.chipActive : ''}`}
                      onClick={() => onNoteDurationChange(d)}
                    >
                      {NOTE_DURATION_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Octaves */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Octaves</span>
              <div className={styles.chipRow}>
                {playableOctaves.map((n) => (
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

            {/* Basic preset: scale type + direction pickers */}
            {isBasicPreset && (
              <>
                <div className={styles.configSection}>
                  <div style={{ display: 'flex', alignItems: 'center', height: '28px' }}>
                    <span className={styles.configLabel} style={{ flex: 1 }}>Scale Type</span>
                    <button
                      type="button"
                      onClick={() => setShowMoreScaleTypes(v => !v)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '14px',
                        border: '1px solid var(--color-border)', background: 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-muted)', fontSize: '16px', lineHeight: 1, flexShrink: 0,
                      }}
                      aria-label={showMoreScaleTypes ? 'Show fewer scale types' : 'Show more scale types'}
                    >
                      {showMoreScaleTypes ? '\u2212' : '+'}
                    </button>
                  </div>
                  {Object.entries(scalesByCategory).map(([category, scales]) => {
                    const isMore = category === 'modes' || category === 'jazz' || category === 'pentatonic' || category === 'blues'
                    const isSelectedHere = scales.some(s => s.index === basicScaleTypeIndex)
                    if (isMore && !showMoreScaleTypes && !isSelectedHere) return null
                    return (
                      <div key={category} className={styles.scaleCategoryGroup}>
                        <span className={styles.scaleCategoryLabel}>
                          {categoryLabels[category] ?? category}
                        </span>
                        <div className={styles.chipRow}>
                          {scales.map(({ info, index }) => (
                            <button
                              key={index}
                              className={`${styles.chip} ${basicScaleTypeIndex === index ? styles.chipActive : ''}`}
                              onClick={() => setBasicScaleTypeIndex(index)}
                            >
                              {info.displayName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

              </>
            )}

            {/* Direction — available for all presets */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Direction</span>
              <div className={styles.chipRow}>
                {(['ascending', 'descending', 'both'] as ScaleDirection[]).map((dir) => (
                  <button
                    key={dir}
                    className={`${styles.chip} ${basicDirection === dir ? styles.chipActive : ''}`}
                    onClick={() => setBasicDirection(dir)}
                  >
                    {dir === 'ascending' ? '\u2191 Up' : dir === 'descending' ? '\u2193 Down' : '\u2195 Both'}
                  </button>
                ))}
              </div>
            </div>

            {/* Loop */}
            <LoopSection
              shiftSemitones={shiftSemitones}
              onShiftSemitonesChange={setShiftSemitones}
              loopCount={loopCount}
              onLoopCountChange={setLoopCount}
              shiftUntilKey={shiftUntilKey}
              onShiftUntilKeyChange={setShiftUntilKey}
              rootKey={presetKey}
              classes={styles}
              twoRows
            />

            {/* Metronome / advanced settings slot */}
            {settingsSlot}

            <button
              className={styles.startButton}
              onClick={handleStartPreset}
            >
              {startButtonLabel ?? 'Start Practice'}
            </button>
          </div>
        )}
      </div>}

      {/* Column 3: continuous scale preview */}
      {selectedPreset && previewSequence && (
      <div className={styles.previewColumn}>
        <span className={styles.configLabel}>Scale Preview</span>
        <span className={styles.previewDirection}>
          {(basicDirection) === 'ascending'
            ? '\u2191 Ascending'
            : (basicDirection) === 'descending'
            ? '\u2193 Descending'
            : '\u2195 Both directions'}
          {' \u00B7 '}
          {previewSequence.steps.length} {previewSequence.steps.length === 1 ? 'scale' : 'scales'}
        </span>
        <StaffPreview
          sequence={previewSequence}
          direction={basicDirection}
          numOctaves={effectiveNumOctaves}
          noteDuration={noteDuration}
          scaleStartPosition={scaleStartPosition}
          clef={clef}
          range={range}
        />
      </div>
      )}
    </div>
  )
}
