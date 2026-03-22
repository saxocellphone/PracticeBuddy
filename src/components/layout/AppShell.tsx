import { useState, useRef, useEffect, type ReactNode } from 'react'
import type { InstrumentConfig } from '@core/instruments.ts'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  onGoHome?: () => void
  onBack?: () => void
  backLabel?: string
  instrumentName?: string
  instruments?: Record<string, InstrumentConfig>
  instrumentId?: string
  onInstrumentChange?: (id: string) => void
}

export function AppShell({ children, onGoHome, onBack, backLabel = 'Home', instrumentName, instruments, instrumentId, onInstrumentChange }: AppShellProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const canChangeInstrument = instruments && instrumentId && onInstrumentChange
  const displayName = instrumentName ?? 'Bass'
  const instrumentEmoji: Record<string, string> = { bass: '🎸', piano: '🎹', guitar: '🎸' }
  const emoji = instrumentId ? (instrumentEmoji[instrumentId] ?? '🎵') : '🎸'

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {onBack && (
          <button className={styles.backButton} onClick={onBack}>
            &larr; {backLabel}
          </button>
        )}
        <h1
          className={`${styles.title} ${onGoHome ? styles.titleClickable : ''}`}
          onClick={onGoHome}
        >
          <span className={styles.icon}>{emoji}</span>
          PracticeBuddy
        </h1>
        {canChangeInstrument ? (
          <div ref={badgeRef} className={styles.badgeWrapper}>
            <button
              className={styles.badge}
              onClick={() => setDropdownOpen((v) => !v)}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              {displayName}
              <span className={styles.badgeChevron}>{dropdownOpen ? '\u25B4' : '\u25BE'}</span>
            </button>
            {dropdownOpen && (
              <div className={styles.badgeDropdown} role="listbox">
                {Object.values(instruments).map((inst) => (
                  <button
                    key={inst.id}
                    role="option"
                    aria-selected={inst.id === instrumentId}
                    className={`${styles.badgeOption} ${inst.id === instrumentId ? styles.badgeOptionActive : ''}`}
                    onClick={() => {
                      onInstrumentChange(inst.id)
                      setDropdownOpen(false)
                    }}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className={styles.badge}>{displayName}</span>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
