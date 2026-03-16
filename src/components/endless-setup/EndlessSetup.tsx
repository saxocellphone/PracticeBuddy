import { useState, useMemo } from 'react'
import { PRESETS, PRESET_CATEGORIES, getStepLabel } from '@core/endless/presets.ts'
import {
  loadCustomSequences,
  saveCustomSequence,
  deleteCustomSequence,
} from '@core/endless/storage.ts'
import type { ScaleSequence, SavedCustomSequence } from '@core/endless/types.ts'
import type { ScaleInfo } from '@core/wasm/types.ts'
import { SequenceBuilder } from './SequenceBuilder.tsx'
import styles from './EndlessSetup.module.css'

const PITCH_CLASSES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

interface EndlessSetupProps {
  availableScales: ScaleInfo[]
  onStartSequence: (sequence: ScaleSequence) => void
}

export function EndlessSetup({ availableScales, onStartSequence }: EndlessSetupProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [presetKey, setPresetKey] = useState('C')
  const [presetOctave, setPresetOctave] = useState(2)
  const [shiftSemitones, setShiftSemitones] = useState(0)
  const [skipTransition, setSkipTransition] = useState(false)
  const [customSequences, setCustomSequences] = useState<SavedCustomSequence[]>(
    loadCustomSequences
  )
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingSequence, setEditingSequence] = useState<SavedCustomSequence | undefined>()

  const selectedPreset = PRESETS.find((p) => p.id === selectedPresetId)

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    return selectedPreset.generate(presetKey, presetOctave)
  }, [selectedPreset, presetKey, presetOctave])

  const handleStartPreset = () => {
    if (generatedSequence) {
      onStartSequence({ ...generatedSequence, shiftSemitones, skipTransition })
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
    <div className={styles.container}>
      {/* Presets */}
      <section>
        <h3 className={styles.sectionTitle}>Presets</h3>
        <div className={styles.presetList}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`${styles.presetCard} ${selectedPresetId === preset.id ? styles.presetCardActive : ''}`}
              onClick={() => {
                if (selectedPresetId === preset.id) {
                  setSelectedPresetId(null)
                } else {
                  setSelectedPresetId(preset.id)
                  // Initialize shift from preset default
                  const seq = preset.generate(presetKey, presetOctave)
                  setShiftSemitones(seq.shiftSemitones ?? 0)
                }
              }}
            >
              <div className={styles.presetHeader}>
                <span className={styles.presetName}>{preset.name}</span>
                <span className={styles.presetBadge}>
                  {PRESET_CATEGORIES[preset.category]}
                </span>
              </div>
              <span className={styles.presetDescription}>
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Preset configuration */}
      {selectedPreset && selectedPreset.transposable && (
        <div className={styles.presetConfig}>
          <span className={styles.configLabel}>Key</span>
          <div className={styles.noteGrid}>
            {PITCH_CLASSES.map((pc) => (
              <button
                key={pc}
                className={`${styles.noteButton} ${presetKey === pc ? styles.noteButtonActive : ''}`}
                onClick={() => setPresetKey(pc)}
              >
                {pc}
              </button>
            ))}
          </div>
          <div className={styles.octaveRow}>
            <span className={styles.configLabel}>Octave</span>
            <div className={styles.octaveButtons}>
              {[1, 2, 3, 4].map((oct) => (
                <button
                  key={oct}
                  className={`${styles.octaveButton} ${presetOctave === oct ? styles.octaveButtonActive : ''}`}
                  onClick={() => setPresetOctave(oct)}
                >
                  {oct}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.shiftRow}>
            <span className={styles.configLabel}>Loop Shift</span>
            <div className={styles.shiftButtons}>
              {([
                { label: 'None', value: 0 },
                { label: 'Half Step', value: 1 },
                { label: 'Whole Step', value: 2 },
                { label: 'Circle of 5ths', value: 7 },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.shiftButton} ${shiftSemitones === opt.value ? styles.shiftButtonActive : ''}`}
                  onClick={() => setShiftSemitones(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.shiftRow}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={skipTransition}
                onChange={(e) => setSkipTransition(e.target.checked)}
                className={styles.toggleCheckbox}
              />
              <span className={styles.configLabel}>Skip transition screen</span>
              <span className={styles.toggleHint}>Connect scales without pausing</span>
            </label>
          </div>

          {/* Sequence preview */}
          {generatedSequence && (
            <div className={styles.preview}>
              <span className={styles.previewTitle}>Sequence</span>
              <div className={styles.previewSteps}>
                {generatedSequence.steps.map((step, i) => (
                  <span key={i}>
                    {i > 0 && <span className={styles.previewArrow}> → </span>}
                    <span className={styles.previewStep}>
                      {getStepLabel(step)}
                    </span>
                  </span>
                ))}
              </div>
              {shiftSemitones > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Shifts by {shiftSemitones === 1 ? 'half step' : shiftSemitones === 2 ? 'whole step' : shiftSemitones === 7 ? 'circle of 5ths' : `${shiftSemitones} semitones`} each loop
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleStartPreset}
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Start Endless Practice
          </button>
        </div>
      )}

      {/* Custom Sequences */}
      <section className={styles.customSection}>
        <h3 className={styles.sectionTitle}>Custom Sequences</h3>
        {customSequences.length > 0 && (
          <div className={styles.customList}>
            {customSequences.map((seq) => (
              <div key={seq.id} className={styles.customItem}>
                <span className={styles.customItemName}>{seq.name}</span>
                <span className={styles.customItemSteps}>
                  {seq.steps.length} scales
                </span>
                <button
                  className={styles.customItemButton}
                  onClick={() => handleStartCustom(seq)}
                >
                  Start
                </button>
                <button
                  className={styles.customItemButton}
                  onClick={() => handleEditCustom(seq)}
                >
                  Edit
                </button>
                <button
                  className={`${styles.customItemButton} ${styles.customItemDelete}`}
                  onClick={() => handleDeleteCustom(seq.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className={styles.createButton}
          onClick={() => {
            setEditingSequence(undefined)
            setShowBuilder(true)
          }}
        >
          + Create Custom Sequence
        </button>
      </section>
    </div>
  )
}
