/**
 * SMuFL Unicode code points for Bravura music notation glyphs.
 *
 * These are the standard code points from the SMuFL specification:
 * https://w3c.github.io/smufl/latest/tables/
 *
 * Used by notation components to render proper music glyphs via
 * SVG <text> elements with the Bravura font.
 */

// --- Flags ---
export const GLYPH_FLAG_8TH_UP = '\uE240'
export const GLYPH_FLAG_8TH_DOWN = '\uE241'
export const GLYPH_FLAG_16TH_UP = '\uE242'
export const GLYPH_FLAG_16TH_DOWN = '\uE243'

// --- Rests ---
export const GLYPH_REST_WHOLE = '\uE4E3'
export const GLYPH_REST_HALF = '\uE4E4'
export const GLYPH_REST_QUARTER = '\uE4E5'
export const GLYPH_REST_8TH = '\uE4E6'
export const GLYPH_REST_16TH = '\uE4E7'

// --- Accidentals ---
export const GLYPH_SHARP = '\uE262'
export const GLYPH_FLAT = '\uE260'
export const GLYPH_NATURAL = '\uE261'

// --- Clefs ---
export const GLYPH_BASS_CLEF = '\uE062'

// --- Time signature digits (0-9) ---
export const GLYPH_TIME_DIGITS = [
  '\uE080', // 0
  '\uE081', // 1
  '\uE082', // 2
  '\uE083', // 3
  '\uE084', // 4
  '\uE085', // 5
  '\uE086', // 6
  '\uE087', // 7
  '\uE088', // 8
  '\uE089', // 9
] as const
