import styles from './PitchLeniency.module.css'

export interface LeniencyPreset {
  label: string
  cents: number
  description: string
}

const PRESETS: LeniencyPreset[] = [
  { label: 'Strict', cents: 25, description: 'Quarter-tone precision' },
  { label: 'Normal', cents: 40, description: 'Good intonation' },
  { label: 'Relaxed', cents: 60, description: 'Forgiving' },
  { label: 'Loose', cents: 80, description: 'Just get the note' },
]

interface PitchLeniencyProps {
  centsTolerance: number
  onCentsToleranceChange: (cents: number) => void
}

export function PitchLeniency({
  centsTolerance,
  onCentsToleranceChange,
}: PitchLeniencyProps) {
  const activePreset = PRESETS.find((p) => p.cents === centsTolerance)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Pitch Leniency</h3>
        <span className={styles.value}>
          {activePreset ? activePreset.label : `${centsTolerance}¢`}
        </span>
      </div>

      <div className={styles.presets}>
        {PRESETS.map((preset) => (
          <button
            key={preset.cents}
            className={`${styles.presetButton} ${
              centsTolerance === preset.cents ? styles.presetActive : ''
            }`}
            onClick={() => onCentsToleranceChange(preset.cents)}
          >
            <span className={styles.presetLabel}>{preset.label}</span>
            <span className={styles.presetDesc}>{preset.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>Fine-tune</span>
        <input
          type="range"
          min={10}
          max={100}
          value={centsTolerance}
          onChange={(e) => onCentsToleranceChange(Number(e.target.value))}
          className={styles.slider}
        />
        <span className={styles.sliderValue}>±{centsTolerance}¢</span>
      </div>

      <p className={styles.hint}>
        {centsTolerance <= 25
          ? 'You need near-perfect pitch. Great for advanced players.'
          : centsTolerance <= 40
            ? 'Standard tolerance. Notes must be reasonably in tune.'
            : centsTolerance <= 60
              ? 'Forgiving. Good for beginners or when using a practice amp.'
              : 'Very loose. Focuses on hitting the right note, not intonation.'}
      </p>
    </div>
  )
}
