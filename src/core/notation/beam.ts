import type { NoteLayout, StaffConfig } from './types.ts'
import { stemUp, stemLength } from './stem.ts'

/**
 * Group beamable notes into beam groups.
 * Eighth notes beam in groups of 2, sixteenth notes in groups of 4.
 * Only consecutive notes of the same sub-beat duration get beamed.
 * Returns empty array if fewer than 2 notes or non-beamable duration.
 */
export function getBeamGroups(layouts: NoteLayout[]): NoteLayout[][] {
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

export interface BeamGeometry {
  /** Whether the beam group's stems point up */
  beamUp: boolean
  /** Y coordinate of the beam line(s) */
  beamY: number
  /** Per-note stem positions within the group */
  stemPositions: Array<{ x: number; noteY: number }>
}

/**
 * Compute the geometry for rendering a beam across a group of notes.
 * Determines beam direction by majority vote, then finds the extreme
 * stem tip to place the beam, ensuring all stems reach the beam line.
 */
export function computeBeamGeometry(group: NoteLayout[], config: StaffConfig): BeamGeometry {
  // Determine beam direction: use the majority stem direction, default to up
  const upCount = group.filter((n) => stemUp(n.y, config)).length
  const beamUp = upCount >= group.length / 2

  const length = stemLength(config)

  // Compute the stem tip Y for each note (before clamping to the beam line)
  const tipYValues = group.map((n) => {
    return beamUp ? n.y - length : n.y + length
  })

  // Beam sits at the most extreme tip: highest (min) for up, lowest (max) for down
  const beamY = beamUp ? Math.min(...tipYValues) : Math.max(...tipYValues)

  // Compute stem X positions — all go the same direction for the beam group
  const stemPositions = group.map((layout) => ({
    x: beamUp
      ? layout.x + config.noteRadius
      : layout.x - config.noteRadius,
    noteY: layout.y,
  }))

  return { beamUp, beamY, stemPositions }
}
