import { PITCH_CLASSES } from '@core/music/pitchClass.ts'

const LOOP_OPTIONS = [
  { label: 'No shift', value: 0 },
  { label: 'Circle of 4ths', value: 5 },
  { label: 'Circle of 5ths', value: 7 },
  { label: 'Chromatic', value: 1 },
  { label: 'Whole tone', value: 2 },
] as const

export interface LoopSectionProps {
  /** Current shift-semitones value (0 = no shift) */
  shiftSemitones: number
  onShiftSemitonesChange: (value: number) => void
  /** Current repeat count (used when shiftSemitones === 0) */
  loopCount: number
  onLoopCountChange: (value: number | ((prev: number) => number)) => void
  /** Current "shift until" key (used when shiftSemitones > 0) */
  shiftUntilKey: string
  onShiftUntilKeyChange: (key: string) => void
  /** The current root key -- used to reset shiftUntilKey when changing shift mode */
  rootKey: string
  /** CSS module styles from the parent setup component (for theme-aware chip colors) */
  classes: Record<string, string>
  /** How to render the "Until" key selector: 'select' for a dropdown, 'chips' for small chip buttons. Defaults to 'select'. */
  untilVariant?: 'select' | 'chips'
  /** When true, split loop option chips into two rows (3+2). Defaults to false (single row). */
  twoRows?: boolean
}

export function LoopSection({
  shiftSemitones,
  onShiftSemitonesChange,
  loopCount,
  onLoopCountChange,
  shiftUntilKey,
  onShiftUntilKeyChange,
  rootKey,
  classes,
  untilVariant = 'select',
  twoRows = false,
}: LoopSectionProps) {
  const handleOptionClick = (value: number) => {
    onShiftSemitonesChange(value)
    if (value > 0) onShiftUntilKeyChange(rootKey)
  }

  const renderOptionChip = (opt: (typeof LOOP_OPTIONS)[number]) => (
    <button
      key={opt.value}
      className={`${classes.chip} ${shiftSemitones === opt.value ? classes.chipActive : ''}`}
      onClick={() => handleOptionClick(opt.value)}
    >
      {opt.label}
    </button>
  )

  return (
    <div className={classes.configSection}>
      <span className={classes.configLabel}>Loop</span>
      {twoRows ? (
        <>
          <div className={classes.chipRow}>
            {LOOP_OPTIONS.slice(0, 3).map(renderOptionChip)}
          </div>
          <div className={classes.chipRow}>
            {LOOP_OPTIONS.slice(3).map(renderOptionChip)}
          </div>
        </>
      ) : (
        <div className={classes.chipRow}>
          {LOOP_OPTIONS.map(renderOptionChip)}
        </div>
      )}
      {shiftSemitones === 0 ? (
        <div className={classes.loopSubControl}>
          <span className={classes.loopSubLabel}>Repeat</span>
          <div className={classes.stepper}>
            <button
              className={classes.stepperButton}
              onClick={() => onLoopCountChange((c) => Math.max(1, c - 1))}
              disabled={loopCount <= 1}
            >
              &minus;
            </button>
            <span className={classes.stepperValue}>{loopCount}</span>
            <button
              className={classes.stepperButton}
              onClick={() => onLoopCountChange((c) => Math.min(12, c + 1))}
              disabled={loopCount >= 12}
            >
              +
            </button>
          </div>
          <span className={classes.loopSubHint}>
            {loopCount === 1 ? 'time' : 'times'}
          </span>
        </div>
      ) : untilVariant === 'chips' ? (
        <div className={classes.loopSubControl}>
          <span className={classes.loopSubLabel}>Until</span>
          <div className={classes.chipRow}>
            {PITCH_CLASSES.map((pc) => (
              <button
                key={pc}
                className={`${classes.chip} ${classes.chipSmall ?? ''} ${shiftUntilKey === pc ? classes.chipActive : ''}`}
                onClick={() => onShiftUntilKeyChange(pc)}
              >
                {pc}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={classes.loopSubControl}>
          <span className={classes.loopSubLabel}>Until</span>
          <select
            className={classes.loopSelect ?? ''}
            value={shiftUntilKey}
            onChange={(e) => onShiftUntilKeyChange(e.target.value)}
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={pc}>{pc}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
