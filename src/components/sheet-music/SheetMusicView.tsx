/**
 * SheetMusicView — fullscreen sheet music display.
 * Centers the staff preview in the viewport with a back button overlay.
 */

import type { ReactNode } from 'react'
import styles from './SheetMusicView.module.css'

interface SheetMusicViewProps {
  /** The staff preview content to display fullscreen */
  children: ReactNode
  /** Title to display at the top */
  title?: string
  /** Subtitle (e.g., "↑ Ascending · 12 scales") */
  subtitle?: string
  /** Called when the user clicks Back */
  onBack: () => void
}

export function SheetMusicView({ children, title, subtitle, onBack }: SheetMusicViewProps) {
  return (
    <div className={styles.fullscreen}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          &larr; Back
        </button>
        {title && <span className={styles.title}>{title}</span>}
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}
