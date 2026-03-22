import type { StaffConfig, StaffColors } from './types.ts'

/**
 * Measure-view config — matches the constants in StaffNote.tsx.
 * Used for rhythm practice measure rendering with clef + time signature.
 */
export const DEFAULT_MEASURE_CONFIG: StaffConfig = {
  clef: 'bass',
  lineSpacing: 14,
  noteRadius: 8,
  staffTopMargin: 80,
  stemLengthMultiplier: 3.5,
  beamThickness: 3.5,
  beamGap: 5,
  clefWidth: 54,
  timeSigWidth: 34,
  colors: {
    note: '#1a1a2e',
    staffLine: 'rgba(0, 0, 0, 0.55)',
    clef: 'rgba(0, 0, 0, 0.7)',
    activeNote: '#16a34a',
  },
}

/**
 * Scale-view config — matches the constants in StaffNotation.tsx.
 * Used for the scale-practice display (no time signature).
 */
export const DEFAULT_SCALE_CONFIG: StaffConfig = {
  clef: 'bass',
  lineSpacing: 12,
  noteRadius: 7,
  staffTopMargin: 75,
  stemLengthMultiplier: 3.5,
  beamThickness: 3.5,
  beamGap: 5,
  clefWidth: 50,
  timeSigWidth: 0,
  colors: {
    note: '#b0b0c0',
    staffLine: 'rgba(0, 0, 0, 0.55)',
    clef: 'rgba(0, 0, 0, 0.7)',
    activeNote: '#6366f1',
  },
}

/** Deep-merge overrides onto the default measure config. */
export function createConfig(overrides: Partial<StaffConfig> & { colors?: Partial<StaffColors> }): StaffConfig {
  const { colors: colorOverrides, ...rest } = overrides
  return {
    ...DEFAULT_MEASURE_CONFIG,
    ...rest,
    colors: {
      ...DEFAULT_MEASURE_CONFIG.colors,
      ...colorOverrides,
    },
  }
}

/** Total height of the staff (4 gaps between 5 lines). */
export function staffHeight(config: StaffConfig): number {
  return 4 * config.lineSpacing
}

/** Y coordinate of the middle (3rd) staff line (D3 in bass clef, B4 in treble). */
export function middleLineY(config: StaffConfig): number {
  return config.staffTopMargin + 2 * config.lineSpacing
}

/** Y coordinate of the bottom (5th) staff line. */
export function bottomLineY(config: StaffConfig): number {
  return config.staffTopMargin + staffHeight(config)
}
