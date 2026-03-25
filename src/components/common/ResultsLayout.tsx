import { useState, type ReactNode } from 'react'
import styles from './ResultsLayout.module.css'

function getScoreColor(percent: number): string {
  if (percent >= 80) return 'var(--color-correct)'
  if (percent >= 50) return 'var(--color-warning)'
  return 'var(--color-incorrect)'
}

export interface StatItem {
  value: string | number
  label: string
  color: string
}

export interface BreakdownItem {
  label: string
  scorePercent: number
  detail: ReactNode
}

interface ResultsLayoutProps {
  scorePercent: number
  scoreLabel?: string
  stats: StatItem[]
  breakdownTitle?: string
  breakdownItems?: BreakdownItem[]
  onRetry: () => void
  onGoHome: () => void
  onBackToSetup?: () => void
  retryButtonColor?: string
}

export function ResultsLayout({
  scorePercent,
  scoreLabel = 'Accuracy',
  stats,
  breakdownTitle = 'Breakdown',
  breakdownItems,
  onRetry,
  onGoHome,
  onBackToSetup,
  retryButtonColor,
}: ResultsLayoutProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const scoreColor = getScoreColor(scorePercent)

  return (
    <div className={styles.container}>
      {/* Score Summary */}
      <div className={styles.summary}>
        <div className={styles.scoreCircle} style={{ borderColor: scoreColor }}>
          <span className={styles.scoreValue} style={{ color: scoreColor }}>
            {Math.round(scorePercent)}%
          </span>
          <span className={styles.scoreLabel}>{scoreLabel}</span>
        </div>

        <div className={styles.stats}>
          {stats.map((stat, i) => (
            <div key={i} className={styles.stat}>
              <span className={styles.statValue} style={{ color: stat.color }}>
                {stat.value}
              </span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Breakdown */}
      {breakdownItems && breakdownItems.length > 0 && (
        <div className={styles.breakdown}>
          <h3 className={styles.sectionTitle}>{breakdownTitle}</h3>
          <div className={styles.itemList}>
            {breakdownItems.map((item, i) => {
              const isExpanded = expandedIndex === i
              const itemColor = getScoreColor(item.scorePercent)

              return (
                <div key={i} className={styles.item}>
                  <button
                    className={styles.itemHeader}
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  >
                    <span className={styles.itemIndex}>{i + 1}</span>
                    <span className={styles.itemName}>{item.label}</span>
                    <span className={styles.itemScore} style={{ color: itemColor }}>
                      {Math.round(item.scorePercent)}%
                    </span>
                    <span className={`${styles.itemToggle} ${isExpanded ? styles.itemToggleOpen : ''}`}>
                      &#9658;
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.itemDetails}>
                      {item.detail}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.retryButton}
          style={retryButtonColor ? { background: retryButtonColor } : undefined}
          onClick={onRetry}
        >
          Practice Again
        </button>
        {onBackToSetup && (
          <button className={styles.secondaryButton} onClick={onBackToSetup}>
            Change Settings
          </button>
        )}
        <button className={styles.secondaryButton} onClick={onGoHome}>
          Home
        </button>
      </div>
    </div>
  )
}
