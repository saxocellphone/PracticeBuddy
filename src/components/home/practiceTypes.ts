/** Content type — what instrument/theory concept to practice */
export type PracticeMode = 'scales' | 'arpeggios' | 'walking-bass' | 'jazz-standards'

/** Timing mode — how the practice session is paced */
export type TimingMode = 'follow' | 'rhythm' | 'sheet-music'

/** All timing modes — used as the default when a mode doesn't restrict. */
export const ALL_TIMING_MODES: TimingMode[] = ['sheet-music', 'follow', 'rhythm']

/** Which timing modes each practice mode supports (undefined = all). */
const MODE_TIMING_OVERRIDES: Partial<Record<PracticeMode, TimingMode[]>> = {
  'jazz-standards': ['sheet-music'],
}

/** Look up which timing modes a practice mode supports. */
export function getAllowedTimingModes(mode: PracticeMode): TimingMode[] {
  return MODE_TIMING_OVERRIDES[mode] ?? ALL_TIMING_MODES
}
