import { useState, useRef, useCallback, useEffect } from 'react'
import { TypedPracticeSession } from '@core/wasm/session.ts'
import type {
  SessionConfig,
  SessionState,
  SessionScore,
  DetectedPitch,
} from '@core/wasm/types.ts'

export function usePracticeSession() {
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [score, setScore] = useState<SessionScore | null>(null)
  const sessionRef = useRef<TypedPracticeSession | null>(null)

  const startSession = useCallback((config: SessionConfig) => {
    // Clean up any existing session
    if (sessionRef.current) {
      sessionRef.current.free()
    }

    const session = new TypedPracticeSession()
    sessionRef.current = session

    const state = session.start(config)
    setSessionState(state)
    setScore(null)
  }, [])

  const processFrame = useCallback(
    (pitch: DetectedPitch) => {
      // sessionRef is used instead of sessionState to keep this callback
      // stable (no state dependency). The WASM process_frame already
      // guards on phase !== Playing internally.
      if (!sessionRef.current) return

      const newState = sessionRef.current.processFrame(
        pitch.frequency,
        pitch.clarity
      )
      setSessionState(newState)

      if (newState.phase === 'Complete') {
        const finalScore = sessionRef.current.getScore()
        setScore(finalScore)
      }
    },
    []
  )

  const skipNote = useCallback(() => {
    if (!sessionRef.current) return

    const newState = sessionRef.current.skipNote()
    setSessionState(newState)

    if (newState.phase === 'Complete') {
      const finalScore = sessionRef.current.getScore()
      setScore(finalScore)
    }
  }, [])

  const resetSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.free()
      sessionRef.current = null
    }
    setSessionState(null)
    setScore(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.free()
      }
    }
  }, [])

  return {
    sessionState,
    score,
    startSession,
    processFrame,
    skipNote,
    resetSession,
  }
}
