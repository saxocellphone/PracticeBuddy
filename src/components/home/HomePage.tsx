import styles from './HomePage.module.css'
import { ALL_TIMING_MODES } from './practiceTypes.ts'
import type { PracticeMode, TimingMode } from './practiceTypes.ts'

export type { PracticeMode, TimingMode }

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
  /** Which timing modes this practice mode supports. Defaults to all three. */
  timingModes?: TimingMode[]
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
  {
    id: 'jazz-standards',
    title: 'Jazz Standards',
    followDescription: 'Learn jazz melodies and walk bass over standard changes.',
    rhythmDescription: 'Play jazz standards in time with the metronome.',
    sheetMusicDescription: 'View melody and chord notation for jazz standards.',
    icon: '🎷',
    accentColor: 'rgba(168, 85, 247, 1)',
    iconBg: 'rgba(168, 85, 247, 0.1)',
    timingModes: ['sheet-music'],
  },
]

interface HomePageProps {
  onSelectMode: (mode: PracticeMode, timing: TimingMode) => void
  initialTimingMode?: TimingMode
}

export function HomePage({ onSelectMode, initialTimingMode = 'sheet-music' }: HomePageProps) {
  const timing = initialTimingMode

  const visibleModes = MODES.filter((m) => {
    const allowed = m.timingModes ?? ALL_TIMING_MODES
    return allowed.includes(timing)
  })

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
