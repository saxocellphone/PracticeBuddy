/**
 * Bass clef glyph rendered using the Bravura (SMuFL) music font.
 *
 * The SMuFL bass clef glyph (U+E062) has its origin at the top staff line
 * (specifically at the F line — the 4th line from bottom in bass clef,
 * which is the 2nd line from top).
 *
 * The `x` and `y` props position the glyph within the stave, and
 * `height` is used to derive the appropriate font size.
 */

import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_BASS_CLEF } from '../glyphs.ts'

interface BassClefProps {
  x: number
  y: number
  width: number
  height: number
  color: string
}

export function BassClef({ x, y, height, color }: BassClefProps) {
  // The clef glyph should span the full staff height.
  // SMuFL glyphs at fontSize = lineSpacing * 4 span exactly 4 staff spaces.
  // The height prop includes padding (staffHeight + 18), so scale from that.
  // Use a ratio that makes the clef visually fit: approximately height * 0.72
  const fontSize = height * 0.72

  // The SMuFL bass clef origin sits on the F line (4th line = 2nd from top).
  // y is staffTopMargin - 8, so the F line is at y + 8 + lineSpacing.
  // We position the text at the F line so the glyph aligns correctly.
  const glyphY = y + 8 + fontSize * 0.26

  return (
    <text
      x={x + 4}
      y={glyphY}
      fontFamily={NOTATION_FONT_FAMILY}
      fontSize={fontSize}
      fill={color}
      textAnchor="start"
    >
      {GLYPH_BASS_CLEF}
    </text>
  )
}
