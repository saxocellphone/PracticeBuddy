import { useMemo } from 'react'
import { buildAllWalkingBassStepsNotes } from '@core/walking-bass/sequence.ts'
import type { Note } from '@core/wasm/types.ts'
import type { WalkingBassSequence } from '@core/walking-bass/types.ts'
import type { ClefType } from '@core/instruments.ts'
import { getKeySignature, getKeySignatureForScale } from '@core/notation'
import type { MeasureLabel } from '@core/notation'
import { SheetMusic, groupNotesIntoMeasures } from '@core/notation'

interface WalkingBassStaffPreviewProps {
  sequence: WalkingBassSequence | null
  range?: { minMidi: number; maxMidi: number }
  clef?: ClefType
}

export function WalkingBassStaffPreview({
  sequence,
  range,
  clef,
}: WalkingBassStaffPreviewProps) {
  const { allNotes, boundaries } = useMemo(() => {
    if (!sequence) return { allNotes: [] as Note[], boundaries: [] }
    try {
      return buildAllWalkingBassStepsNotes(sequence, range)
    } catch (err) {
      console.error('WalkingBassStaffPreview build failed:', err)
      return { allNotes: [] as Note[], boundaries: [] }
    }
  }, [sequence, range])

  const measureLabels = useMemo(() => {
    const labels = new Map<number, MeasureLabel[]>()
    const notesPerMeasure = 4
    for (const boundary of boundaries) {
      const measureIndex = Math.floor(boundary.startNoteIndex / notesPerMeasure)
      const noteIndexInMeasure = boundary.startNoteIndex % notesPerMeasure
      const existing = labels.get(measureIndex) ?? []
      existing.push({ noteIndex: noteIndexInMeasure, text: boundary.label })
      labels.set(measureIndex, existing)
    }
    return labels
  }, [boundaries])

  const keySig = useMemo(() => {
    if (sequence && sequence.steps.length > 0) {
      const root = sequence.steps[0].root
      const cofKeySig = getKeySignatureForScale(root, 'Major')
      if (cofKeySig) return cofKeySig
    }
    return getKeySignature(allNotes)
  }, [sequence, allNotes])

  const measures = useMemo(
    () => groupNotesIntoMeasures(allNotes, 'quarter', { measureLabels }),
    [allNotes, measureLabels],
  )

  if (!sequence) return null

  return (
    <SheetMusic
      measures={measures}
      keySignature={keySig}
      lineWrap={{ count: 4 }}
      scaling={{ scale: 0.6 }}
      clef={clef}
    />
  )
}
