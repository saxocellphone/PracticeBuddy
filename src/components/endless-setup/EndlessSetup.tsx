import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { PRESETS, PRESET_CATEGORIES, SCALE_NAMES } from '@core/endless/presets.ts'
import {
  loadCustomSequences,
  saveCustomSequence,
  deleteCustomSequence,
} from '@core/endless/storage.ts'
import type { ScaleSequence, SavedCustomSequence } from '@core/endless/types.ts'
import type { ScaleInfo, ScaleDirection, Note } from '@core/wasm/types.ts'
import { buildScale } from '@core/wasm/scales.ts'
import { SequenceBuilder } from './SequenceBuilder.tsx'
import { StaffPreview } from './StaffPreview.tsx'
import styles from './EndlessSetup.module.css'

const PITCH_CLASSES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

// Default bass starting octave — auto-adjusted by buildScaleNotes to fit range
const BASS_DEFAULT_OCTAVE = 2

const CATEGORY_ORDER: (keyof typeof PRESET_CATEGORIES)[] = ['basic', 'jazz', 'theory', 'technique']

const SHIFT_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '\u00BD Step', value: 1 },
  { label: 'Whole Step', value: 2 },
  { label: '4ths', value: 5 },
  { label: '5ths', value: 7 },
] as const

function intervalsToFormula(notes: Note[]): string {
  if (notes.length < 2) return ''
  const result: string[] = []
  for (let i = 0; i < notes.length - 1; i++) {
    const diff = notes[i + 1].midi - notes[i].midi
    if (diff === 1) result.push('H')
    else if (diff === 2) result.push('W')
    else if (diff === 3) result.push('W+H')
    else result.push(String(diff))
  }
  return result.join(' ')
}

interface EndlessSetupProps {
  availableScales: ScaleInfo[]
  onStartSequence: (sequence: ScaleSequence) => void
  /** Slot for metronome / advanced settings controls rendered in the config panel */
  settingsSlot?: ReactNode
  /** When true, hides the "Skip transition screen" toggle (e.g. Rhythm Mode) */
  hideSkipTransition?: boolean
}

