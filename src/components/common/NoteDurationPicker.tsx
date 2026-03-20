import {
  NOTE_DURATIONS,
  NOTE_DURATION_LABELS,
  NOTE_DURATION_BEATS,
} from '@core/rhythm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import styles from './NoteDurationPicker.module.css'

interface NoteDurationPickerProps {
  value: NoteDuration
  onChange: (duration: NoteDuration) => void
  bpm: number
}

export function NoteDurationPicker({
  value,
  onChange,
  bpm,
}: NoteDurationPickerProps) {
  const beatsPerNote = NOTE_DURATION_BEATS[value]
  const secondsPerNote = (60 / bpm) * beatsPerNote

  return (
    <div className={styles.container}>
      <span className={styles.label}>Note Duration</span>
      <div className={styles.chipRow}>
        {NOTE_DURATIONS.map((duration) => (
          <button
            key={duration}
            className={`${styles.chip} ${value === duration ? styles.chipActive : ''}`}
            onClick={() => onChange(duration)}
          >
            {NOTE_DURATION_LABELS[duration]}
          </button>
        ))}
      </div>
      <span className={styles.hint}>
        At {bpm} BPM &mdash; 1 note every {secondsPerNote.toFixed(2)}s
      </span>
    </div>
  )
}
