import { useState, useCallback, useEffect, useRef } from 'react'
import { useWasm } from '@hooks/useWasm.ts'
import { useAudioEngine } from '@hooks/useAudioEngine.ts'
import { usePitchDetection } from '@hooks/usePitchDetection.ts'
import { useMetronome } from '@hooks/useMetronome.ts'
import { usePracticeSession } from '@hooks/usePracticeSession.ts'
import { useScaleSelection } from '@hooks/useScaleSelection.ts'
import { useEndlessPractice } from '@hooks/useEndlessPractice.ts'
import { AppShell } from '@components/layout/AppShell.tsx'
import { ScaleSelector } from '@components/scale-selector/ScaleSelector.tsx'
import { MetronomeControls } from '@components/metronome/MetronomeControls.tsx'
import { PracticeView } from '@components/practice-view/PracticeView.tsx'
import { SessionResults } from '@components/session-results/SessionResults.tsx'
import { EndlessResults } from '@components/session-results/EndlessResults.tsx'
import { PitchLeniency } from '@components/common/PitchLeniency.tsx'
import { ModeSelector } from '@components/mode-selector/ModeSelector.tsx'
import type { PracticeMode } from '@components/mode-selector/ModeSelector.tsx'
import { EndlessSetup } from '@components/endless-setup/EndlessSetup.tsx'
import { EndlessBanner } from '@components/practice-view/EndlessBanner.tsx'
import type { SessionConfig } from '@core/wasm/types.ts'
import type { ScaleSequence } from '@core/endless/types.ts'

type AppView = 'setup' | 'practicing' | 'results'

function App() {
  const wasm = useWasm()

  if (wasm.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-secondary)' }}>
        Loading WASM...
      </div>
    )
  }

  if (wasm.status === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-incorrect)' }}>
        Failed to load WASM: {wasm.error?.message}
      </div>
    )
  }

  return <MainApp />
}

const SETTINGS_KEY = 'practicebuddy:settings'

interface PersistedSettings {
  bpm: number
  metronomeEnabled: boolean
  centsTolerance: number
  practiceMode: PracticeMode
  ignoreOctave: boolean
}