export function EndlessSetup({ availableScales, onStartSequence, settingsSlot, hideSkipTransition }: EndlessSetupProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [presetKey, setPresetKey] = useState('C')
  const [numOctaves, setNumOctaves] = useState(1)
  const [shiftSemitones, setShiftSemitones] = useState(0)
  const [skipTransition, setSkipTransition] = useState(() => {
    try { return localStorage.getItem('practicebuddy:skipTransition') === 'true' } catch { return false }
  })
  const [basicScaleTypeIndex, setBasicScaleTypeIndex] = useState(0)
  const [basicDirection, setBasicDirection] = useState<ScaleDirection>('ascending')
  const [customSequences, setCustomSequences] = useState<SavedCustomSequence[]>(
    loadCustomSequences
  )
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingSequence, setEditingSequence] = useState<SavedCustomSequence | undefined>()
  const [previewStepIndex, setPreviewStepIndex] = useState(0)
  const [showMoreScaleTypes, setShowMoreScaleTypes] = useState(false)

  useEffect(() => {
    localStorage.setItem('practicebuddy:skipTransition', String(skipTransition))
  }, [skipTransition])

  useEffect(() => { queueMicrotask(() => setPreviewStepIndex(0)) }, [selectedPresetId, presetKey, basicScaleTypeIndex])

  const selectedPreset = PRESETS.find((p) => p.id === selectedPresetId)
  const isBasicPreset = selectedPreset?.category === 'basic'

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    return selectedPreset.generate(presetKey, BASS_DEFAULT_OCTAVE, isBasicPreset ? basicScaleTypeIndex : undefined)
  }, [selectedPreset, presetKey, isBasicPreset, basicScaleTypeIndex])

  const handleStartPreset = () => {
    if (generatedSequence) {
      const direction = isBasicPreset ? basicDirection : generatedSequence.direction
      onStartSequence({
        ...generatedSequence,
        direction,
        shiftSemitones,
        skipTransition,
        numOctaves,
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
      numOctaves,
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

  // Compute preview notes so both columns can use them (must be above early return)
  const previewStep = useMemo(() => {
    if (!generatedSequence) return null
    return generatedSequence.steps[previewStepIndex] ?? generatedSequence.steps[0]
  }, [generatedSequence, previewStepIndex])

  const previewNotes = useMemo(() => {
    if (!previewStep) return []
    const rootStr = `${previewStep.rootNote}${previewStep.rootOctave}`
    try {
      const notes = buildScale(rootStr, previewStep.scaleTypeIndex, 'ascending')
      return notes ?? []
    } catch (err) {
      console.error('Scale preview buildScale failed:', rootStr, previewStep.scaleTypeIndex, err)
      return []
    }
  }, [previewStep])

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
                        const seq = preset.generate(presetKey, BASS_DEFAULT_OCTAVE)
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
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Root Note</span>
              <div className={styles.chipRow}>
                {PITCH_CLASSES.map((pc) => (
                  <button
                    key={pc}
                    className={`${styles.chip} ${presetKey === pc ? styles.chipActive : ''}`}
                    onClick={() => setPresetKey(pc)}
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
                    const isMore = category === 'modes' || category === 'jazz'
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
              </>
            )}

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

            {/* Non-basic presets: skip transition */}
            {!isBasicPreset && !hideSkipTransition && (
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={skipTransition}
                  onChange={(e) => setSkipTransition(e.target.checked)}
                  className={styles.toggleCheckbox}
                />
                Skip transition screen
              </label>
            )}

            {/* Metronome / advanced settings slot */}
            {settingsSlot}

            <button
              className={styles.startButton}
              onClick={handleStartPreset}
            >
              Start Practice
            </button>
          </div>
        )}
      </div>}

      {/* Column 3: scale preview */}
      {selectedPreset && (
      <div className={styles.previewColumn}>
        {selectedPreset && previewStep && (
          <>
            <span className={styles.configLabel}>Scale Preview</span>

            {/* Step navigation — always visible when multiple steps, regardless of note load state */}
            {generatedSequence && generatedSequence.steps.length > 1 && (
              <div className={styles.previewNav}>
                <button
                  type="button"
                  className={styles.previewNavBtn}
                  onClick={() => setPreviewStepIndex(i => Math.max(0, i - 1))}
                  disabled={previewStepIndex === 0}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className={styles.previewNavCounter}>
                  Step {previewStepIndex + 1} of {generatedSequence.steps.length}
                </span>
                <button
                  type="button"
                  className={styles.previewNavBtn}
                  onClick={() => setPreviewStepIndex(i => Math.min(generatedSequence.steps.length - 1, i + 1))}
                  disabled={previewStepIndex === generatedSequence.steps.length - 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}

            {/* Scale name + direction — always visible */}
            <span className={styles.previewScaleName}>
              {previewStep.label ?? `${previewStep.rootNote} ${SCALE_NAMES[previewStep.scaleTypeIndex] ?? 'Scale'}`}
            </span>
            <span className={styles.previewDirection}>
              {(isBasicPreset ? basicDirection : generatedSequence?.direction ?? 'ascending') === 'ascending'
                ? '\u2191 Ascending'
                : (isBasicPreset ? basicDirection : generatedSequence?.direction ?? 'ascending') === 'descending'
                ? '\u2193 Descending'
                : '\u2195 Both directions'}
            </span>

            {/* Staff — only when notes available */}
            {previewNotes.length > 0 ? (
              <>
                <div className={styles.staffContainer}>
                  <StaffPreview
                    notes={previewNotes}
                    scaleName={previewStep.label ?? `${previewStep.rootNote} ${SCALE_NAMES[previewStep.scaleTypeIndex] ?? 'Scale'}`}
                    rootPitchClass={previewStep.rootNote}
                    scaleTypeIndex={previewStep.scaleTypeIndex}
                  />
                </div>
                <span className={styles.previewMeta}>
                  {previewNotes.length} notes &middot; {intervalsToFormula(previewNotes)}
                </span>
              </>
            ) : (
              <span className={styles.previewUnavailable}>Preview unavailable</span>
            )}
          </>
        )}
      </div>
      )}
    </div>
  )
}
