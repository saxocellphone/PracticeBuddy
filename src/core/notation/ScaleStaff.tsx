/**
 * ScaleStaff -- renders a full scale as a horizontal scrolling staff.
 *
 * Drop-in replacement for the former StaffNotation component. Uses
 * DEFAULT_SCALE_CONFIG and composes Stave, StaveNote, and NoteLabel
 * building blocks. Includes auto-scroll to the current note, key
 * signature computation, and per-note coloring for past/current/future.
 */

import { useEffect, useId, useRef, useMemo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import type { PositionedChordSymbol } from '@core/endless/types.ts'
import type { StaffConfig } from './types.ts'
import { DEFAULT_SCALE_CONFIG, staffHeight } from './config.ts'
import { getKeySignature } from './keySignature.ts'
import { formatScaleNotes } from './formatter.ts'
import { getAccidental } from './accidental.ts'
import { stemUp } from './stem.ts'
import { getLedgerLines } from './pitch.ts'
import { Stave } from './components/Stave.tsx'
import { SharpGlyph } from './glyphs/SharpGlyph.tsx'
import { FlatGlyph } from './glyphs/FlatGlyph.tsx'
import { keySignatureWidth } from './glyphs/keySignatureLayout.ts'
import styles from './ScaleStaff.module.css'

/** Horizontal distance between note centers. */
const NOTE_SPACING = 56
/** Right margin at the end of the SVG. */
const RIGHT_MARGIN = 30
/** Bottom margin below the staff — room for ledger lines on low bass notes. */
const STAFF_BOTTOM_MARGIN = 40

interface ScaleStaffProps {
  scaleNotes: Note[]
  currentNoteIndex: number
  /** Optional chord symbol displayed above the staff (e.g. "Cmaj7") */
  chordSymbol?: string
  /** Positioned chord symbols for combined mode (multiple scales in one staff) */
  chordSymbols?: PositionedChordSymbol[]
}

/** Get note head color based on position relative to the current note. */
function getNoteColor(index: number, currentIndex: number): string {
  if (index < currentIndex) return '#16a34a' // past = green
  if (index === currentIndex) return '#4f46e5' // current = indigo
  return '#b0b0c0' // future = light gray
}

export function ScaleStaff({
  scaleNotes,
  currentNoteIndex,
  chordSymbol,
  chordSymbols,
}: ScaleStaffProps) {
  const config: StaffConfig = DEFAULT_SCALE_CONFIG
  const containerRef = useRef<HTMLDivElement>(null)
  const filterId = useId()
  const glowFilterId = `scale-glow-${filterId.replace(/:/g, '')}`

  // Compute key signature from the scale notes
  const keySig = useMemo(() => getKeySignature(scaleNotes), [scaleNotes])
  const keySigWidth = keySignatureWidth(keySig.accidentals.length)
  const leftMargin = config.clefWidth + keySigWidth + 10

  // SVG dimensions
  const svgWidth =
    leftMargin +
    Math.max(0, scaleNotes.length - 1) * NOTE_SPACING +
    RIGHT_MARGIN +
    NOTE_SPACING
  const svgHeight =
    config.staffTopMargin + staffHeight(config) + STAFF_BOTTOM_MARGIN

  // Compute note layouts
  const noteLayouts = useMemo(
    () => formatScaleNotes(scaleNotes, config, { leftMargin, noteSpacing: NOTE_SPACING }),
    [scaleNotes, config, leftMargin],
  )

  // Whether key signature covers sharps or flats (skip per-note accidentals)
  const useKeySig = keySig.type !== 'none'

  // Auto-scroll to the current note
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const noteX = leftMargin + currentNoteIndex * NOTE_SPACING
    const containerWidth = el.clientWidth
    const scrollTarget = noteX - containerWidth / 2
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' })
  }, [currentNoteIndex, leftMargin])

  const nr = config.noteRadius
  const stemLen = config.stemLengthMultiplier * config.lineSpacing

  return (
    <div className={styles.staffContainer} ref={containerRef}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={styles.staffSvg}
        style={{ minWidth: `${Math.max(svgWidth * 2, 800)}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Glow filter for the current note */}
        <defs>
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Single chord symbol above the staff, left-aligned like a lead sheet */}
        {chordSymbol && !chordSymbols?.length && (
          <text
            x={leftMargin}
            y={config.staffTopMargin - 14}
            textAnchor="start"
            fill="var(--color-text-primary)"
            fontSize="18"
            fontWeight={600}
            fontFamily="var(--font-family-mono, monospace)"
          >
            {chordSymbol}
          </text>
        )}

        {/* Positioned chord symbols for combined mode */}
        {chordSymbols?.map((cs) => (
          <text
            key={cs.noteIndex}
            x={leftMargin + cs.noteIndex * NOTE_SPACING}
            y={config.staffTopMargin - 14}
            textAnchor="start"
            fill="var(--color-text-primary)"
            fontSize="18"
            fontWeight={600}
            fontFamily="var(--font-family-mono, monospace)"
          >
            {cs.symbol}
          </text>
        ))}

        {/* Staff lines, clef, and key signature via Stave */}
        <Stave
          config={config}
          width={svgWidth - RIGHT_MARGIN + 10}
          showClef
          showKeySignature
          keySignature={keySig}
        >
          {/* Individual notes with per-note coloring */}
          {noteLayouts.map((layout) => {
            const { note, x, y, index } = layout
            const color = getNoteColor(index, currentNoteIndex)
            const ledgerLines = getLedgerLines(y, config)
            const isCurrent = index === currentNoteIndex
            // Show per-note accidentals only if no key signature (mixed sharps/flats)
            const accidental = useKeySig ? null : getAccidental(note.pitchClass)
            const up = stemUp(y, config)

            return (
              <g key={index}>
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

                {/* Per-note accidental (only for exotic scales without key signature) */}
                {accidental === 'sharp' && (
                  <SharpGlyph x={x - nr - 14} y={y} color={color} config={config} />
                )}
                {accidental === 'flat' && (
                  <FlatGlyph x={x - nr - 12} y={y} color={color} config={config} />
                )}

                {/* Note head (filled quarter-note style) */}
                <ellipse
                  cx={x}
                  cy={y}
                  rx={nr + 1}
                  ry={nr - 2}
                  fill={color}
                  filter={isCurrent ? `url(#${glowFilterId})` : undefined}
                  transform={`rotate(-20, ${x}, ${y})`}
                />

                {/* Stem */}
                {up ? (
                  <line
                    x1={x + nr}
                    y1={y}
                    x2={x + nr}
                    y2={y - stemLen}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                ) : (
                  <line
                    x1={x - nr}
                    y1={y}
                    x2={x - nr}
                    y2={y + stemLen}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}

              </g>
            )
          })}
        </Stave>
      </svg>
    </div>
  )
}
