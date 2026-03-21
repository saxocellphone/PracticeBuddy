/**
 * StaveNote — renders a single note on the staff: note head, stem, flag,
 * ledger lines, and accidental glyph.
 *
 * Uses pure functions from stem.ts, pitch.ts, and accidental.ts to compute
 * positions and determine rendering details.
 *
 * Flags are rendered using Bravura (SMuFL) font glyphs instead of hand-drawn
 * SVG paths, giving pixel-perfect music notation quality.
 */

import type { NoteLayout, StaffConfig } from '../types.ts'
import { getLedgerLines } from '../pitch.ts'
import { getAccidental } from '../accidental.ts'
import { stemUp, stemX, stemTipY, hasStem } from '../stem.ts'
import { SharpGlyph } from '../glyphs/SharpGlyph.tsx'
import { FlatGlyph } from '../glyphs/FlatGlyph.tsx'
import { NOTATION_FONT_FAMILY } from '../font.ts'
import {
  GLYPH_FLAG_8TH_UP,
  GLYPH_FLAG_8TH_DOWN,
  GLYPH_FLAG_16TH_UP,
  GLYPH_FLAG_16TH_DOWN,
} from '../glyphs.ts'

interface StaveNoteProps {
  layout: NoteLayout
  config: StaffConfig
  color?: string
  /** When true, stem rendering is suppressed (the Beam component draws its own stems). */
  isBeamed?: boolean
  /** SVG filter ID for glow effect on active notes. */
  glowFilterId?: string
}

export function StaveNote({
  layout,
  config,
  color,
  isBeamed = false,
  glowFilterId,
}: StaveNoteProps) {
  const { note, duration, x, y, index } = layout
  const noteColor = color ?? config.colors.note
  const ledgerLines = getLedgerLines(y, config)
  const accidental = getAccidental(note.pitchClass)
  const up = stemUp(y, config)
  const showStem = hasStem(duration) && !isBeamed
  const ls = config.lineSpacing
  const nr = config.noteRadius

  return (
    <g
      key={index}
      filter={glowFilterId ? `url(#${glowFilterId})` : undefined}
    >
      {/* Ledger lines */}
      {ledgerLines.map((ly, li) => (
        <line
          key={`ledger-${index}-${li}`}
          x1={x - nr * 2.2}
          x2={x + nr * 2.2}
          y1={ly}
          y2={ly}
          stroke={config.colors.staffLine}
          strokeWidth={2}
        />
      ))}

      {/* Accidental glyph */}
      {accidental === 'sharp' && (
        <SharpGlyph x={x - nr - 14} y={y} color={noteColor} config={config} />
      )}
      {accidental === 'flat' && (
        <FlatGlyph x={x - nr - 12} y={y} color={noteColor} config={config} />
      )}

      {/* Note head */}
      {duration === 'whole' ? (
        // Whole note: large hollow ellipse with thicker stroke
        <ellipse
          cx={x}
          cy={y}
          rx={nr + 2}
          ry={nr - 1}
          fill="none"
          stroke={noteColor}
          strokeWidth={2.2}
          transform={`rotate(-20, ${x}, ${y})`}
        />
      ) : duration === 'half' ? (
        // Half note: hollow ellipse
        <ellipse
          cx={x}
          cy={y}
          rx={nr + 1}
          ry={nr - 2}
          fill="none"
          stroke={noteColor}
          strokeWidth={2}
          transform={`rotate(-20, ${x}, ${y})`}
        />
      ) : (
        // Quarter, eighth, sixteenth: filled ellipse
        <ellipse
          cx={x}
          cy={y}
          rx={nr + 1}
          ry={nr - 2}
          fill={noteColor}
          transform={`rotate(-20, ${x}, ${y})`}
        />
      )}

      {/* Stem (skipped for beamed notes — the Beam component draws those) */}
      {showStem && (
        <line
          x1={stemX(x, y, config)}
          y1={y}
          x2={stemX(x, y, config)}
          y2={stemTipY(y, config)}
          stroke={noteColor}
          strokeWidth={1.5}
        />
      )}

      {/* Flag for unbeamed eighth/sixteenth notes — Bravura font glyphs */}
      {(duration === 'eighth' || duration === 'sixteenth') && !isBeamed && (
        <NoteFlag
          stemXPos={stemX(x, y, config)}
          stemYPos={stemTipY(y, config)}
          up={up}
          isSixteenth={duration === 'sixteenth'}
          color={noteColor}
          lineSpacing={ls}
        />
      )}
    </g>
  )
}

// --- Internal: flag rendering using Bravura glyphs ---

interface NoteFlagProps {
  stemXPos: number
  stemYPos: number
  up: boolean
  isSixteenth: boolean
  color: string
  lineSpacing: number
}

/**
 * Renders note flags using Bravura (SMuFL) font glyphs.
 *
 * SMuFL flag glyphs have their origin at the end of the stem.
 * Up-stem flags extend to the right and curve down;
 * down-stem flags extend to the left and curve up.
 */
function NoteFlag({ stemXPos: sx, stemYPos: sy, up, isSixteenth, color, lineSpacing: ls }: NoteFlagProps) {
  const fontSize = ls * 3.9
  const codePoint = up
    ? (isSixteenth ? GLYPH_FLAG_16TH_UP : GLYPH_FLAG_8TH_UP)
    : (isSixteenth ? GLYPH_FLAG_16TH_DOWN : GLYPH_FLAG_8TH_DOWN)

  return (
    <text
      x={sx}
      y={sy}
      fontFamily={NOTATION_FONT_FAMILY}
      fontSize={fontSize}
      fill={color}
      textAnchor="start"
    >
      {codePoint}
    </text>
  )
}
