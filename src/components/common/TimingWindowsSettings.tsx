import type { TimingWindows } from '@core/rhythm/types.ts'
import styles from './TimingWindowsSettings.module.css'

interface TimingWindowsSettingsProps {
  windows: TimingWindows
  onChange: (windows: TimingWindows) => void
}

export function TimingWindowsSettings({
  windows,
  onChange,
}: TimingWindowsSettingsProps) {
  return (
    <div className={styles.container}>
      <span className={styles.title}>Timing Windows</span>
      <div className={styles.row}>
        <label className={styles.label}>
          Perfect
          <input
            type="number"
            className={styles.input}
            value={windows.perfectMs}
            min={10}
            max={200}
            step={10}
            onChange={(e) =>
              onChange({ ...windows, perfectMs: Number(e.target.value) })
            }
          />
          <span className={styles.unit}>ms</span>
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.label}>
          Good
          <input
            type="number"
            className={styles.input}
            value={windows.goodMs}
            min={50}
            max={300}
            step={10}
            onChange={(e) =>
              onChange({ ...windows, goodMs: Number(e.target.value) })
            }
          />
          <span className={styles.unit}>ms</span>
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.label}>
          Late
          <input
            type="number"
            className={styles.input}
            value={windows.lateMs}
            min={100}
            max={500}
            step={10}
            onChange={(e) =>
              onChange({ ...windows, lateMs: Number(e.target.value) })
            }
          />
          <span className={styles.unit}>ms</span>
        </label>
      </div>
    </div>
  )
}
