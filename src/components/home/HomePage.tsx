import styles from './HomePage.module.css'

export type PracticeMode = 'scales'

interface ModeOption {
  id: string
  title: string
  description: string
  icon: string
  accentColor: string
  iconBg: string
  disabled?: boolean
}

const MODES: ModeOption[] = [
  {
    id: 'scales',
    title: 'Scale Practice',
    description: 'Practice scales with presets or build custom sequences. Loop through keys with circle-of-fifths shifts.',
    icon: '🎵',
    accentColor: 'var(--color-accent)',
    iconBg: 'rgba(99, 102, 241, 0.1)',
  },
  {
    id: 'jazz-standards',
    title: 'Jazz Standards',
    description: 'Practice chord changes and common jazz progressions.',
    icon: '🎷',
    accentColor: 'var(--color-warning)',
    iconBg: 'rgba(245, 158, 11, 0.1)',
    disabled: true,
  },
]

interface HomePageProps {
  onSelectMode: (mode: PracticeMode) => void
}

export function HomePage({ onSelectMode }: HomePageProps) {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h2 className={styles.title}>What do you want to practice?</h2>
        <p className={styles.subtitle}>Choose a practice mode to get started</p>
      </div>

      <span className={styles.sectionLabel}>Practice Modes</span>
      <div className={styles.cardGrid}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`${styles.card} ${mode.disabled ? styles.cardDisabled : ''}`}
            onClick={() => {
              if (!mode.disabled) onSelectMode(mode.id as PracticeMode)
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
            <div className={styles.cardDescription}>{mode.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