const DEFAULT_SETTINGS: PersistedSettings = {
  bpm: 120,
  metronomeEnabled: true,
  centsTolerance: 40,
  practiceMode: 'single',
  ignoreOctave: true,
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      bpm: typeof parsed.bpm === 'number' && parsed.bpm >= 30 && parsed.bpm <= 300 ? parsed.bpm : DEFAULT_SETTINGS.bpm,
      metronomeEnabled: typeof parsed.metronomeEnabled === 'boolean' ? parsed.metronomeEnabled : DEFAULT_SETTINGS.metronomeEnabled,
      centsTolerance: typeof parsed.centsTolerance === 'number' && parsed.centsTolerance >= 10 && parsed.centsTolerance <= 100 ? parsed.centsTolerance : DEFAULT_SETTINGS.centsTolerance,
      practiceMode: parsed.practiceMode === 'single' || parsed.practiceMode === 'endless' ? parsed.practiceMode : DEFAULT_SETTINGS.practiceMode,
      ignoreOctave: typeof parsed.ignoreOctave === 'boolean' ? parsed.ignoreOctave : DEFAULT_SETTINGS.ignoreOctave,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function MainApp() {
  const saved = useRef(loadSettings()).current
  const [view, setView] = useState<AppView>('setup')
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(saved.practiceMode)
  const [useMetronomeEnabled, setUseMetronomeEnabled] = useState(saved.metronomeEnabled)
  const [centsTolerance, setCentsTolerance] = useState(saved.centsTolerance)
  const [ignoreOctave, setIgnoreOctave] = useState(saved.ignoreOctave)

  // Track the last completed score for transition display
  const [lastCompletedScore, setLastCompletedScore] = useState<import('@core/wasm/types.ts').SessionScore | null>(null)

  // Audio engine
  const audio = useAudioEngine()

  // Scale selection (for single mode)
  const scale = useScaleSelection()

  // Pitch detection
  const pitchResult = usePitchDetection({
    analyserNode: audio.analyserNode,
    sampleRate: audio.sampleRate,
    enabled: view === 'practicing',
  })

  // Metronome
  const metronome = useMetronome(audio.audioContext)

  // Initialize BPM from saved settings
  const bpmInitialized = useRef(false)
  useEffect(() => {
    if (!bpmInitialized.current && saved.bpm !== 120) {
      metronome.setBpm(saved.bpm)
      bpmInitialized.current = true
    }
  }, [saved.bpm, metronome.setBpm])

  // Persist settings on change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      bpm: metronome.bpm,
      metronomeEnabled: useMetronomeEnabled,
      centsTolerance,
      practiceMode,
      ignoreOctave,
    }))
  }, [metronome.bpm, useMetronomeEnabled, centsTolerance, practiceMode, ignoreOctave])

  // Single-mode practice session
  const session = usePracticeSession()

  // Endless-mode practice
  const endless = useEndlessPractice()

  // Feed pitch detection into the active session
  useEffect(() => {
    if (view !== 'practicing' || !pitchResult.pitch) return

    if (practiceMode === 'single' && session.sessionState?.phase === 'Playing') {
      session.processFrame(pitchResult.pitch)
    } else if (practiceMode === 'endless' && endless.innerSessionState?.phase === 'Playing') {
      endless.processFrame(pitchResult.pitch)
    }
  }, [view, practiceMode, pitchResult.pitch, session.sessionState?.phase, session.processFrame, endless.innerSessionState?.phase, endless.processFrame])

  // Auto-transition to results when single-mode session completes
  useEffect(() => {
    if (practiceMode !== 'single') return
    if (session.sessionState?.phase === 'Complete' && session.score) {
      if (useMetronomeEnabled) {
        metronome.stop()
      }
      setView('results')
    }
  }, [practiceMode, session.sessionState?.phase, session.score, useMetronomeEnabled, metronome.stop])

  // Track endless transition scores for the banner display
  useEffect(() => {
    if (practiceMode !== 'endless') return
    if (endless.endlessState?.phase === 'transitioning' && endless.endlessState.results.length > 0) {
      const lastResult = endless.endlessState.results[endless.endlessState.results.length - 1]
      setLastCompletedScore(lastResult.score)
    }
  }, [practiceMode, endless.endlessState?.phase, endless.endlessState?.results.length])

  // Auto-transition to results when user stops endless mode
  useEffect(() => {
    if (practiceMode !== 'endless') return
    if (endless.endlessState?.phase === 'stopped') {
      if (useMetronomeEnabled) {
        metronome.stop()
      }
      setView('results')
    }
  }, [practiceMode, endless.endlessState?.phase, useMetronomeEnabled, metronome.stop])

  // ---- Single Mode Handlers ----

  const handleStartPractice = useCallback(async () => {
    if (audio.state === 'uninitialized') {
      await audio.initialize()
    }

    const config: SessionConfig = {
      scaleNotes: scale.scaleNotes,
      centsTolerance,
      minHoldDetections: 3,
      ignoreOctave,
    }

    session.startSession(config)

    if (useMetronomeEnabled) {
      metronome.start()
    }

    setView('practicing')
  }, [audio, scale.scaleNotes, session.startSession, useMetronomeEnabled, metronome.start, centsTolerance, ignoreOctave])

  const handleRetry = useCallback(() => {
    setView('practicing')

    const config: SessionConfig = {
      scaleNotes: scale.scaleNotes,
      centsTolerance,
      minHoldDetections: 3,
      ignoreOctave,
    }
    session.startSession(config)

    if (useMetronomeEnabled) {
      metronome.start()
    }
  }, [scale.scaleNotes, session.startSession, useMetronomeEnabled, metronome.start, centsTolerance, ignoreOctave])

  const handleChangeScale = useCallback(() => {
    session.resetSession()
    metronome.stop()
    setView('setup')
  }, [session.resetSession, metronome.stop])

  const handleStopPractice = useCallback(() => {
    session.resetSession()
    metronome.stop()
    setView('setup')
  }, [session.resetSession, metronome.stop])

  // ---- Endless Mode Handlers ----

  // Store the current sequence for retry
  const endlessSequenceRef = useRef<ScaleSequence | null>(null)

  const handleStartEndless = useCallback(async (sequence: ScaleSequence) => {
    if (audio.state === 'uninitialized') {
      await audio.initialize()
    }

    endlessSequenceRef.current = sequence
    setLastCompletedScore(null)
    endless.startEndless(sequence, centsTolerance, 3, ignoreOctave)

    if (useMetronomeEnabled) {
      metronome.start()
    }

    setView('practicing')
  }, [audio, endless.startEndless, centsTolerance, ignoreOctave, useMetronomeEnabled, metronome.start])

  const handleStopEndless = useCallback(() => {
    endless.stopEndless()
    metronome.stop()
    // View will transition to 'results' via the useEffect watching for 'stopped' phase
  }, [endless.stopEndless, metronome.stop])

  const handleEndlessRetry = useCallback(() => {
    if (!endlessSequenceRef.current) return
    setLastCompletedScore(null)
    endless.startEndless(endlessSequenceRef.current, centsTolerance, 3, ignoreOctave)

    if (useMetronomeEnabled) {
      metronome.start()
    }

    setView('practicing')
  }, [endless.startEndless, centsTolerance, ignoreOctave, useMetronomeEnabled, metronome.start])

  const handleEndlessChangeSequence = useCallback(() => {
    endless.stopEndless()
    metronome.stop()
    setView('setup')
  }, [endless.stopEndless, metronome.stop])

  const handleSwitchToSingle = useCallback(() => {
    endless.stopEndless()
    metronome.stop()
    setPracticeMode('single')
    setView('setup')
  }, [endless.stopEndless, metronome.stop])

  // Determine which session state to show in practicing view
  const isEndless = practiceMode === 'endless'
  const activeScaleNotes = isEndless
    ? endless.endlessState?.currentScaleNotes ?? []
    : scale.scaleNotes
  const activeSessionState = isEndless
    ? endless.innerSessionState
    : session.sessionState

  return (
    <AppShell>
      {view === 'setup' && (
        <div style={{ padding: 'var(--space-xl)', maxWidth: '600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          <ModeSelector mode={practiceMode} onModeChange={setPracticeMode} />

          {practiceMode === 'single' ? (
            <>
              <ScaleSelector
                pitchClasses={scale.pitchClasses}
                availableScales={scale.availableScales}
                selectedRoot={scale.selection.rootNote}
                selectedOctave={scale.selection.rootOctave}
                selectedScaleIndex={scale.selection.scaleTypeIndex}
                selectedDirection={scale.selection.direction}
                scaleNotes={scale.scaleNotes}
                selectedScaleInfo={scale.selectedScaleInfo}
                onRootChange={scale.setRootNote}
                onOctaveChange={scale.setRootOctave}
                onScaleTypeChange={scale.setScaleType}
                onDirectionChange={scale.setDirection}
              />

              <MetronomeControls
                bpm={metronome.bpm}
                isPlaying={metronome.isPlaying}
                currentBeat={metronome.currentBeat}
                beatsPerMeasure={metronome.beatsPerMeasure}
                onBpmChange={metronome.setBpm}
                onToggle={() => {
                  if (metronome.isPlaying) {
                    metronome.stop()
                  } else {
                    if (audio.state === 'uninitialized') {
                      audio.initialize().then(() => metronome.start())
                    } else {
                      metronome.start()
                    }
                  }
                }}
              />

              <PitchLeniency
                centsTolerance={centsTolerance}
                onCentsToleranceChange={setCentsTolerance}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={useMetronomeEnabled}
                  onChange={(e) => setUseMetronomeEnabled(e.target.checked)}
                />
                Use metronome during practice
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={ignoreOctave}
                  onChange={(e) => setIgnoreOctave(e.target.checked)}
                />
                Accept any octave (ignore octave matching)
              </label>

              <button
                onClick={handleStartPractice}
                disabled={scale.scaleNotes.length === 0}
                style={{
                  padding: 'var(--space-md) var(--space-xl)',
                  borderRadius: 'var(--radius-md)',
                  background: scale.scaleNotes.length > 0 ? 'var(--color-accent)' : 'var(--color-border)',
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: scale.scaleNotes.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 150ms ease',
                }}
              >
                Start Practice
              </button>
            </>
          ) : (
            <>
              <EndlessSetup
                availableScales={scale.availableScales}
                onStartSequence={handleStartEndless}
              />

              <MetronomeControls
                bpm={metronome.bpm}
                isPlaying={metronome.isPlaying}
                currentBeat={metronome.currentBeat}
                beatsPerMeasure={metronome.beatsPerMeasure}
                onBpmChange={metronome.setBpm}
                onToggle={() => {
                  if (metronome.isPlaying) {
                    metronome.stop()
                  } else {
                    if (audio.state === 'uninitialized') {
                      audio.initialize().then(() => metronome.start())
                    } else {
                      metronome.start()
                    }
                  }
                }}
              />

              <PitchLeniency
                centsTolerance={centsTolerance}
                onCentsToleranceChange={setCentsTolerance}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={useMetronomeEnabled}
                  onChange={(e) => setUseMetronomeEnabled(e.target.checked)}
                />
                Use metronome during practice
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={ignoreOctave}
                  onChange={(e) => setIgnoreOctave(e.target.checked)}
                />
                Accept any octave (ignore octave matching)
              </label>
            </>
          )}
        </div>
      )}

      {view === 'practicing' && (
        <>
          {/* Endless mode: banner or transition interstitial */}
          {isEndless && endless.endlessState && (
            <EndlessBanner
              endlessState={endless.endlessState}
              lastCompletedScore={lastCompletedScore}
            />
          )}

          {/* Practice view — only show when we have a valid session state and not in transition */}
          {activeSessionState && !(isEndless && endless.endlessState?.phase === 'transitioning') && (
            <PracticeView
              scaleNotes={activeScaleNotes}
              sessionState={activeSessionState}
              detectedPitch={pitchResult.pitch}
              noteResult={pitchResult.noteResult}
              onSkipNote={isEndless ? endless.skipNote : session.skipNote}
              ignoreOctave={ignoreOctave}
            />
          )}

          {useMetronomeEnabled && !(isEndless && endless.endlessState?.phase === 'transitioning') && (
            <div style={{ padding: '0 var(--space-xl) var(--space-md)' }}>
              <MetronomeControls
                bpm={metronome.bpm}
                isPlaying={metronome.isPlaying}
                currentBeat={metronome.currentBeat}
                beatsPerMeasure={metronome.beatsPerMeasure}
                onBpmChange={metronome.setBpm}
                onToggle={() => {
                  if (metronome.isPlaying) metronome.stop()
                  else metronome.start()
                }}
                compact
              />
            </div>
          )}
          <div style={{ padding: '0 var(--space-xl) var(--space-xl)', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={isEndless ? handleStopEndless : handleStopPractice}
              style={{
                padding: '8px 24px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Stop Practice
            </button>
          </div>
        </>
      )}

      {view === 'results' && (
        <>
          {practiceMode === 'single' && session.score && (
            <SessionResults
              score={session.score}
              onRetry={handleRetry}
              onChangeScale={handleChangeScale}
            />
          )}
          {practiceMode === 'endless' && endless.endlessState && (
            <EndlessResults
              endlessState={endless.endlessState}
              onRetry={handleEndlessRetry}
              onChangeSequence={handleEndlessChangeSequence}
              onSwitchToSingle={handleSwitchToSingle}
            />
          )}
        </>
      )}
    </AppShell>
  )
}

export default App
