/**
 * Time signature glyph — two stacked numbers centered on the staff,
 * rendered using Bravura (SMuFL) time signature digit glyphs.
 *
 * Each number fills exactly 2 staff spaces (VexFlow standard):
 * the top number spans lines 1-3, the bottom spans lines 3-5.
 */

import type { StaffConfig } from '../types.ts'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_TIME_DIGITS } from '../glyphs.ts'

interface TimeSignatureProps {
  x: number
  beatsPerMeasure: number
  beatValue: number
  config: StaffConfig
}

/**
 * Convert a number to its SMuFL time-signature digit string.
 * Multi-digit numbers (e.g. 12) are converted digit-by-digit.
 */
function toTimeDigits(n: number): string {
  return String(n)
    .split('')
    .map((ch) => GLYPH_TIME_DIGITS[Number(ch)] ?? ch)
    .join('')
}

export function TimeSignature({ x, beatsPerMeasure, beatValue, config }: TimeSignatureProps) {
  const ls = config.lineSpacing
  const fontSize = ls * 3.9

  // The glyph visually extends about 1 staff space above the baseline at this font size.
  // Top "4": should span lines 1-3. Place baseline so the glyph top touches line 1.
  const topY = config.staffTopMargin + ls * 1
  // Bottom "4": should span lines 3-5. Place baseline so the glyph top touches line 3.
  const bottomY = config.staffTopMargin + ls * 3

  return (
    <g>
      <text
        x={x}
        y={topY}
        fill={config.colors.clef}
        fontFamily={NOTATION_FONT_FAMILY}
        fontSize={fontSize}
        textAnchor="middle"
      >
        {toTimeDigits(beatsPerMeasure)}
      </text>
      <text
        x={x}
        y={bottomY}
        fill={config.colors.clef}
        fontFamily={NOTATION_FONT_FAMILY}
        fontSize={fontSize}
        textAnchor="middle"
      >
        {toTimeDigits(beatValue)}
      </text>
    </g>
  )
}
