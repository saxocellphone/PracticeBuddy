// --- High-level composed components ---
export { MeasureStaff } from './MeasureStaff.tsx'
export type { MeasureLabel } from './MeasureStaff.tsx'

// --- Unified sheet music layout ---
export { SheetMusic, groupNotesIntoMeasures } from './sheetMusic/index.ts'
export type { SheetMeasure, SheetMusicProps, LineWrapStrategy, ScaleMode, ActiveNoteConfig } from './sheetMusic/index.ts'

// --- Building-block components ---
export { Stave } from './components/Stave.tsx'
export { StaveNote } from './components/StaveNote.tsx'
export { Rest } from './components/Rest.tsx'
export { Beam } from './components/Beam.tsx'
export { Voice } from './components/Voice.tsx'
export { NoteLabel } from './components/NoteLabel.tsx'

// --- Glyph components ---
export { BassClef } from './glyphs/BassClef.tsx'
export { TrebleClef } from './glyphs/TrebleClef.tsx'
export { SharpGlyph } from './glyphs/SharpGlyph.tsx'
export { FlatGlyph } from './glyphs/FlatGlyph.tsx'
export { TimeSignature } from './glyphs/TimeSignature.tsx'
export { KeySignatureGlyphs } from './glyphs/KeySignatureGlyphs.tsx'

// --- Pure functions ---
export { noteToStaffY, diatonicStep, getLedgerLines } from './pitch.ts'
export { getKeySignature, getKeySignatureForScale } from './keySignature.ts'
export { getAccidental } from './accidental.ts'
export { stemUp, stemX, stemTipY, hasStem } from './stem.ts'
export { getBeamGroups, computeBeamGeometry } from './beam.ts'
export { formatMeasureNotes, formatScaleNotes } from './formatter.ts'
export { computeRestLayout } from './restFill.ts'

// --- Font & Glyphs ---
export { loadNotationFont, NOTATION_FONT_FAMILY } from './font.ts'
export {
  GLYPH_FLAG_8TH_UP,
  GLYPH_FLAG_8TH_DOWN,
  GLYPH_FLAG_16TH_UP,
  GLYPH_FLAG_16TH_DOWN,
  GLYPH_REST_WHOLE,
  GLYPH_REST_HALF,
  GLYPH_REST_QUARTER,
  GLYPH_REST_8TH,
  GLYPH_REST_16TH,
  GLYPH_SHARP,
  GLYPH_FLAT,
  GLYPH_NATURAL,
  GLYPH_TREBLE_CLEF,
  GLYPH_BASS_CLEF,
  GLYPH_TIME_DIGITS,
} from './glyphs.ts'

// --- Layout ---
export { staveContentStartX, ACCIDENTAL_LEFT_MARGIN } from './components/staveLayout.ts'
export { keySignatureWidth } from './glyphs/keySignatureLayout.ts'

// --- Config ---
export {
  DEFAULT_MEASURE_CONFIG,
  DEFAULT_SCALE_CONFIG,
  createConfig,
  staffHeight,
  middleLineY,
  bottomLineY,
} from './config.ts'

// --- Types ---
export type {
  StaffConfig,
  StaffColors,
  NoteLayout,
  RestLayout,
  AccidentalType,
} from './types.ts'
