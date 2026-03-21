/**
 * Sharp accidental glyph rendered using the Bravura (SMuFL) music font.
 * Replaces the hand-drawn SVG lines with a proper typeset glyph.
 */

import type { StaffConfig } from '../types.ts'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_SHARP } from '../glyphs.ts'

interface SharpGlyphProps {
  x: number
  y: number
  color: string
  config: StaffConfig
}

export function SharpGlyph({ x, y, color, config }: SharpGlyphProps) {
  // Font size scaled to match the staff: the glyph should span ~2 staff spaces.
  // VexFlow uses NOTATION_FONT_SCALE=39 at STAVE_LINE_DISTANCE=10 → ratio ~3.9
  const fontSize = config.lineSpacing * 3.9

  return (
    <text
      x={x}
      y={y}
      fontFamily={NOTATION_FONT_FAMILY}
      fontSize={fontSize}
      fill={color}
      textAnchor="middle"
    >
      {GLYPH_SHARP}
    </text>
  )
}
