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
): { codePoint: string; y: number; dotted: boolean } {
  const midY = middleLineY(config)
  const ls = config.lineSpacing

  // Check for dotted durations (1.5x of a base value)
  // Dotted half = 3, dotted quarter = 1.5, dotted eighth = 0.75, dotted sixteenth = 0.375
  switch (durationBeats) {
    case 4:
      return { codePoint: GLYPH_REST_WHOLE, y: midY - ls, dotted: false }
    case 3:
      return { codePoint: GLYPH_REST_HALF, y: midY, dotted: true }
    case 2:
      return { codePoint: GLYPH_REST_HALF, y: midY, dotted: false }
    case 1.5:
      return { codePoint: GLYPH_REST_QUARTER, y: midY, dotted: true }
    case 1:
      return { codePoint: GLYPH_REST_QUARTER, y: midY, dotted: false }
    case 0.75:
      return { codePoint: GLYPH_REST_8TH, y: midY, dotted: true }
    case 0.5:
      return { codePoint: GLYPH_REST_8TH, y: midY, dotted: false }
    case 0.375:
      return { codePoint: GLYPH_REST_16TH, y: midY, dotted: true }
    case 0.25:
      return { codePoint: GLYPH_REST_16TH, y: midY, dotted: false }
    default:
      return { codePoint: GLYPH_REST_QUARTER, y: midY, dotted: false }
  }
}

export function Rest({ x, durationBeats, color, config }: RestProps) {
  const { codePoint, y, dotted } = getRestGlyph(durationBeats, config)
  const fontSize = config.lineSpacing * 3.9

  return (
    <g>
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
      {dotted && (
        <circle
          cx={x + fontSize * 0.35}
          cy={middleLineY(config) - config.lineSpacing * 0.5}
          r={config.noteRadius * 0.3}
          fill={color}
        />
      )}
    </g>
  )
}
