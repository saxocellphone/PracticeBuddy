import { PITCH_CLASSES } from '@core/music/pitchClass.ts'

interface RootNoteSelectorProps {
  /** Currently selected pitch class (e.g. 'C', 'Eb') */
  value: string
  /** Called when the user selects a different root note */
  onChange: (pitchClass: string) => void
  /** CSS module styles from the parent setup component (for theme-aware chip colors) */
  classes: Record<string, string>
  /** When true, render two rows of 6 chips; otherwise one row of 12. Defaults to false. */
  twoRows?: boolean
}

export function RootNoteSelector({ value, onChange, classes, twoRows = false }: RootNoteSelectorProps) {
  const renderChip = (pc: string) => (
    <button
      key={pc}
      className={`${classes.chip} ${value === pc ? classes.chipActive : ''}`}
      onClick={() => onChange(pc)}
    >
      {pc}
    </button>
  )

  return (
    <div className={classes.configSection}>
      <span className={classes.configLabel}>Root Note</span>
      {twoRows ? (
        <>
          <div className={classes.chipRow}>
            {PITCH_CLASSES.slice(0, 6).map(renderChip)}
          </div>
          <div className={classes.chipRow}>
            {PITCH_CLASSES.slice(6).map(renderChip)}
          </div>
        </>
      ) : (
        <div className={classes.chipRow}>
          {PITCH_CLASSES.map(renderChip)}
        </div>
      )}
    </div>
  )
}
