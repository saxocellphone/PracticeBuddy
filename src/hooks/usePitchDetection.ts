import { useState, useRef, useCallback, useEffect } from 'react'
import { TypedPitchDetector } from '@core/wasm/pitchDetector.ts'
import { frequencyToNote } from '@core/wasm/noteUtils.ts'
import { AutoGainControl } from '@core/audio/agc.ts'
import type { DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'

export interface PitchDetectionResult {
  pitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
  currentGain: number
}

export function usePitchDetection(options: {
  analyserNode: AnalyserNode | null
  gainNode?: GainNode | null
  sampleRate: number
  enabled: boolean
  clarityThreshold?: number
  powerThreshold?: number
  /** Instrument frequency range for post-detection filtering (Hz) */
  minFreq?: number
  maxFreq?: number
}) {
  const { analyserNode, gainNode, sampleRate, enabled, clarityThreshold = 0.4, powerThreshold = 2.0, minFreq, maxFreq } = options

  const [result, setResult] = useState<PitchDetectionResult>({
    pitch: null,
    noteResult: null,
    currentGain: 1.0,
  })

  const detectorRef = useRef<TypedPitchDetector | null>(null)
  const agcRef = useRef<AutoGainControl | null>(null)
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rafRef = useRef<number>(0)

  const startDetection = useCallback(() => {
    if (!analyserNode) return

    const bufferSize = analyserNode.fftSize
    detectorRef.current = new TypedPitchDetector(sampleRate, bufferSize)
    detectorRef.current.setClarityThreshold(clarityThreshold)
    detectorRef.current.setPowerThreshold(powerThreshold)
    if (minFreq != null && maxFreq != null) {
      detectorRef.current.setFrequencyRange(minFreq, maxFreq)
    }
    agcRef.current = new AutoGainControl()
    bufferRef.current = new Float32Array(new ArrayBuffer(bufferSize * 4))

    const tick = () => {
      if (!analyserNode || !detectorRef.current || !bufferRef.current) return

      analyserNode.getFloatTimeDomainData(bufferRef.current)

      // AGC: adjust gain based on post-gain signal level
      if (agcRef.current && gainNode) {
        const newGain = agcRef.current.update(bufferRef.current)
        gainNode.gain.value = newGain
      }

      const pitch = detectorRef.current.detect(bufferRef.current)
      const gain = agcRef.current?.currentGain ?? 1.0

      if (pitch && pitch.clarity >= clarityThreshold) {
        const noteResult = frequencyToNote(pitch.frequency)
        setResult({ pitch, noteResult, currentGain: gain })
      } else {
        setResult({ pitch: null, noteResult: null, currentGain: gain })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [analyserNode, gainNode, sampleRate, clarityThreshold, powerThreshold, minFreq, maxFreq])

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (detectorRef.current) {
      detectorRef.current.free()
      detectorRef.current = null
    }
    agcRef.current = null
    bufferRef.current = null
    setResult({ pitch: null, noteResult: null, currentGain: 1.0 })
  }, [])

  useEffect(() => {
    if (enabled && analyserNode) {
      startDetection()
    } else {
      // Defer the state reset to avoid synchronous setState in effect body
      queueMicrotask(() => stopDetection())
    }

    return () => {
      stopDetection()
    }
  }, [enabled, analyserNode, startDetection, stopDetection])

  return result
}
