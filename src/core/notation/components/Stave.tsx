/**
 * Stave — a reusable 5-line staff with optional clef, time signature,
 * key signature, and barline. Children are rendered within the stave's
 * SVG coordinate space so note/rest components can position themselves
 * using the same StaffConfig.
 */

import type { ReactNode } from 'react'
import type { StaffConfig } from '../types.ts'
import { staffHeight } from '../config.ts'
import { BassClef } from '../glyphs/BassClef.tsx'
import { TrebleClef } from '../glyphs/TrebleClef.tsx'
import { TimeSignature } from '../glyphs/TimeSignature.tsx'
import { KeySignatureGlyphs } from '../glyphs/KeySignatureGlyphs.tsx'

interface StaveProps {
  config: StaffConfig
  width: number
  showClef?: boolean
  showTimeSignature?: boolean
  showKeySignature?: boolean
  showBarline?: boolean
  showFinalBarline?: boolean
  beatsPerMeasure?: number
  beatValue?: number
  keySignature?: {
    type: 'sharp' | 'flat' | 'none'
    accidentals: string[]
    steps: number[]
  }
  children?: ReactNode
}

export function Stave({
  config,
  width,
  showClef = false,
  showTimeSignature = false,
  showKeySignature = false,
  showBarline = false,
  showFinalBarline = false,
  beatsPerMeasure = 4,
  beatValue = 4,
  keySignature,
  children,
}: StaveProps) {
  const height = staffHeight(config)
  const topY = config.staffTopMargin
  const bottomY = topY + height

  // Time signature X position — after the clef
  const timeSigX = showClef ? config.clefWidth + 8 : 14

  // Key signature X position — after clef (and time signature if present)
  const keySigStartX =
    (showClef ? config.clefWidth : 0) +
    (showTimeSignature ? config.timeSigWidth : 0) +
    4

  return (
    <g>
      {/* 5 staff lines spanning full width */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`staff-line-${i}`}
          x1={0}
          x2={width}
          y1={topY + i * config.lineSpacing}
          y2={topY + i * config.lineSpacing}
          stroke={config.colors.staffLine}
          strokeWidth={2}
        />
      ))}

      {/* Clef */}
      {showClef && config.clef === 'bass' && (
        <BassClef
          x={2}
          y={topY - 8}
          width={config.clefWidth - 6}
          height={height + 18}
          color={config.colors.clef}
        />
      )}
      {showClef && config.clef === 'treble' && (
        <TrebleClef
          x={2}
          y={topY - 8}
          height={height + 18}
          color={config.colors.clef}
          config={config}
        />
      )}

      {/* Time signature */}
      {showTimeSignature && (
        <TimeSignature
          x={timeSigX}
          beatsPerMeasure={beatsPerMeasure}
          beatValue={beatValue}
          config={config}
        />
      )}

      {/* Key signature */}
      {showKeySignature && keySignature && keySignature.type !== 'none' && (
        <KeySignatureGlyphs
          keySig={keySignature}
          startX={keySigStartX}
          config={config}
        />
      )}

      {/* Barline at right edge */}
      {showBarline && !showFinalBarline && (
        <line
          x1={width}
          y1={topY}
          x2={width}
          y2={bottomY}
          stroke={config.colors.staffLine}
          strokeWidth={6}
        />
      )}

      {/* Final barline (thin + thick) at right edge — fully opaque */}
      {showFinalBarline && (
        <>
          <line
            x1={width - 10}
            y1={topY}
            x2={width - 10}
            y2={bottomY}
            stroke="#1a1a2e"
            strokeWidth={1.5}
          />
          <line
            x1={width - 3}
            y1={topY}
            x2={width - 3}
            y2={bottomY}
            stroke="#1a1a2e"
            strokeWidth={5}
          />
        </>
      )}

      {/* Child elements (notes, rests, beams, etc.) */}
      {children}
    </g>
  )
}
