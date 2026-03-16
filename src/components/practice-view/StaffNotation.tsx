import { useEffect, useRef, useMemo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import styles from './StaffNotation.module.css'

interface StaffNotationProps {
  scaleNotes: Note[]
  currentNoteIndex: number
  lastResult: string | null
  ignoreOctave?: boolean
}

// --- Layout constants (SVG units) ---
const LINE_SPACING = 12
const STAFF_HEIGHT = 4 * LINE_SPACING // 5 lines = 4 gaps
const STAFF_TOP_MARGIN = 50
const STAFF_BOTTOM_MARGIN = 50
const NOTE_RADIUS = 7
const NOTE_SPACING = 56
const CLEF_WIDTH = 50
const KEY_SIG_SPACING = 10 // space between each accidental in key signature
const RIGHT_MARGIN = 30
const STEM_LENGTH = 3.5 * LINE_SPACING
const MIDDLE_LINE_Y = STAFF_TOP_MARGIN + 2 * LINE_SPACING // D3 line

// --- Key signature definitions ---
// Standard order of sharps and flats, with their staff position
// (diatonic steps from bottom line G2) for bass clef
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const SHARP_STEPS = [6, 3, 7, 4, 1, 5, 2] // F3, C3, G3, D3, A2, E3, B2

const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
const FLAT_STEPS = [2, 5, 1, 4, 0, 3, 6] // B2, E3, A2, D3, G2, C3, F3

function stepsToY(stepsFromBottom: number): number {
  const halfLine = LINE_SPACING / 2
  const bottomLineY = STAFF_TOP_MARGIN + STAFF_HEIGHT
  return bottomLineY - stepsFromBottom * halfLine
}

// --- Diatonic step mapping ---
// C=0, D=1, E=2, F=3, G=4, A=5, B=6
function diatonicStep(pitchClass: string): number {
  const base = pitchClass.charAt(0)
  const map: Record<string, number> = {
    C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
  }
  return map[base] ?? 0
}

// Bass clef bottom line = G2 → absolute diatonic step = 2*7 + 4 = 18
const BASS_CLEF_BOTTOM_STEP = 2 * 7 + 4 // G2

function noteToStaffY(note: Note): number {
  const step = note.octave * 7 + diatonicStep(note.pitchClass)
  const stepsFromBottom = step - BASS_CLEF_BOTTOM_STEP
  const halfLine = LINE_SPACING / 2
  const bottomLineY = STAFF_TOP_MARGIN + STAFF_HEIGHT
  return bottomLineY - stepsFromBottom * halfLine
}

function getLedgerLines(noteY: number): number[] {
  const lines: number[] = []
  const topLineY = STAFF_TOP_MARGIN
  const bottomLineY = STAFF_TOP_MARGIN + STAFF_HEIGHT

  for (let y = topLineY - LINE_SPACING; y >= noteY - LINE_SPACING / 2 + 1; y -= LINE_SPACING) {
    lines.push(y)
  }
  for (let y = bottomLineY + LINE_SPACING; y <= noteY + LINE_SPACING / 2 - 1; y += LINE_SPACING) {
    lines.push(y)
  }
  const isOnLine = (y: number) => Math.abs(y % LINE_SPACING) < 0.5 || Math.abs(y % LINE_SPACING - LINE_SPACING) < 0.5
  if (noteY < topLineY && isOnLine(noteY - topLineY)) {
    for (let y = topLineY - LINE_SPACING; y >= noteY - 0.5; y -= LINE_SPACING) {
      if (!lines.includes(y)) lines.push(y)
    }
  }
  if (noteY > bottomLineY) {
    for (let y = bottomLineY + LINE_SPACING; y <= noteY + 0.5; y += LINE_SPACING) {
      if (!lines.includes(y)) lines.push(y)
    }
  }

  return [...new Set(lines)]
}

function getNoteColor(index: number, currentIndex: number): string {
  if (index < currentIndex) return '#22c55e'
  if (index === currentIndex) return '#6366f1'
  return '#555570'
}

function getNoteLabelColor(index: number, currentIndex: number): string {
  if (index < currentIndex) return '#22c55e'
  if (index === currentIndex) return '#e8e8f0'
  return '#555570'
}

/** Extract key signature from scale notes. Returns the accidentals in standard order. */
function getKeySignature(notes: Note[]): { type: 'sharp' | 'flat' | 'none'; accidentals: string[]; steps: number[] } {
  const accidentalNotes = new Set<string>()
  for (const note of notes) {
    if (note.pitchClass.includes('#')) accidentalNotes.add(note.pitchClass.charAt(0))
    else if (note.pitchClass.includes('b') && note.pitchClass.length > 1) accidentalNotes.add(note.pitchClass.charAt(0))
  }

  if (accidentalNotes.size === 0) return { type: 'none', accidentals: [], steps: [] }

  // Check if all accidentals are sharps or all flats
  const hasSharp = notes.some((n) => n.pitchClass.includes('#'))
  const hasFlat = notes.some((n) => n.pitchClass.includes('b') && n.pitchClass.length > 1)

  if (hasSharp && !hasFlat) {
    // Collect sharps in standard order
    const accidentals: string[] = []
    const steps: number[] = []
    for (let i = 0; i < SHARP_ORDER.length; i++) {
      if (accidentalNotes.has(SHARP_ORDER[i])) {
        accidentals.push('♯')
        steps.push(SHARP_STEPS[i])
      }
    }
    return { type: 'sharp', accidentals, steps }
  }

  if (hasFlat && !hasSharp) {
    const accidentals: string[] = []
    const steps: number[] = []
    for (let i = 0; i < FLAT_ORDER.length; i++) {
      if (accidentalNotes.has(FLAT_ORDER[i])) {
        accidentals.push('♭')
        steps.push(FLAT_STEPS[i])
      }
    }
    return { type: 'flat', accidentals, steps }
  }

  // Mixed sharps/flats (exotic scales) — no key signature, use individual accidentals
  return { type: 'none', accidentals: [], steps: [] }
}

function getAccidental(pitchClass: string): string | null {
  if (pitchClass.includes('#')) return '♯'
  if (pitchClass.includes('b') && pitchClass.length > 1) return '♭'
  return null
}

export function StaffNotation({
  scaleNotes,
  currentNoteIndex,
  lastResult,
  ignoreOctave = false,
}: StaffNotationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const keySig = useMemo(() => getKeySignature(scaleNotes), [scaleNotes])
  const keySigWidth = keySig.accidentals.length > 0
    ? keySig.accidentals.length * KEY_SIG_SPACING + 12
    : 0
  const leftMargin = CLEF_WIDTH + keySigWidth + 10

  const svgWidth = leftMargin + Math.max(0, scaleNotes.length - 1) * NOTE_SPACING + RIGHT_MARGIN + NOTE_SPACING
  const svgHeight = STAFF_TOP_MARGIN + STAFF_HEIGHT + STAFF_BOTTOM_MARGIN

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const noteX = leftMargin + currentNoteIndex * NOTE_SPACING
    const containerWidth = el.clientWidth
    const scrollTarget = noteX - containerWidth / 2
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' })
  }, [currentNoteIndex, leftMargin])

  const bottomLineY = STAFF_TOP_MARGIN + STAFF_HEIGHT
  // Whether key signature covers sharps or flats (so we skip per-note accidentals)
  const useKeySig = keySig.type !== 'none'

  return (
    <div className={styles.staffContainer} ref={containerRef}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className={styles.staffSvg}
        style={{ minWidth: `${Math.max(svgWidth * 2, 400)}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="noteGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Staff lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`line-${i}`}
            x1={10}
            x2={svgWidth - RIGHT_MARGIN + 10}
            y1={STAFF_TOP_MARGIN + i * LINE_SPACING}
            y2={STAFF_TOP_MARGIN + i * LINE_SPACING}
            stroke="rgba(232, 232, 240, 0.25)"
            strokeWidth={1}
          />
        ))}

        {/* Bass clef symbol — centered on staff, dots straddle F3 line */}
        <svg
          x={2}
          y={STAFF_TOP_MARGIN - 7}
          width={44}
          height={58}
          viewBox="155 290 440 490"
        >
          <path
            d="m190.85 451.25c11.661 14.719 32.323 24.491 55.844 24.491 36.401 0 65.889-23.372 65.889-52.214s-29.488-52.214-65.889-52.214c-20.314 4.1522-28.593 9.0007-33.143-2.9091 17.976-54.327 46.918-66.709 96.546-66.709 65.914 0 96.969 59.897 96.969 142.97-18.225 190.63-205.95 286.75-246.57 316.19 5.6938 13.103 5.3954 12.631 5.3954 12.009 189.78-86.203 330.69-204.43 330.69-320.74 0-92.419-58.579-175.59-187.72-172.8-77.575 0-170.32 86.203-118 171.93zm328.1-89.88c0 17.852 14.471 32.323 32.323 32.323s32.323-14.471 32.323-32.323-14.471-32.323-32.323-32.323-32.323 14.471-32.323 32.323zm0 136.75c0 17.852 14.471 32.323 32.323 32.323s32.323-14.471 32.323-32.323-14.471-32.323-32.323-32.323-32.323 14.471-32.323 32.323z"
            fill="rgba(232, 232, 240, 0.5)"
            fillRule="evenodd"
          />
        </svg>

        {/* Key signature */}
        {keySig.accidentals.map((symbol, i) => (
          <text
            key={`keysig-${i}`}
            x={CLEF_WIDTH + 4 + i * KEY_SIG_SPACING}
            y={stepsToY(keySig.steps[i]) + 4}
            fill="rgba(232, 232, 240, 0.5)"
            fontSize={13}
            fontFamily="serif"
            textAnchor="middle"
          >
            {symbol}
          </text>
        ))}

        {/* Notes */}
        {scaleNotes.map((note, i) => {
          const x = leftMargin + i * NOTE_SPACING
          const y = noteToStaffY(note)
          const color = getNoteColor(i, currentNoteIndex)
          const labelColor = getNoteLabelColor(i, currentNoteIndex)
          const ledgerLines = getLedgerLines(y)
          const isCurrent = i === currentNoteIndex
          // Show per-note accidentals only if no key signature (mixed sharps/flats)
          const accidental = useKeySig ? null : getAccidental(note.pitchClass)

          return (
            <g key={i}>
              {/* Ledger lines */}
              {ledgerLines.map((ly, li) => (
                <line
                  key={`ledger-${i}-${li}`}
                  x1={x - NOTE_RADIUS * 2.2}
                  x2={x + NOTE_RADIUS * 2.2}
                  y1={ly}
                  y2={ly}
                  stroke="rgba(232, 232, 240, 0.25)"
                  strokeWidth={1}
                />
              ))}

              {/* Per-note accidental (only for exotic scales without key signature) */}
              {accidental && (
                <text
                  x={x - NOTE_RADIUS - 8}
                  y={y + 4}
                  fill={color}
                  fontSize={11}
                  fontFamily="serif"
                  textAnchor="end"
                >
                  {accidental}
                </text>
              )}

              {/* Note head (tilted oval like real notation) */}
              <ellipse
                cx={x}
                cy={y}
                rx={NOTE_RADIUS + 1}
                ry={NOTE_RADIUS - 2}
                fill={color}
                filter={isCurrent ? 'url(#noteGlow)' : undefined}
                transform={`rotate(-20, ${x}, ${y})`}
              />

              {/* Stem */}
              {y >= MIDDLE_LINE_Y ? (
                <line
                  x1={x + NOTE_RADIUS}
                  y1={y}
                  x2={x + NOTE_RADIUS}
                  y2={y - STEM_LENGTH}
                  stroke={color}
                  strokeWidth={1.5}
                />
              ) : (
                <line
                  x1={x - NOTE_RADIUS}
                  y1={y}
                  x2={x - NOTE_RADIUS}
                  y2={y + STEM_LENGTH}
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}

              {/* Note name label */}
              <text
                x={x}
                y={bottomLineY + 28}
                fill={labelColor}
                fontSize={9}
                fontFamily="'JetBrains Mono', 'Fira Code', monospace"
                fontWeight={isCurrent ? 700 : 400}
                textAnchor="middle"
              >
                {ignoreOctave ? note.pitchClass : note.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
