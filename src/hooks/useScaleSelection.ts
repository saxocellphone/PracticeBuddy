import { useState, useMemo, useCallback, useEffect } from 'react'
import { listScaleTypes, buildScale, getScaleType } from '@core/wasm/scales.ts'
import type { Note, ScaleInfo, ScaleDirection } from '@core/wasm/types.ts'

const PITCH_CLASSES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const

const STORAGE_KEY = 'practicebuddy:scale-selection'

export interface ScaleSelection {
  rootNote: string
  rootOctave: number
  scaleTypeIndex: number
  direction: ScaleDirection
}

const DEFAULT_SELECTION: ScaleSelection = {
  rootNote: 'E',
  rootOctave: 2,
  scaleTypeIndex: 0, // Major
  direction: 'ascending',
}

function loadSelection(): ScaleSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SELECTION
    const parsed = JSON.parse(raw)
    return {
      rootNote: typeof parsed.rootNote === 'string' ? parsed.rootNote : DEFAULT_SELECTION.rootNote,
      rootOctave: typeof parsed.rootOctave === 'number' ? parsed.rootOctave : DEFAULT_SELECTION.rootOctave,
      scaleTypeIndex: typeof parsed.scaleTypeIndex === 'number' ? parsed.scaleTypeIndex : DEFAULT_SELECTION.scaleTypeIndex,
      direction: ['ascending', 'descending', 'both'].includes(parsed.direction) ? parsed.direction : DEFAULT_SELECTION.direction,
    }
  } catch {
    return DEFAULT_SELECTION
  }
}

export function useScaleSelection() {
  const [selection, setSelection] = useState<ScaleSelection>(loadSelection)

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  }, [selection])

  const availableScales = useMemo(() => listScaleTypes(), [])

  const setRootNote = useCallback((note: string) => {
    setSelection((prev) => ({ ...prev, rootNote: note }))
  }, [])

  const setRootOctave = useCallback((octave: number) => {
    setSelection((prev) => ({ ...prev, rootOctave: octave }))
  }, [])

  const setScaleType = useCallback((index: number) => {
    setSelection((prev) => ({ ...prev, scaleTypeIndex: index }))
  }, [])

  const setDirection = useCallback((direction: ScaleDirection) => {
    setSelection((prev) => ({ ...prev, direction }))
  }, [])

  const scaleNotes = useMemo((): Note[] => {
    try {
      const ScaleType = getScaleType()
      const rootFull = `${selection.rootNote}${selection.rootOctave}`
      const scaleTypeValues = Object.values(ScaleType).filter(
        (v) => typeof v === 'number'
      ) as number[]
      const scaleType = scaleTypeValues[selection.scaleTypeIndex] ?? 0
      return buildScale(rootFull, scaleType, selection.direction)
    } catch {
      return []
    }
  }, [selection])

  const selectedScaleInfo: ScaleInfo | null = useMemo(() => {
    return availableScales[selection.scaleTypeIndex] ?? null
  }, [availableScales, selection.scaleTypeIndex])

  return {
    selection,
    availableScales,
    scaleNotes,
    selectedScaleInfo,
    pitchClasses: PITCH_CLASSES,
    setRootNote,
    setRootOctave,
    setScaleType,
    setDirection,
  }
}
