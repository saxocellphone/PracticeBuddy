/**
 * Rest — renders a rest glyph using the Bravura (SMuFL) music font.
 *
 * Each rest duration maps to a specific SMuFL code point rendered as an
 * SVG <text> element. The Bravura font must be loaded before these render
 * correctly (see font.ts).
 *
 * Rest durations:
 * - Whole rest (4 beats): hangs from the 2nd staff line
 * - Half rest (2 beats): sits on the middle staff line
 * - Quarter rest (1 beat): centered on the middle line
 * - Eighth rest (0.5 beats): centered on the middle line
 * - Sixteenth rest (0.25 beats): centered on the middle line
 */

import type { StaffConfig } from '../types.ts'
import { middleLineY } from '../config.ts'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import {
  GLYPH_REST_WHOLE,
  GLYPH_REST_HALF,
  GLYPH_REST_QUARTER,
  GLYPH_REST_8TH,
  GLYPH_REST_16TH,
} from '../glyphs.ts'

interface RestProps {
  x: number
  durationBeats: number
  color: string
  config: StaffConfig
}

/**
 * Map a beat duration to its SMuFL glyph code point and vertical position.
 *
 * SMuFL rest glyphs have their origin at the middle staff line (B3 in treble,
 * D3 in bass). The whole and half rests need vertical offsets because they
 * sit on / hang from specific lines rather than centering on the middle.
 */
function getRestGlyph(
  durationBeats: number,
  config: StaffConfig,
): { codePoint: string; y: number } {
  const midY = middleLineY(config)
  const ls = config.lineSpacing

  switch (durationBeats) {
    case 4:
      // Whole rest — the glyph origin is at the middle line;
      // it needs to sit one line higher (hangs from 2nd line)
      return { codePoint: GLYPH_REST_WHOLE, y: midY - ls }
    case 2:
      // Half rest — sits on the middle line
      return { codePoint: GLYPH_REST_HALF, y: midY }
    case 1:
      return { codePoint: GLYPH_REST_QUARTER, y: midY }
    case 0.5:
      return { codePoint: GLYPH_REST_8TH, y: midY }
    case 0.25:
      return { codePoint: GLYPH_REST_16TH, y: midY }
    default:
      return { codePoint: GLYPH_REST_QUARTER, y: midY }
  }
}

export function Rest({ x, durationBeats, color, config }: RestProps) {
  const { codePoint, y } = getRestGlyph(durationBeats, config)
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
      {codePoint}
    </text>
  )
}
