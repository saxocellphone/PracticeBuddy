import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioEngine, type AudioEngineState } from '@core/audio/AudioEngine.ts'

export function useAudioEngine() {
  const [state, setState] = useState<AudioEngineState>('uninitialized')
  const engineRef = useRef<AudioEngine | null>(null)

  // Create engine on mount
  useEffect(() => {
    const engine = new AudioEngine()
    engineRef.current = engine
    const unsubscribe = engine.onStateChange(setState)

    return () => {
      unsubscribe()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const initialize = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.initialize()
    }
  }, [])

  const dispose = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose()
    }
  }, [])

  return {
    state,
    initialize,
    dispose,
    audioContext: engineRef.current?.audioContext ?? null,
    analyserNode: engineRef.current?.analyserNode ?? null,
    sampleRate: engineRef.current?.sampleRate ?? 44100,
  }
}
