/**
 * Key signature glyphs — renders sharp or flat symbols in standard order
 * at the correct staff positions for bass clef, using the Bravura (SMuFL)
 * music font for proper typeset quality.
 */

import type { StaffConfig } from '../types.ts'
import { bottomLineY } from '../config.ts'
import { KEY_SIG_SPACING } from './keySignatureLayout.ts'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import { GLYPH_SHARP, GLYPH_FLAT } from '../glyphs.ts'

interface KeySignatureGlyphsProps {
  keySig: {
    type: 'sharp' | 'flat' | 'none'
    accidentals: string[]
    steps: number[]
  }
  startX: number
  config: StaffConfig
}

/**
 * Convert diatonic steps from the bottom staff line to a Y coordinate.
 */
function stepsToY(stepsFromBottom: number, config: StaffConfig): number {
  const halfLine = config.lineSpacing / 2
  const bottom = bottomLineY(config)
  return bottom - stepsFromBottom * halfLine
}

export function KeySignatureGlyphs({ keySig, startX, config }: KeySignatureGlyphsProps) {
  if (keySig.type === 'none' || keySig.accidentals.length === 0) {
    return null
  }

  const fontSize = config.lineSpacing * 3.9
  const glyphChar = keySig.type === 'sharp' ? GLYPH_SHARP : GLYPH_FLAT

  return (
    <g>
      {keySig.accidentals.map((_symbol, i) => (
        <text
          key={`keysig-${i}`}
          x={startX + i * KEY_SIG_SPACING}
          y={stepsToY(keySig.steps[i], config)}
          fill={config.colors.clef}
          fontFamily={NOTATION_FONT_FAMILY}
          fontSize={fontSize}
          textAnchor="middle"
        >
          {glyphChar}
        </text>
      ))}
    </g>
  )
}
