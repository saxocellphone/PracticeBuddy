import { useState } from 'react'
import { getStepLabel } from '@core/endless/presets.ts'
import type { ScaleStep, SavedCustomSequence, ScaleSequence } from '@core/endless/types.ts'
import type { ScaleInfo, ScaleDirection } from '@core/wasm/types.ts'
import styles from './SequenceBuilder.module.css'

interface SequenceBuilderProps {
  pitchClasses: readonly string[]
  availableScales: ScaleInfo[]
  initial?: SavedCustomSequence
  onSave: (seq: SavedCustomSequence) => void
  onStartSequence: (seq: ScaleSequence) => void
  onCancel: () => void
}

export function SequenceBuilder({
  pitchClasses,
  availableScales,
  initial,
  onSave,
  onStartSequence,
  onCancel,
}: SequenceBuilderProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [direction, setDirection] = useState<ScaleDirection>(
    initial?.direction ?? 'ascending'
  )
  const [shiftSemitones, setShiftSemitones] = useState(initial?.shiftSemitones ?? 0)
  const [skipTransition, setSkipTransition] = useState(initial?.skipTransition ?? false)
  const [steps, setSteps] = useState<ScaleStep[]>(initial?.steps ?? [])
  const [showAddForm, setShowAddForm] = useState(false)

  // Add step form state
  const [addRoot, setAddRoot] = useState('C')
  const [addOctave, setAddOctave] = useState(2)
  const [addScaleIndex, setAddScaleIndex] = useState(0)

  const scalesByCategory = availableScales.reduce<
    Record<string, { info: ScaleInfo; index: number }[]>
  >((acc, scale, i) => {
    const cat = scale.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ info: scale, index: i })
    return acc
  }, {})

  const categoryLabels: Record<string, string> = {
    common: 'Common',
    pentatonic: 'Pentatonic',
    blues: 'Blues',
    modes: 'Modes',
  }

  const handleAddStep = () => {
    const step: ScaleStep = {
      rootNote: addRoot,
      rootOctave: addOctave,
      scaleTypeIndex: addScaleIndex,
    }
    setSteps((prev) => [...prev, step])
    setShowAddForm(false)
  }

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMoveStep = (index: number, dir: 'up' | 'down') => {
    setSteps((prev) => {
      const next = [...prev]
      const target = dir === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = () => {
    const seq: SavedCustomSequence = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim() || 'My Sequence',
      steps,
      direction,
      shiftSemitones,
      skipTransition,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    onSave(seq)
  }

  const handleSaveAndStart = () => {
    const id = initial?.id ?? crypto.randomUUID()
    const seqName = name.trim() || 'My Sequence'

    const saved: SavedCustomSequence = {
      id,
      name: seqName,
      steps,
      direction,
      shiftSemitones,
      skipTransition,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    onSave(saved)

    const sequence: ScaleSequence = {
      id,
      name: seqName,
      description: '',
      steps,
      direction,
      shiftSemitones,
      skipTransition,
    }
    onStartSequence(sequence)
  }

  const canSave = steps.length >= 1

  return (
    <div className={styles.container}>
      {/* Name */}
      <section>
        <h3 className={styles.sectionTitle}>Sequence Name</h3>
        <input
          className={styles.nameInput}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Practice Sequence"
        />
      </section>

      {/* Direction */}
      <section>
        <h3 className={styles.sectionTitle}>Direction</h3>
        <div className={styles.directionButtons}>
          {(['ascending', 'descending', 'both'] as ScaleDirection[]).map(
            (dir) => (
              <button
                key={dir}
                className={`${styles.directionButton} ${direction === dir ? styles.directionButtonActive : ''}`}
                onClick={() => setDirection(dir)}
              >
                {dir === 'ascending'
                  ? '↑ Up'
                  : dir === 'descending'
                    ? '↓ Down'
                    : '↕ Both'}
              </button>
            )
          )}
        </div>
      </section>

      {/* Loop Shift */}
      <section>
        <h3 className={styles.sectionTitle}>Loop Shift</h3>
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
      </section>

      {/* Skip Transition */}
      <section>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={skipTransition}
            onChange={(e) => setSkipTransition(e.target.checked)}
            className={styles.toggleCheckbox}
          />
          <span className={styles.sectionTitle} style={{ margin: 0 }}>Skip transition screen</span>
          <span className={styles.toggleHint}>Connect scales without pausing</span>
        </label>
      </section>

      {/* Steps */}
      <section>
        <h3 className={styles.sectionTitle}>
          Scales ({steps.length})
        </h3>

        {steps.length === 0 ? (
          <div className={styles.emptySteps}>
            No scales added yet. Add scales below to build your sequence.
          </div>
        ) : (
          <div className={styles.stepList}>
            {steps.map((step, i) => (
              <div key={i} className={styles.stepItem}>
                <span className={styles.stepIndex}>{i + 1}.</span>
                <span className={styles.stepLabel}>
                  {getStepLabel(step)}
                </span>
                <button
                  className={styles.stepAction}
                  onClick={() => handleMoveStep(i, 'up')}
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  className={styles.stepAction}
                  onClick={() => handleMoveStep(i, 'down')}
                  disabled={i === steps.length - 1}
                >
                  ↓
                </button>
                <button
                  className={`${styles.stepAction} ${styles.stepDelete}`}
                  onClick={() => handleRemoveStep(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add step form */}
        {showAddForm ? (
          <div className={styles.addStepForm}>
            <span className={styles.addStepLabel}>Root Note</span>
            <div className={styles.noteGrid}>
              {pitchClasses.map((pc) => (
                <button
                  key={pc}
                  className={`${styles.noteButton} ${addRoot === pc ? styles.noteButtonActive : ''}`}
                  onClick={() => setAddRoot(pc)}
                >
                  {pc}
                </button>
              ))}
            </div>

            <div className={styles.octaveRow}>
              <span className={styles.addStepLabel}>Octave</span>
              <div className={styles.octaveButtons}>
                {[1, 2, 3, 4].map((oct) => (
                  <button
                    key={oct}
                    className={`${styles.octaveButton} ${addOctave === oct ? styles.octaveButtonActive : ''}`}
                    onClick={() => setAddOctave(oct)}
                  >
                    {oct}
                  </button>
                ))}
              </div>
            </div>

            <span className={styles.addStepLabel}>Scale Type</span>
            {Object.entries(scalesByCategory).map(([category, scales]) => (
              <div key={category}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {categoryLabels[category] ?? category}
                </span>
                <div className={styles.scaleButtons}>
                  {scales.map(({ info, index }) => (
                    <button
                      key={index}
                      className={`${styles.scaleButton} ${addScaleIndex === index ? styles.scaleButtonActive : ''}`}
                      onClick={() => setAddScaleIndex(index)}
                    >
                      {info.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className={styles.addStepActions}>
              <button className={styles.addButton} onClick={handleAddStep}>
                Add Scale
              </button>
              <button
                className={styles.cancelAddButton}
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.addStepTrigger}
            onClick={() => setShowAddForm(true)}
          >
            + Add Scale
          </button>
        )}
      </section>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          disabled={!canSave}
          onClick={handleSaveAndStart}
        >
          Save & Start
        </button>
        <button
          className={styles.saveButton}
          disabled={!canSave}
          onClick={handleSave}
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          Save
        </button>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
