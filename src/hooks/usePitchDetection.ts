import { useState, useRef, useCallback, useEffect } from 'react'
import { TypedPitchDetector } from '@core/wasm/pitchDetector.ts'
import { frequencyToNote } from '@core/wasm/noteUtils.ts'
import type { DetectedPitch, FrequencyToNoteResult } from '@core/wasm/types.ts'

export interface PitchDetectionResult {
  pitch: DetectedPitch | null
  noteResult: FrequencyToNoteResult | null
}

export function usePitchDetection(options: {
  analyserNode: AnalyserNode | null
  sampleRate: number
  enabled: boolean
  clarityThreshold?: number
}) {
  const { analyserNode, sampleRate, enabled, clarityThreshold = 0.55 } = options

  const [result, setResult] = useState<PitchDetectionResult>({
    pitch: null,
    noteResult: null,
  })

  const detectorRef = useRef<TypedPitchDetector | null>(null)
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rafRef = useRef<number>(0)

  const startDetection = useCallback(() => {
    if (!analyserNode) return

    const bufferSize = analyserNode.fftSize
    detectorRef.current = new TypedPitchDetector(sampleRate, bufferSize)
    detectorRef.current.setClarityThreshold(clarityThreshold)
    bufferRef.current = new Float32Array(new ArrayBuffer(bufferSize * 4))

    const tick = () => {
      if (!analyserNode || !detectorRef.current || !bufferRef.current) return

      analyserNode.getFloatTimeDomainData(bufferRef.current)
      const pitch = detectorRef.current.detect(bufferRef.current)

      if (pitch && pitch.clarity >= clarityThreshold) {
        const noteResult = frequencyToNote(pitch.frequency)
        setResult({ pitch, noteResult })
      } else {
        setResult({ pitch: null, noteResult: null })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [analyserNode, sampleRate, clarityThreshold])

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (detectorRef.current) {
      detectorRef.current.free()
      detectorRef.current = null
    }
    bufferRef.current = null
    setResult({ pitch: null, noteResult: null })
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
