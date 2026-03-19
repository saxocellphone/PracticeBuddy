import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  onGoHome?: () => void
  onBack?: () => void
}

export function AppShell({ children, onGoHome, onBack }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {onBack && (
          <button className={styles.backButton} onClick={onBack}>
            &larr; Home
          </button>
        )}
        <h1
          className={`${styles.title} ${onGoHome ? styles.titleClickable : ''}`}
          onClick={onGoHome}
        >
          <span className={styles.icon}>🎸</span>
          PracticeBuddy
        </h1>
        <span className={styles.badge}>Bass</span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
