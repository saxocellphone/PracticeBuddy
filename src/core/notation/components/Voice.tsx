/**
 * Voice — computes the layout for a sequence of notes within a measure and
 * renders the appropriate StaveNote, Rest, and Beam children.
 *
 * This component encapsulates the layout logic that was previously inline
 * in StaffNote.tsx: converting notes to NoteLayout positions, computing
 * rest fills for incomplete measures, determining beam groups, and
 * rendering everything with the correct active-note highlighting.
 *
 * Uses React.useId() for SVG filter IDs to avoid collisions when multiple
 * Voice instances render on the same page.
 */

import { useId, useMemo } from 'react'
import type { Note } from '@core/wasm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { NoteLayout, RestLayout, StaffConfig } from '../types.ts'
import { noteToStaffY } from '../pitch.ts'
import { getBeamGroups } from '../beam.ts'
import { StaveNote } from './StaveNote.tsx'
import { Rest } from './Rest.tsx'
import { Beam } from './Beam.tsx'

interface VoiceProps {
  notes: Array<{ note: Note; duration: NoteDuration }>
  config: StaffConfig
  startX: number
  availableWidth: number
  beatsPerMeasure?: number
  /** Index of the currently active note (-1 or undefined for none). */
  activeNoteIndex?: number
  /** Override the default note color. */
  color?: string
}

export function Voice({
  notes,
  config,
  startX,
  availableWidth,
  beatsPerMeasure = 4,
  activeNoteIndex = -1,
  color,
}: VoiceProps) {
  const filterId = useId()
  const glowFilterId = `voice-glow-${filterId.replace(/:/g, '')}`

  // Compute note layouts using fixed spacing on the beat grid
  const noteLayouts = useMemo((): NoteLayout[] => {
    if (notes.length === 0) return []

    const durationBeats = NOTE_DURATION_BEATS[notes[0].duration]
    const expectedNotesPerMeasure = Math.round(beatsPerMeasure / durationBeats)
    const noteSpacing = availableWidth / expectedNotesPerMeasure

    return notes.map(({ note, duration }, index) => {
      const x = startX + noteSpacing * (index + 0.5)
      const y = noteToStaffY(note, config)
      return { note, duration, x, y, index }
    })
  }, [notes, startX, availableWidth, beatsPerMeasure, config])

  // Compute rest layout for incomplete measures using proper rest-filling rules.
  // Key rule: never use a single rest that crosses beat 3, unless it's a whole rest.
  const restLayouts = useMemo((): RestLayout[] => {
    if (notes.length === 0) return []

    const noteDurationBeats = NOTE_DURATION_BEATS[notes[0].duration]
    const expectedCount = Math.round(beatsPerMeasure / noteDurationBeats)
    if (notes.length >= expectedCount) return []

    const noteSpacing = availableWidth / expectedCount
    const beatsFilled = notes.length * noteDurationBeats
    let remainingBeats = beatsPerMeasure - beatsFilled
    let beatPosition = beatsFilled + 1 // 1-indexed beat where rests start

    const REST_CANDIDATES = [4, 2, 1, 0.5, 0.25]

    function largestRestThatFits(remaining: number, beatPos: number): number {
      for (const candidate of REST_CANDIDATES) {
        if (candidate > remaining) continue
        // Check beat-3 crossing: skip if starts before beat 3 and ends after beat 3
        // Exception: whole rest (4 beats) is always OK
        if (candidate < 4 && beatPos < 3 && beatPos + candidate > 3) continue
        return candidate
      }
      return remaining
    }

    const rests: RestLayout[] = []
    while (remainingBeats > 0.001) {
      const restBeats = largestRestThatFits(remainingBeats, beatPosition)
      const centerBeat = beatPosition + restBeats / 2
      const centerSlot = (centerBeat - 1) / noteDurationBeats
      const x = startX + noteSpacing * centerSlot
      rests.push({ x, durationBeats: restBeats })
      beatPosition += restBeats
      remainingBeats -= restBeats
    }
    return rests
  }, [notes, beatsPerMeasure, availableWidth, startX])

  // Beam groups and the set of beamed note indices
  const beamGroups = useMemo(() => getBeamGroups(noteLayouts), [noteLayouts])

  const beamedIndices = useMemo(() => {
    const set = new Set<number>()
    for (const group of beamGroups) {
      for (const layout of group) {
        set.add(layout.index)
      }
    }
    return set
  }, [beamGroups])

  const noteColor = color ?? config.colors.note
  const activeColor = config.colors.activeNote

  return (
    <g>
      {/* Glow filter for the active note */}
      <defs>
        <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Notes */}
      {noteLayouts.map((layout) => {
        const isActive = layout.index === activeNoteIndex
        return (
          <StaveNote
            key={layout.index}
            layout={layout}
            config={config}
            color={isActive ? activeColor : noteColor}
            isBeamed={beamedIndices.has(layout.index)}
            glowFilterId={isActive ? glowFilterId : undefined}
          />
        )
      })}

      {/* Rests to fill out incomplete measures */}
      {restLayouts.map((rest, i) => (
        <Rest
          key={`rest-${i}`}
          x={rest.x}
          durationBeats={rest.durationBeats}
          color={noteColor}
          config={config}
        />
      ))}

      {/* Beams */}
      {beamGroups.map((group, groupIndex) => (
        <Beam
          key={`beam-${groupIndex}`}
          group={group}
          config={config}
          color={noteColor}
        />
      ))}
    </g>
  )
}
