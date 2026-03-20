import { memo, useMemo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'

// --- Layout constants (SVG units, scaled up from StaffNotation.tsx) ---
const LINE_SPACING = 14
const STAFF_HEIGHT = 4 * LINE_SPACING // 5 lines = 4 gaps
const STAFF_TOP_MARGIN = 55
const NOTE_RADIUS = 8
const CLEF_WIDTH = 54
const TIME_SIG_WIDTH = 28
const STEM_LENGTH = 3.5 * LINE_SPACING
const BEAM_THICKNESS = 3.5
const BEAM_GAP = 5 // gap between double beams for sixteenth notes
const MIDDLE_LINE_Y = STAFF_TOP_MARGIN + 2 * LINE_SPACING // D3 line

// Colors
const NOTE_COLOR = '#eef0d4'
const STAFF_LINE_COLOR = 'rgba(232, 232, 240, 0.25)'
const CLEF_COLOR = 'rgba(232, 232, 240, 0.5)'

// --- Diatonic step mapping ---
// C=0, D=1, E=2, F=3, G=4, A=5, B=6
function diatonicStep(pitchClass: string): number {
  const base = pitchClass.charAt(0)
  const map: Record<string, number> = {
    C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
  }
  return map[base] ?? 0
}

// Bass clef bottom line = G2 -> absolute diatonic step = 2*7 + 4 = 18
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

  // Ledger lines above the staff
  for (let y = topLineY - LINE_SPACING; y >= noteY - LINE_SPACING / 2 + 1; y -= LINE_SPACING) {
    lines.push(y)
  }
  // Ledger lines below the staff
  for (let y = bottomLineY + LINE_SPACING; y <= noteY + LINE_SPACING / 2 - 1; y += LINE_SPACING) {
    lines.push(y)
  }

  // Ensure ledger lines for notes sitting ON a ledger line
  if (noteY < topLineY) {
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

function getAccidental(pitchClass: string): string | null {
  if (pitchClass.includes('#')) return '\u266F'
  if (pitchClass.includes('b') && pitchClass.length > 1) return '\u266D'
  return null
}

/** Returns true if the note's stem should go up (note is on or below middle line) */
function stemUp(noteY: number): boolean {
  return noteY >= MIDDLE_LINE_Y
}

/** Whether a duration has a stem */
function hasStem(duration: NoteDuration): boolean {
  return duration !== 'whole'
}

/** Get stem tip Y for a note at given Y position */
function stemTipY(noteY: number): number {
  return stemUp(noteY) ? noteY - STEM_LENGTH : noteY + STEM_LENGTH
}

/** Get stem X for a note at given X position */
function stemX(noteX: number, noteY: number): number {
  return stemUp(noteY) ? noteX + NOTE_RADIUS : noteX - NOTE_RADIUS
}

interface NoteLayout {
  note: Note
  duration: NoteDuration
  x: number
  y: number
  index: number
}

/**
 * Group beamable notes. Eighth notes beam in groups of 2, sixteenth notes in groups of 4.
 * Only consecutive notes of the same sub-beat duration get beamed.
 */
function getBeamGroups(layouts: NoteLayout[]): NoteLayout[][] {
  if (layouts.length < 2) return []

  const duration = layouts[0].duration
  if (duration !== 'eighth' && duration !== 'sixteenth') return []

  const groupSize = duration === 'eighth' ? 2 : 4
  const groups: NoteLayout[][] = []

  for (let i = 0; i < layouts.length; i += groupSize) {
    const group = layouts.slice(i, i + groupSize)
    if (group.length >= 2 && group.every((n) => n.duration === duration)) {
      groups.push(group)
    }
  }

  return groups
}

interface StaffNoteProps {
  notes: Array<{ note: Note; duration: NoteDuration }>
  showClef?: boolean
  showTimeSignature?: boolean
  beatsPerMeasure?: number
  beatValue?: number
  width: number
  height: number
  dimmed?: boolean
}

/**
 * Renders one measure of musical notes on a mini staff using bespoke SVG.
 * Replaces VexFlow with hand-drawn SVG elements inspired by StaffNotation.tsx.
 */
export const StaffNote = memo(function StaffNote({
  notes,
  showClef = false,
  showTimeSignature = false,
  beatsPerMeasure = 4,
  beatValue = 4,
  width,
  height,
  dimmed = false,
}: StaffNoteProps) {
  // Use height prop directly so SVG renders 1:1 with screen pixels — no scaling
  const svgHeight = height
  const svgWidth = width

  // Compute note layouts
  const noteLayouts = useMemo((): NoteLayout[] => {
    if (notes.length === 0) return []

    // Left offset: account for clef and time signature
    const leftPad = (showClef ? CLEF_WIDTH : 0) + (showTimeSignature ? TIME_SIG_WIDTH : 0)
    const availableWidth = svgWidth - leftPad

    // Evenly space notes across the available width
    const noteSpacing = notes.length === 1
      ? availableWidth / 2
      : availableWidth / notes.length

    return notes.map(({ note, duration }, index) => {
      const x = leftPad + noteSpacing * (index + 0.5)
      const y = noteToStaffY(note)
      return { note, duration, x, y, index }
    })
  }, [notes, svgWidth, showClef, showTimeSignature])

  const beamGroups = useMemo(() => getBeamGroups(noteLayouts), [noteLayouts])

  // Set of note indices that are part of a beam group (so we skip their flags)
  const beamedIndices = useMemo(() => {
    const set = new Set<number>()
    for (const group of beamGroups) {
      for (const layout of group) {
        set.add(layout.index)
      }
    }
    return set
  }, [beamGroups])

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        pointerEvents: 'none',
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {/* Staff lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`staff-line-${i}`}
          x1={4}
          x2={svgWidth - 4}
          y1={STAFF_TOP_MARGIN + i * LINE_SPACING}
          y2={STAFF_TOP_MARGIN + i * LINE_SPACING}
          stroke={STAFF_LINE_COLOR}
          strokeWidth={1}
        />
      ))}

      {/* Bass clef */}
      {showClef && (
        <svg
          x={2}
          y={STAFF_TOP_MARGIN - 8}
          width={48}
          height={62}
          viewBox="155 290 440 490"
        >
          <path
            d="m190.85 451.25c11.661 14.719 32.323 24.491 55.844 24.491 36.401 0 65.889-23.372 65.889-52.214s-29.488-52.214-65.889-52.214c-20.314 4.1522-28.593 9.0007-33.143-2.9091 17.976-54.327 46.918-66.709 96.546-66.709 65.914 0 96.969 59.897 96.969 142.97-18.225 190.63-205.95 286.75-246.57 316.19 5.6938 13.103 5.3954 12.631 5.3954 12.009 189.78-86.203 330.69-204.43 330.69-320.74 0-92.419-58.579-175.59-187.72-172.8-77.575 0-170.32 86.203-118 171.93zm328.1-89.88c0 17.852 14.471 32.323 32.323 32.323s32.323-14.471 32.323-32.323-14.471-32.323-32.323-32.323-32.323 14.471-32.323 32.323zm0 136.75c0 17.852 14.471 32.323 32.323 32.323s32.323-14.471 32.323-32.323-14.471-32.323-32.323-32.323-32.323 14.471-32.323 32.323z"
            fill={CLEF_COLOR}
            fillRule="evenodd"
          />
        </svg>
      )}

      {/* Time signature */}
      {showTimeSignature && (
        <g>
          <text
            x={showClef ? CLEF_WIDTH + 4 : 10}
            y={STAFF_TOP_MARGIN + LINE_SPACING * 1.5 + 1}
            fill={CLEF_COLOR}
            fontSize={20}
            fontWeight={700}
            fontFamily="serif"
            textAnchor="middle"
          >
            {beatsPerMeasure}
          </text>
          <text
            x={showClef ? CLEF_WIDTH + 4 : 10}
            y={STAFF_TOP_MARGIN + LINE_SPACING * 3.5 + 1}
            fill={CLEF_COLOR}
            fontSize={20}
            fontWeight={700}
            fontFamily="serif"
            textAnchor="middle"
          >
            {beatValue}
          </text>
        </g>
      )}

      {/* Notes */}
      {noteLayouts.map((layout) => {
        const { note, duration, x, y, index } = layout
        const ledgerLines = getLedgerLines(y)
        const accidental = getAccidental(note.pitchClass)
        const up = stemUp(y)
        const showStem = hasStem(duration)

        return (
          <g key={index}>
            {/* Ledger lines */}
            {ledgerLines.map((ly, li) => (
              <line
                key={`ledger-${index}-${li}`}
                x1={x - NOTE_RADIUS * 2.2}
                x2={x + NOTE_RADIUS * 2.2}
                y1={ly}
                y2={ly}
                stroke={STAFF_LINE_COLOR}
                strokeWidth={1}
              />
            ))}

            {/* Accidental */}
            {accidental && (
              <text
                x={x - NOTE_RADIUS - 9}
                y={y + 5}
                fill={NOTE_COLOR}
                fontSize={13}
                fontFamily="serif"
                textAnchor="end"
              >
                {accidental}
              </text>
            )}

            {/* Note head */}
            {duration === 'whole' ? (
              // Whole note: large hollow ellipse with thicker stroke
              <ellipse
                cx={x}
                cy={y}
                rx={NOTE_RADIUS + 2}
                ry={NOTE_RADIUS - 1}
                fill="none"
                stroke={NOTE_COLOR}
                strokeWidth={2.2}
                transform={`rotate(-20, ${x}, ${y})`}
              />
            ) : duration === 'half' ? (
              // Half note: hollow ellipse
              <ellipse
                cx={x}
                cy={y}
                rx={NOTE_RADIUS + 1}
                ry={NOTE_RADIUS - 2}
                fill="none"
                stroke={NOTE_COLOR}
                strokeWidth={2}
                transform={`rotate(-20, ${x}, ${y})`}
              />
            ) : (
              // Quarter, eighth, sixteenth: filled ellipse
              <ellipse
                cx={x}
                cy={y}
                rx={NOTE_RADIUS + 1}
                ry={NOTE_RADIUS - 2}
                fill={NOTE_COLOR}
                transform={`rotate(-20, ${x}, ${y})`}
              />
            )}

            {/* Stem */}
            {showStem && (
              <line
                x1={stemX(x, y)}
                y1={y}
                x2={stemX(x, y)}
                y2={stemTipY(y)}
                stroke={NOTE_COLOR}
                strokeWidth={1.5}
              />
            )}

            {/* Flag for unbeamed eighth/sixteenth notes */}
            {(duration === 'eighth' || duration === 'sixteenth') && !beamedIndices.has(index) && (
              <g>
                {/* Single flag for eighth note */}
                <path
                  d={up
                    ? `M${stemX(x, y)},${stemTipY(y)} q6,${LINE_SPACING * 0.8} 2,${LINE_SPACING * 1.6}`
                    : `M${stemX(x, y)},${stemTipY(y)} q-6,${-LINE_SPACING * 0.8} -2,${-LINE_SPACING * 1.6}`
                  }
                  fill="none"
                  stroke={NOTE_COLOR}
                  strokeWidth={2}
                />
                {/* Second flag for sixteenth note */}
                {duration === 'sixteenth' && (
                  <path
                    d={up
                      ? `M${stemX(x, y)},${stemTipY(y) + BEAM_GAP + 2} q6,${LINE_SPACING * 0.8} 2,${LINE_SPACING * 1.6}`
                      : `M${stemX(x, y)},${stemTipY(y) - BEAM_GAP - 2} q-6,${-LINE_SPACING * 0.8} -2,${-LINE_SPACING * 1.6}`
                    }
                    fill="none"
                    stroke={NOTE_COLOR}
                    strokeWidth={2}
                  />
                )}
              </g>
            )}

          </g>
        )
      })}

      {/* Beams */}
      {beamGroups.map((group, groupIndex) => {
        // Determine beam direction: use the majority stem direction, default to up
        const upCount = group.filter((n) => stemUp(n.y)).length
        const beamUp = upCount >= group.length / 2

        // For beams, all stems in the group go the same direction
        const firstNote = group[0]
        const lastNote = group[group.length - 1]

        const firstStemXPos = beamUp
          ? firstNote.x + NOTE_RADIUS
          : firstNote.x - NOTE_RADIUS
        const lastStemXPos = beamUp
          ? lastNote.x + NOTE_RADIUS
          : lastNote.x - NOTE_RADIUS

        // Find the extreme tip: the note farthest from the beam side determines the baseline
        const tipYValues = group.map((n) => {
          const baseY = beamUp ? n.y - STEM_LENGTH : n.y + STEM_LENGTH
          return baseY
        })
        // For beam up, beam sits at the minimum (highest) tip; for down, at the maximum (lowest)
        const beamY = beamUp
          ? Math.min(...tipYValues)
          : Math.max(...tipYValues)

        return (
          <g key={`beam-group-${groupIndex}`}>
            {/* Extend stems to meet the beam line */}
            {group.map((layout, ni) => {
              const sx = beamUp
                ? layout.x + NOTE_RADIUS
                : layout.x - NOTE_RADIUS
              return (
                <line
                  key={`beam-stem-${groupIndex}-${ni}`}
                  x1={sx}
                  y1={layout.y}
                  x2={sx}
                  y2={beamY}
                  stroke={NOTE_COLOR}
                  strokeWidth={1.5}
                />
              )
            })}

            {/* Primary beam (connects all notes in group) */}
            <line
              x1={firstStemXPos}
              y1={beamY}
              x2={lastStemXPos}
              y2={beamY}
              stroke={NOTE_COLOR}
              strokeWidth={BEAM_THICKNESS}
            />

            {/* Secondary beam for sixteenth notes */}
            {firstNote.duration === 'sixteenth' && (
              <line
                x1={firstStemXPos}
                y1={beamY + (beamUp ? BEAM_GAP + BEAM_THICKNESS : -(BEAM_GAP + BEAM_THICKNESS))}
                x2={lastStemXPos}
                y2={beamY + (beamUp ? BEAM_GAP + BEAM_THICKNESS : -(BEAM_GAP + BEAM_THICKNESS))}
                stroke={NOTE_COLOR}
                strokeWidth={BEAM_THICKNESS}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
})
