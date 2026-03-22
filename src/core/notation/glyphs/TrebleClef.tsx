/**
 * Treble clef glyph rendered using the Bravura (SMuFL) music font.
 *
 * The SMuFL treble clef glyph (U+E050) has its origin on the G line —
 * the 2nd line from the bottom of the staff (line index 3 from the top).
 *
 * Uses `config` for accurate G-line positioning via lineSpacing.
 */

import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_TREBLE_CLEF } from '../glyphs.ts'
import type { StaffConfig } from '../types.ts'

interface TrebleClefProps {
  x: number
  y: number
  height: number
  color: string
  config: StaffConfig
}

export function TrebleClef({ x, height, color, config }: TrebleClefProps) {
  // SMuFL treble clef — scale to fit the staff height
  const fontSize = height * 0.72

  // The SMuFL treble clef origin sits on the G line (2nd line from bottom).
  // G line = staffTopMargin + 3 * lineSpacing
  const glyphY = config.staffTopMargin + 3 * config.lineSpacing

  return (
    <text
      x={x + 4}
      y={glyphY}
      fontFamily={NOTATION_FONT_FAMILY}
      fontSize={fontSize}
      fill={color}
      textAnchor="start"
    >
      {GLYPH_TREBLE_CLEF}
    </text>
  )
}
