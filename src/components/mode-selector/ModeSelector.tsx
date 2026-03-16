import styles from './ModeSelector.module.css'

export type PracticeMode = 'single' | 'endless'

interface ModeSelectorProps {
  mode: PracticeMode
  onModeChange: (mode: PracticeMode) => void
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${mode === 'single' ? styles.buttonActive : ''}`}
        onClick={() => onModeChange('single')}
      >
        Single Scale
      </button>
      <button
        className={`${styles.button} ${mode === 'endless' ? styles.buttonActive : ''}`}
        onClick={() => onModeChange('endless')}
      >
        Endless Mode
      </button>
    </div>
  )
}
