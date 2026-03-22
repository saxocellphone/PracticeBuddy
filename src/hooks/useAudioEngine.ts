import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioEngine, type AudioEngineState } from '@core/audio/AudioEngine.ts'

export function useAudioEngine() {
  const [state, setState] = useState<AudioEngineState>('uninitialized')
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [sampleRate, setSampleRate] = useState(44100)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)

  // Create engine on mount
  useEffect(() => {
    const engine = new AudioEngine()
    engineRef.current = engine
    const unsubscribe = engine.onStateChange((newState) => {
      setState(newState)
      // Sync derived audio properties into React state so downstream
      // hooks (useMetronome, usePitchDetection) re-render when they
      // become available after initialize().
      setAudioContext(engine.audioContext)
      setAnalyserNode(engine.analyserNode)
      setGainNode(engine.gainNode)
      setSampleRate(engine.sampleRate)
    })

    return () => {
      unsubscribe()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const initialize = useCallback(async (deviceId?: string): Promise<AudioContext | null> => {
    if (engineRef.current) {
      await engineRef.current.initialize(deviceId)
      // Enumerate devices after first getUserMedia so labels are available
      const inputDevices = await AudioEngine.enumerateInputDevices()
      setDevices(inputDevices)
      setCurrentDeviceId(engineRef.current.currentDeviceId)
      return engineRef.current.audioContext
    }
    return null
  }, [])

  const switchDevice = useCallback(async (deviceId: string): Promise<void> => {
    if (!engineRef.current) return
    await engineRef.current.switchDevice(deviceId)
    setCurrentDeviceId(engineRef.current.currentDeviceId)
    // Re-enumerate in case device list changed
    const inputDevices = await AudioEngine.enumerateInputDevices()
    setDevices(inputDevices)
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
    switchDevice,
    audioContext,
    analyserNode,
    gainNode,
    sampleRate,
    devices,
    currentDeviceId,
  }
}
