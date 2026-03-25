import styles from './MetronomeControls.module.css'

interface MetronomeControlsProps {
  bpm: number
  isPlaying: boolean
  currentBeat: number
  beatsPerMeasure: number
  onBpmChange: (bpm: number) => void
  onToggle: () => void
  compact?: boolean
  accentColor?: string
}

export function MetronomeControls({
  bpm,
  isPlaying,
  currentBeat,
  beatsPerMeasure,
  onBpmChange,
  onToggle,
  compact = false,
  accentColor,
}: MetronomeControlsProps) {
  const colorStyle = accentColor ? { '--metronome-accent': accentColor } as React.CSSProperties : undefined

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`} style={colorStyle}>
      <div className={styles.header}>
        <h3 className={styles.title}>Metronome</h3>
        <button
          className={`${styles.toggleButton} ${isPlaying ? styles.toggleActive : ''}`}
          onClick={onToggle}
        >
          {isPlaying ? '⏸ Stop' : '▶ Start'}
        </button>
      </div>

      <div className={styles.bpmRow}>
        <span className={styles.bpmLabel}>BPM</span>
        <input
          type="range"
          min={30}
          max={240}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className={styles.bpmSlider}
        />
        <span className={styles.bpmValue}>{bpm}</span>
      </div>

      <div className={styles.beats}>
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <div
            key={i}
            className={`${styles.beat} ${
              isPlaying && currentBeat === i ? styles.beatActive : ''
            } ${i === 0 ? styles.beatAccent : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
