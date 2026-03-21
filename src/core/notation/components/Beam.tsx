/**
 * Beam — renders a beam group: stems from each note to the beam line,
 * a primary beam connecting all notes, and a secondary beam for sixteenths.
 *
 * Uses computeBeamGeometry from beam.ts for layout calculations.
 */

import type { NoteLayout, StaffConfig } from '../types.ts'
import { computeBeamGeometry } from '../beam.ts'

interface BeamProps {
  group: NoteLayout[]
  config: StaffConfig
  color: string
}

export function Beam({ group, config, color }: BeamProps) {
  if (group.length < 2) return null

  const { beamUp, beamY, stemPositions } = computeBeamGeometry(group, config)
  const firstStemX = stemPositions[0].x
  const lastStemX = stemPositions[stemPositions.length - 1].x
  const isSixteenth = group[0].duration === 'sixteenth'
  const secondaryOffset = beamUp
    ? config.beamGap + config.beamThickness
    : -(config.beamGap + config.beamThickness)

  return (
    <g>
      {/* Stems extending from each note head to the beam line */}
      {stemPositions.map((stem, i) => (
        <line
          key={`beam-stem-${i}`}
          x1={stem.x}
          y1={stem.noteY}
          x2={stem.x}
          y2={beamY}
          stroke={color}
          strokeWidth={1.5}
        />
      ))}

      {/* Primary beam (connects all notes in the group) */}
      <line
        x1={firstStemX}
        y1={beamY}
        x2={lastStemX}
        y2={beamY}
        stroke={color}
        strokeWidth={config.beamThickness}
      />

      {/* Secondary beam for sixteenth notes */}
      {isSixteenth && (
        <line
          x1={firstStemX}
          y1={beamY + secondaryOffset}
          x2={lastStemX}
          y2={beamY + secondaryOffset}
          stroke={color}
          strokeWidth={config.beamThickness}
        />
      )}
    </g>
  )
}
