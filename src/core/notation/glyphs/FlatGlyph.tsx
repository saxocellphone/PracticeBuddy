/**
 * Flat accidental glyph rendered using the Bravura (SMuFL) music font.
 * Replaces the hand-drawn SVG stem + belly path with a proper typeset glyph.
 */

import type { StaffConfig } from '../types.ts'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_FLAT } from '../glyphs.ts'

interface FlatGlyphProps {
  x: number
  y: number
  color: string
  config: StaffConfig
}

export function FlatGlyph({ x, y, color, config }: FlatGlyphProps) {
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
      {GLYPH_FLAT}
    </text>
  )
}
