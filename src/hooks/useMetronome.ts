import { useState, useRef, useCallback, useEffect } from 'react'
import {
  MetronomeEngine,
  type MetronomeState,
} from '@core/metronome/MetronomeEngine.ts'

export function useMetronome(audioContext: AudioContext | null) {
  const [state, setState] = useState<MetronomeState>({
    isPlaying: false,
    currentBeat: 0,
    bpm: 120,
    beatsPerMeasure: 4,
  })

  const engineRef = useRef<MetronomeEngine | null>(null)

  // Create/recreate engine when audioContext changes
  useEffect(() => {
    if (!audioContext) return

    const engine = new MetronomeEngine(audioContext)
    engineRef.current = engine

    const unsubBeat = engine.onBeat((beat) => {
      setState((prev) => ({ ...prev, currentBeat: beat }))
    })

    return () => {
      unsubBeat()
      engine.dispose()
      engineRef.current = null
    }
  }, [audioContext])

  const start = useCallback(() => {
    engineRef.current?.start()
    setState((prev) => {
      if (prev.isPlaying) return prev
      return { ...prev, isPlaying: true }
    })
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setState((prev) => {
      if (!prev.isPlaying && prev.currentBeat === 0) return prev
      return { ...prev, isPlaying: false, currentBeat: 0 }
    })
  }, [])

  const setBpm = useCallback((bpm: number) => {
    engineRef.current?.setBpm(bpm)
    setState((prev) => ({ ...prev, bpm }))
  }, [])

  const setBeatsPerMeasure = useCallback((beats: number) => {
    engineRef.current?.setBeatsPerMeasure(beats)
    setState((prev) => ({ ...prev, beatsPerMeasure: beats }))
  }, [])

  return {
    ...state,
    start,
    stop,
    setBpm,
    setBeatsPerMeasure,
  }
}
