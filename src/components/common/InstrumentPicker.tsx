import type { InstrumentConfig } from '@core/instruments.ts'
import styles from './MicSelector.module.css'

interface InstrumentPickerProps {
  instruments: Record<string, InstrumentConfig>
  selectedId: string
  onChange: (id: string) => void
}

export function InstrumentPicker({
  instruments,
  selectedId,
  onChange,
}: InstrumentPickerProps) {
  const entries = Object.values(instruments)
  if (entries.length === 0) return null

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="instrument-select">
        Instrument
      </label>
      <select
        id="instrument-select"
        className={styles.select}
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
      >
        {entries.map((inst) => (
          <option key={inst.id} value={inst.id}>
            {inst.name}
          </option>
        ))}
      </select>
    </div>
  )
}
