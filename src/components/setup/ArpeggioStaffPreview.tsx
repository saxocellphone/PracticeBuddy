import { useMemo } from 'react'
import { buildArpeggioNotes } from '@core/music/arpeggioBuilder.ts'
import { getArpeggioStepLabel } from '@core/arpeggio/presets.ts'
import type { Note } from '@core/wasm/types.ts'
import type { ArpeggioSequence, ArpeggioDirection } from '@core/arpeggio/types.ts'
import type { NoteDuration, ScaleStartPosition } from '@core/rhythm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import { getKeySignature, getKeySignatureForScale } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import { SheetMusic, groupNotesIntoMeasures } from '@core/notation'

const BEATS_PER_MEASURE = 4

interface ArpeggioStaffPreviewProps {
  sequence: ArpeggioSequence | null
  direction: ArpeggioDirection
  numOctaves?: number
  noteDuration?: NoteDuration
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
  scaleStartPosition?: ScaleStartPosition
}

function buildAllPreviewNotes(
  sequence: ArpeggioSequence,
  direction: ArpeggioDirection,
  numOctaves: number,
  range?: { minMidi: number; maxMidi: number },
  noteDuration?: NoteDuration,
  scaleStartPosition?: ScaleStartPosition,
): { notes: Note[]; stepStartNoteIndices: number[]; restIndices: Set<number> } {
  const notes: Note[] = []
  const stepStartNoteIndices: number[] = []
  const restIndices = new Set<number>()

  const beatsPerNote = noteDuration ? NOTE_DURATION_BEATS[noteDuration] : null

  const stepsData = sequence.steps.map(step => ({
    step,
    notes: buildArpeggioNotes(step, direction, numOctaves, range).notes,
  }))

  for (let i = 0; i < stepsData.length; i++) {
    stepStartNoteIndices.push(notes.length)
    notes.push(...stepsData[i].notes)

    if (beatsPerNote && i < stepsData.length - 1 && scaleStartPosition !== 'immediately') {
      const totalBeats = notes.length * beatsPerNote
      const beatInMeasure = totalBeats % BEATS_PER_MEASURE

      if (beatInMeasure !== 0) {
        let targetBeat: number
        if (scaleStartPosition === 'next-measure') {
          targetBeat = BEATS_PER_MEASURE
        } else {
          targetBeat = beatInMeasure < 2 ? 2 : BEATS_PER_MEASURE
        }
        const restBeats = targetBeat - beatInMeasure
        if (restBeats > 0.001) {
          const restSlots = Math.round(restBeats / beatsPerNote)
          const placeholderNote = stepsData[i + 1].notes[0]
          for (let r = 0; r < restSlots; r++) {
            restIndices.add(notes.length)
            notes.push(placeholderNote)
          }
        }
      }
    }
  }

  return { notes, stepStartNoteIndices, restIndices }
}

export function ArpeggioStaffPreview({
  sequence,
  direction,
  numOctaves = 1,
  noteDuration = 'quarter',
  clef,
  range,
  scaleStartPosition,
}: ArpeggioStaffPreviewProps) {
  const { allNotes, stepStartNoteIndices, restIndices } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    try {
      const result = buildAllPreviewNotes(sequence, direction, numOctaves, range, noteDuration, scaleStartPosition)
      return { allNotes: result.notes, stepStartNoteIndices: result.stepStartNoteIndices, restIndices: result.restIndices }
    } catch (err) {
      console.error('ArpeggioStaffPreview buildAllPreviewNotes failed:', err)
      return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    }
  }, [sequence, direction, numOctaves, range, noteDuration, scaleStartPosition])

  const measureLabels = useMemo(() => {
    if (!sequence) return new Map<number, MeasureLabel[]>()
    const dBeats = NOTE_DURATION_BEATS[noteDuration]
    const nPerMeasure = Math.round(BEATS_PER_MEASURE / dBeats)
    const labels = new Map<number, MeasureLabel[]>()
    for (let i = 0; i < sequence.steps.length; i++) {
      const noteIndex = stepStartNoteIndices[i]
      const measureIndex = Math.floor(noteIndex / nPerMeasure)
      const noteIndexInMeasure = noteIndex % nPerMeasure
      const existing = labels.get(measureIndex) ?? []
      existing.push({ noteIndex: noteIndexInMeasure, text: getArpeggioStepLabel(sequence.steps[i], true) })
      labels.set(measureIndex, existing)
    }
    return labels
  }, [sequence, stepStartNoteIndices, noteDuration])

  const keySig = useMemo(() => {
    if (sequence && sequence.steps.length > 0) {
      const root = sequence.steps[0].root
      const cofKeySig = getKeySignatureForScale(root, 'Major')
      if (cofKeySig) return cofKeySig
    }
    return getKeySignature(allNotes)
  }, [sequence, allNotes])

  const measures = useMemo(
    () => groupNotesIntoMeasures(allNotes, noteDuration, { restIndices, measureLabels }),
    [allNotes, noteDuration, restIndices, measureLabels],
  )

  if (!sequence) return null

  return (
    <SheetMusic
      measures={measures}
      keySignature={keySig}
      lineWrap="width"
      scaling={{ scale: 0.6, minNotesPerLine: 16 }}
      clef={clef}
    />
  )
}
