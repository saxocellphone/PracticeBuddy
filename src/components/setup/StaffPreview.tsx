import { useMemo } from 'react'
import { buildAllStepsNotes } from '@core/rhythm/sequence.ts'
import type { ScaleStartPosition } from '@core/rhythm/types.ts'
import { getStepChordSymbol } from '@core/scales/presets.ts'
import { NOTE_DURATION_BEATS } from '@core/rhythm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'
import type { Note, ScaleDirection } from '@core/wasm/types.ts'
import type { ClefType } from '@core/instruments.ts'
import type { ScaleSequence } from '@core/scales/types.ts'
import { getKeySignature, getKeySignatureForScale } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import { SheetMusic, groupNotesIntoMeasures } from '@core/notation'

const BEATS_PER_MEASURE = 4

interface StaffPreviewProps {
  sequence: ScaleSequence | null
  direction: ScaleDirection
  numOctaves: number
  noteDuration?: NoteDuration
  scaleStartPosition?: ScaleStartPosition
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
}

export function StaffPreview({
  sequence,
  direction,
  numOctaves,
  noteDuration = 'quarter',
  scaleStartPosition,
  clef,
  range,
}: StaffPreviewProps) {
  const { allNotes, stepStartNoteIndices, restIndices } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    try {
      const adjusted = { ...sequence, direction, numOctaves }
      const { allNotes, boundaries, restIndices } = buildAllStepsNotes(adjusted, false, noteDuration, scaleStartPosition, range)
      return { allNotes, stepStartNoteIndices: boundaries.map(b => b.startNoteIndex), restIndices }
    } catch (err) {
      console.error('StaffPreview buildAllPreviewNotes failed:', err)
      return { allNotes: [] as Note[], stepStartNoteIndices: [] as number[], restIndices: new Set<number>() }
    }
  }, [sequence, direction, numOctaves, noteDuration, scaleStartPosition, range])

  const measureLabels = useMemo(() => {
    if (!sequence) return new Map<number, MeasureLabel[]>()
    const dBeats = NOTE_DURATION_BEATS[noteDuration]
    const nPerMeasure = Math.round(BEATS_PER_MEASURE / dBeats)
    const labels = new Map<number, MeasureLabel[]>()
    for (let i = 0; i < sequence.steps.length; i++) {
      const noteIndex = stepStartNoteIndices[i]
      const measureIndex = Math.floor(noteIndex / nPerMeasure)
      const noteIndexInMeasure = noteIndex % nPerMeasure
      const chordText = getStepChordSymbol(sequence.steps[i])
      if (chordText) {
        const existing = labels.get(measureIndex) ?? []
        existing.push({ noteIndex: noteIndexInMeasure, text: chordText })
        labels.set(measureIndex, existing)
      }
    }
    return labels
  }, [sequence, stepStartNoteIndices, noteDuration])

  const keySig = useMemo(() => {
    if (sequence && sequence.steps.length === 1) {
      const step = sequence.steps[0]
      const cofKeySig = getKeySignatureForScale(step.rootNote, 'Major')
      if (cofKeySig) return cofKeySig
    }
    if (sequence && sequence.steps.length > 1) {
      return { type: 'none' as const, accidentals: [], steps: [] }
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
