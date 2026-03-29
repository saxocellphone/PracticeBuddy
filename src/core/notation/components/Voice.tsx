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
  /** Override the default note color (used for future/inactive notes). */
  color?: string
  /** Override the active note color. */
  activeNoteColor?: string
  /** Color for notes before the active note (past notes). */
  pastNoteColor?: string
  /** When true, per-note accidentals are suppressed (e.g. when a key signature covers them). */
  hideAccidentals?: boolean
  /** Global note indices that should render as rests instead of note heads. */
  restIndices?: Set<number>
  /** Offset added to each note's local index to get its global index for restIndices lookup. */
  globalIndexOffset?: number
}

export function Voice({
  notes,
  config,
  startX,
  availableWidth,
  beatsPerMeasure = 4,
  activeNoteIndex = -1,
  color,
  activeNoteColor,
  pastNoteColor,
  hideAccidentals = false,
  restIndices,
  globalIndexOffset = 0,
}: VoiceProps) {
  const filterId = useId()
  const glowFilterId = `voice-glow-${filterId.replace(/:/g, '')}`

  // Compute cumulative beat position for each note (0-indexed)
  const noteBeatPositions = useMemo(() => {
    const positions: number[] = []
    let beatPos = 0
    for (const { duration } of notes) {
      positions.push(beatPos)
      beatPos += NOTE_DURATION_BEATS[duration]
    }
    return positions
  }, [notes])

  // Compute note layouts using cumulative beat positions on the beat grid
  const noteLayouts = useMemo((): NoteLayout[] => {
    if (notes.length === 0) return []

    return notes.map(({ note, duration }, index) => {
      const beatPos = noteBeatPositions[index]
      const durBeats = NOTE_DURATION_BEATS[duration]
      // Center note within its starting beat's quadrant (cap at 1 beat for positioning)
      const positionDur = Math.min(durBeats, 1)
      const x = startX + ((beatPos + positionDur / 2) / beatsPerMeasure) * availableWidth
      const y = noteToStaffY(note, config)
      return { note, duration, x, y, index }
    })
  }, [notes, noteBeatPositions, startX, availableWidth, beatsPerMeasure, config])

  // Compute rest layout for incomplete measures using proper rest-filling rules.
  // Key rule: never use a single rest that crosses beat 3, unless it's a whole rest.
  const restLayouts = useMemo((): RestLayout[] => {
    if (notes.length === 0) return []

    const beatsFilled = notes.reduce((sum, { duration }) => sum + NOTE_DURATION_BEATS[duration], 0)
    if (beatsFilled >= beatsPerMeasure - 0.001) return []

    let remainingBeats = beatsPerMeasure - beatsFilled
    let beatPosition = beatsFilled + 1 // 1-indexed beat where rests start

    const REST_CANDIDATES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25]

    function largestRestThatFits(remaining: number, beatPos: number): number {
      // If mid-beat, cap at the distance to the next beat boundary
      const fraction = beatPos % 1.0
      const onBeat = fraction < 0.001 || fraction > 0.999
      const maxForPosition = onBeat ? remaining : 1.0 - fraction

      for (const candidate of REST_CANDIDATES) {
        if (candidate > remaining) continue
        if (!onBeat && candidate > maxForPosition + 0.001) continue
        if (candidate < 4 && beatPos < 3 && beatPos + candidate > 3) continue
        return candidate
      }
      return remaining
    }

    const rests: RestLayout[] = []
    while (remainingBeats > 0.001) {
      const restBeats = largestRestThatFits(remainingBeats, beatPosition)
      const centerBeat = beatPosition + restBeats / 2
      const x = startX + ((centerBeat - 1) / beatsPerMeasure) * availableWidth
      rests.push({ x, durationBeats: restBeats })
      beatPosition += restBeats
      remainingBeats -= restBeats
    }
    return rests
  }, [notes, beatsPerMeasure, availableWidth, startX])

  // Beam groups: split at rest boundaries so notes from different scales
  // don't get beamed together across a rest.
  const beamGroups = useMemo(() => {
    if (restIndices && restIndices.size > 0) {
      // Split noteLayouts into segments separated by rest indices
      const segments: NoteLayout[][] = []
      let current: NoteLayout[] = []
      for (const l of noteLayouts) {
        if (restIndices.has(l.index + globalIndexOffset)) {
          if (current.length > 0) {
            segments.push(current)
            current = []
          }
        } else {
          current.push(l)
        }
      }
      if (current.length > 0) segments.push(current)
      // Compute beam groups within each segment independently
      return segments.flatMap(seg => getBeamGroups(seg))
    }
    return getBeamGroups(noteLayouts)
  }, [noteLayouts, restIndices, globalIndexOffset])

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
  const activeColor = activeNoteColor ?? config.colors.activeNote

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

      {/* Notes and inline rests */}
      {noteLayouts.map((layout) => {
        const isRest = restIndices?.has(layout.index + globalIndexOffset)
        if (isRest) {
          // Check if this is the START of a consecutive rest run
          const prevIsRest = layout.index > 0 && restIndices?.has((layout.index - 1) + globalIndexOffset)
          if (prevIsRest) return null // Skip — already rendered by the first rest in the run

          // Count consecutive rests starting here
          let runLength = 1
          while (restIndices?.has((layout.index + runLength) + globalIndexOffset) &&
                 (layout.index + runLength) < notes.length) {
            runLength++
          }

          // Compute total rest duration by summing actual note durations in the run
          let totalRestBeats = 0
          for (let ri = 0; ri < runLength; ri++) {
            totalRestBeats += NOTE_DURATION_BEATS[notes[layout.index + ri].duration]
          }

          // Use rest-filling logic: split into proper rest durations
          const REST_CANDIDATES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25]
          const beatPos = noteBeatPositions[layout.index] + 1 // 1-indexed
          let remaining = totalRestBeats
          let currentBeatPos = beatPos
          const rests: { x: number; durationBeats: number }[] = []

          while (remaining > 0.001) {
            // If mid-beat, cap at the distance to the next beat boundary
            const fraction = currentBeatPos % 1.0
            const onBeat = fraction < 0.001 || fraction > 0.999
            const maxForPosition = onBeat ? remaining : 1.0 - fraction

            let restBeats = remaining
            for (const candidate of REST_CANDIDATES) {
              if (candidate > remaining) continue
              if (!onBeat && candidate > maxForPosition + 0.001) continue
              if (candidate < 4 && currentBeatPos < 3 && currentBeatPos + candidate > 3) continue
              restBeats = candidate
              break
            }
            const centerBeat = currentBeatPos + restBeats / 2
            const x = startX + ((centerBeat - 1) / beatsPerMeasure) * availableWidth
            rests.push({ x, durationBeats: restBeats })
            currentBeatPos += restBeats
            remaining -= restBeats
          }

          return rests.map((r, ri) => (
            <Rest
              key={`rest-${layout.index}-${ri}`}
              x={r.x}
              durationBeats={r.durationBeats}
              color={noteColor}
              config={config}
            />
          ))
        }

        const isActive = layout.index === activeNoteIndex
        const isPast = pastNoteColor && activeNoteIndex >= 0 && layout.index < activeNoteIndex
        const resolvedColor = isActive ? activeColor : isPast ? pastNoteColor : noteColor

        return (
          <StaveNote
            key={layout.index}
            layout={layout}
            config={config}
            color={resolvedColor}
            isBeamed={beamedIndices.has(layout.index)}
            glowFilterId={isActive ? glowFilterId : undefined}
            hideAccidentals={hideAccidentals}
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
