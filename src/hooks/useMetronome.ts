import { useState, useRef, useCallback, useEffect } from 'react'
import {
  MetronomeEngine,
  type MetronomeState,
} from '@core/metronome/MetronomeEngine.ts'

export function useMetronome(audioContext: AudioContext | null, initialBpm: number = 120) {
  const [state, setState] = useState<MetronomeState>({
    isPlaying: false,
    currentBeat: 0,
    bpm: initialBpm,
    beatsPerMeasure: 4,
  })

  const engineRef = useRef<MetronomeEngine | null>(null)
  const pendingStartRef = useRef(false)
  // Track the latest BPM so we can sync it to newly-created engines
  const currentBpmRef = useRef(initialBpm)

  // Pending beat listeners registered via onBeat() before the engine existed.
  // Each entry is the original callback. When the engine is created we
  // subscribe them and store their unsubscribe functions so cleanup works.
  const pendingBeatListenersRef = useRef<Set<(beat: number, time: number) => void>>(new Set())
  // Map from user callback -> engine unsubscribe, so onBeat's returned
  // teardown can remove both pending AND engine-registered listeners.
  const activeUnsubscribesRef = useRef<Map<(beat: number, time: number) => void, () => void>>(new Map())

  // Create/recreate engine when audioContext changes
  useEffect(() => {
    if (!audioContext) return

    const engine = new MetronomeEngine(audioContext)
    // Sync the engine to whatever BPM the UI is currently showing
    engine.setBpm(currentBpmRef.current)
    engineRef.current = engine

    const unsubBeat = engine.onBeat((beat) => {
      setState((prev) => ({ ...prev, currentBeat: beat }))
    })

    // Flush any pending beat listeners that were registered before the
    // engine existed.  Subscribe them now and track their unsubscribes.
    for (const cb of pendingBeatListenersRef.current) {
      const unsub = engine.onBeat(cb)
      activeUnsubscribesRef.current.set(cb, unsub)
    }
    pendingBeatListenersRef.current.clear()

    // If start() was called before the engine existed, honour it now.
    // State is already set to isPlaying:true by the start() call, so
    // we only need to start the engine here.
    if (pendingStartRef.current) {
      pendingStartRef.current = false
      engine.start()
    }

    // Capture the map reference for the cleanup function so the
    // exhaustive-deps lint rule is satisfied.
    const activeUnsubs = activeUnsubscribesRef.current

    return () => {
      unsubBeat()
      // Clean up any active external subscriptions — they reference this
      // engine which is about to be disposed.
      for (const unsub of activeUnsubs.values()) {
        unsub()
      }
      activeUnsubs.clear()
      engine.dispose()
      engineRef.current = null
    }
  }, [audioContext])

  const start = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.start()
    } else {
      // Engine not yet created (AudioContext still initializing).
      // Queue the start so the effect above picks it up.
      pendingStartRef.current = true
    }
    setState((prev) => {
      if (prev.isPlaying) return prev
      return { ...prev, isPlaying: true }
    })
  }, [])

  const stop = useCallback(() => {
    pendingStartRef.current = false
    engineRef.current?.stop()
    setState((prev) => {
      if (!prev.isPlaying && prev.currentBeat === 0) return prev
      return { ...prev, isPlaying: false, currentBeat: 0 }
    })
  }, [])

  const setBpm = useCallback((bpm: number) => {
    currentBpmRef.current = bpm
    engineRef.current?.setBpm(bpm)
    setState((prev) => ({ ...prev, bpm }))
  }, [])

  const setBeatsPerMeasure = useCallback((beats: number) => {
    engineRef.current?.setBeatsPerMeasure(beats)
    setState((prev) => ({ ...prev, beatsPerMeasure: beats }))
  }, [])

  const onBeat = useCallback(
    (cb: (beat: number, time: number) => void): (() => void) => {
      if (engineRef.current) {
        const unsub = engineRef.current.onBeat(cb)
        activeUnsubscribesRef.current.set(cb, unsub)
        return () => {
          unsub()
          activeUnsubscribesRef.current.delete(cb)
        }
      }
      // Engine not yet created — queue the listener so it gets
      // subscribed once the engine is available.
      pendingBeatListenersRef.current.add(cb)
      return () => {
        // If still pending (engine hasn't been created yet), just remove it
        pendingBeatListenersRef.current.delete(cb)
        // If it was already flushed to the engine, clean up the real sub
        const unsub = activeUnsubscribesRef.current.get(cb)
        if (unsub) {
          unsub()
          activeUnsubscribesRef.current.delete(cb)
        }
      }
    },
    [],
  )

  return {
    ...state,
    start,
    stop,
    setBpm,
    setBeatsPerMeasure,
    onBeat,
  }
}
