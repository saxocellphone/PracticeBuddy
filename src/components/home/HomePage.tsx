import { useState } from 'react'
import styles from './HomePage.module.css'

/** Content type — what instrument/theory concept to practice */
export type PracticeMode = 'scales' | 'arpeggios'

/** Timing mode — how the practice session is paced */
export type TimingMode = 'follow' | 'rhythm'

interface ModeOption {
  id: PracticeMode
  title: string
  followDescription: string
  rhythmDescription: string
  icon: string
  accentColor: string
  iconBg: string
  disabled?: boolean
  /** If true, this mode is not available in rhythm timing */
  noRhythm?: boolean
}

const MODES: ModeOption[] = [
  {
    id: 'scales',
    title: 'Scales',
    followDescription: 'Play scales at your own pace with real-time pitch feedback.',
    rhythmDescription: 'Play scales in time with the metronome. Scored on pitch and timing.',
    icon: '🎵',
    accentColor: 'var(--color-accent)',
    iconBg: 'rgba(99, 102, 241, 0.1)',
  },
  {
    id: 'arpeggios',
    title: 'Arpeggios',
    followDescription: 'Practice arpeggios through chord tones across all keys.',
    rhythmDescription: 'Play arpeggios in time with the metronome. Scored on pitch and timing.',
    icon: '🎶',
    accentColor: 'rgba(6, 182, 212, 1)',
    iconBg: 'rgba(6, 182, 212, 0.1)',
  },
]

interface HomePageProps {
  onSelectMode: (mode: PracticeMode, timing: TimingMode) => void
  initialTimingMode?: TimingMode
  onTimingModeChange?: (timing: TimingMode) => void
}

export function HomePage({ onSelectMode, initialTimingMode = 'follow', onTimingModeChange }: HomePageProps) {
  const [timing, setTiming] = useState<TimingMode>(initialTimingMode)

  const handleTimingChange = (newTiming: TimingMode) => {
    setTiming(newTiming)
    onTimingModeChange?.(newTiming)
  }

  const visibleModes = timing === 'rhythm'
    ? MODES.filter((m) => !m.noRhythm)
    : MODES

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h2 className={styles.title}>What do you want to practice?</h2>
        <p className={styles.subtitle}>Choose how you want to play, then pick a mode</p>
      </div>

      {/* Timing toggle */}
      <div className={styles.toggleWrapper}>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleOption} ${timing === 'follow' ? styles.toggleOptionActive : ''}`}
            onClick={() => handleTimingChange('follow')}
          >
            <span className={styles.toggleIcon}>🎯</span>
            Follow
          </button>
          <button
            className={`${styles.toggleOption} ${timing === 'rhythm' ? styles.toggleOptionActive : ''}`}
            onClick={() => handleTimingChange('rhythm')}
          >
            <span className={styles.toggleIcon}>🥁</span>
            Rhythm
          </button>
        </div>
        <span className={styles.toggleHint}>
          {timing === 'follow'
            ? 'Self-paced — play each note until you get it right'
            : 'Beat-synced — play in time with the metronome'}
        </span>
      </div>

      <span className={styles.sectionLabel}>
        {timing === 'follow' ? 'Follow Mode' : 'Rhythm Mode'}
      </span>
      <div className={styles.cardGrid}>
        {visibleModes.map((mode) => (
          <button
            key={mode.id}
            className={`${styles.card} ${mode.disabled ? styles.cardDisabled : ''}`}
            onClick={() => {
              if (!mode.disabled) onSelectMode(mode.id, timing)
            }}
            style={{
              '--card-accent': mode.accentColor,
              '--card-icon-bg': mode.iconBg,
            } as React.CSSProperties}
            disabled={mode.disabled}
          >
            <div className={styles.cardIcon}>{mode.icon}</div>
            <div className={styles.cardTitle}>
              {mode.title}
              {mode.disabled && (
                <span className={styles.comingSoonBadge}>Coming Soon</span>
              )}
            </div>
            <div className={styles.cardDescription}>
              {timing === 'follow' ? mode.followDescription : mode.rhythmDescription}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
