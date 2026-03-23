import styles from './HomePage.module.css'

/** Content type — what instrument/theory concept to practice */
export type PracticeMode = 'scales' | 'arpeggios' | 'walking-bass'

/** Timing mode — how the practice session is paced */
export type TimingMode = 'follow' | 'rhythm' | 'sheet-music'

interface ModeOption {
  id: PracticeMode
  title: string
  followDescription: string
  rhythmDescription: string
  sheetMusicDescription: string
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
    sheetMusicDescription: 'View and study scale notation. No microphone needed.',
    icon: '🎵',
    accentColor: 'var(--color-accent)',
    iconBg: 'rgba(99, 102, 241, 0.1)',
  },
  {
    id: 'arpeggios',
    title: 'Arpeggios',
    followDescription: 'Practice arpeggios through chord tones across all keys.',
    rhythmDescription: 'Play arpeggios in time with the metronome. Scored on pitch and timing.',
    sheetMusicDescription: 'View and study arpeggio notation. No microphone needed.',
    icon: '🎶',
    accentColor: 'rgba(6, 182, 212, 1)',
    iconBg: 'rgba(6, 182, 212, 0.1)',
  },
  {
    id: 'walking-bass',
    title: 'Walking Bass',
    followDescription: 'Practice walking bass lines over chord progressions',
    rhythmDescription: 'Walk bass lines in time with the metronome',
    sheetMusicDescription: 'View and study walking bass line notation. No microphone needed.',
    icon: '🚶',
    accentColor: 'rgba(245, 158, 11, 1)',
    iconBg: 'rgba(245, 158, 11, 0.1)',
  },
]

interface HomePageProps {
  onSelectMode: (mode: PracticeMode, timing: TimingMode) => void
  initialTimingMode?: TimingMode
}

export function HomePage({ onSelectMode, initialTimingMode = 'sheet-music' }: HomePageProps) {
  const timing = initialTimingMode

  const visibleModes = timing === 'rhythm'
    ? MODES.filter((m) => !m.noRhythm)
    : MODES

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h2 className={styles.title}>What do you want to practice?</h2>
        <p className={styles.subtitle}>Choose a mode to get started</p>
      </div>

      <span className={styles.sectionLabel}>
        {timing === 'follow' ? 'Follow Mode' : timing === 'rhythm' ? 'Rhythm Mode' : 'Sheet Music'}
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
              {timing === 'follow' ? mode.followDescription : timing === 'rhythm' ? mode.rhythmDescription : mode.sheetMusicDescription}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
