import { useState, useEffect, type ReactNode } from 'react'
import styles from './AdvancedSettings.module.css'

const STORAGE_KEY = 'practicebuddy:advancedOpen'

interface AdvancedSettingsProps {
  children: ReactNode
}

export function AdvancedSettings({ children }: AdvancedSettingsProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open))
  }, [open])

  return (
    <div className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          ▸
        </span>
        <span className={styles.label}>Advanced Settings</span>
      </button>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  )
}
