import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.icon}>🎸</span>
          PracticeBuddy
        </h1>
        <span className={styles.badge}>Bass</span>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
