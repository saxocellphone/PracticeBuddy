import { useState, useCallback, useEffect, useRef } from 'react'
import { useWasm } from '@hooks/useWasm.ts'
import { useAudioEngine } from '@hooks/useAudioEngine.ts'
import { usePitchDetection } from '@hooks/usePitchDetection.ts'
import { useMetronome } from '@hooks/useMetronome.ts'
import { useScaleSelection } from '@hooks/useScaleSelection.ts'
import { useEndlessPractice } from '@hooks/useEndlessPractice.ts'
import { AppShell } from '@components/layout/AppShell.tsx'
import { MetronomeControls } from '@components/metronome/MetronomeControls.tsx'
import { PracticeView } from '@components/practice-view/PracticeView.tsx'
import { EndlessResults } from '@components/session-results/EndlessResults.tsx'
import { PitchLeniency } from '@components/common/PitchLeniency.tsx'
import { AdvancedSettings } from '@components/common/AdvancedSettings.tsx'
import { HomePage } from '@components/home/HomePage.tsx'
import type { PracticeMode } from '@components/home/HomePage.tsx'
import { EndlessSetup } from '@components/endless-setup/EndlessSetup.tsx'
import { EndlessBanner } from '@components/practice-view/EndlessBanner.tsx'
import type { ScaleSequence } from '@core/endless/types.ts'

type AppView = 'home' | 'setup' | 'practicing' | 'results'

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
  ignoreOctave: boolean
}

const DEFAULT_SETTINGS: PersistedSettings = {
  bpm: 120,
  metronomeEnabled: true,
  centsTolerance: 40,
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
      ignoreOctave: typeof parsed.ignoreOctave === 'boolean' ? parsed.ignoreOctave : DEFAULT_SETTINGS.ignoreOctave,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function MainApp() {
  const saved = useRef(loadSettings()).current
  const [view, setView] = useState<AppView>('home')
  const [useMetronomeEnabled, setUseMetronomeEnabled] = useState(saved.metronomeEnabled)
  const [centsTolerance, setCentsTolerance] = useState(saved.centsTolerance)
  const [ignoreOctave, setIgnoreOctave] = useState(saved.ignoreOctave)

  const [metronomeExpanded, setMetronomeExpanded] = useState(false)

  // Track the last completed score for transition display
  const [lastCompletedScore, setLastCompletedScore] = useState<import('@core/wasm/types.ts').SessionScore | null>(null)

  // Audio engine
  const audio = useAudioEngine()

  // Scale selection (for available scales list)
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
      ignoreOctave,
    }))
  }, [metronome.bpm, useMetronomeEnabled, centsTolerance, ignoreOctave])

  // Scale practice (endless mode)
  const endless = useEndlessPractice()

  // Feed pitch detection into the session
  useEffect(() => {
    if (view !== 'practicing' || !pitchResult.pitch) return
    if (endless.innerSessionState?.phase === 'Playing') {
      endless.processFrame(pitchResult.pitch)
    }
  }, [view, pitchResult.pitch, endless.innerSessionState?.phase, endless.processFrame])

  // Track transition scores for the banner display
  useEffect(() => {
    if (endless.endlessState?.phase === 'transitioning' && endless.endlessState.results.length > 0) {
      const lastResult = endless.endlessState.results[endless.endlessState.results.length - 1]
      setLastCompletedScore(lastResult.score)
    }
  }, [endless.endlessState?.phase, endless.endlessState?.results.length])

  // Auto-transition to results when user stops
  useEffect(() => {
    if (endless.endlessState?.phase === 'stopped') {
      if (useMetronomeEnabled) {
        metronome.stop()
      }
      setView('results')
    }
  }, [endless.endlessState?.phase, useMetronomeEnabled, metronome.stop])

  // ---- Navigation ----

  const handleGoHome = useCallback(() => {
    endless.stopEndless()
    metronome.stop()
    setLastCompletedScore(null)
    setView('home')
  }, [endless.stopEndless, metronome.stop])

  const handleSelectMode = useCallback((_mode: PracticeMode) => {
    setView('setup')
  }, [])

  // ---- Scale Practice Handlers ----

  const endlessSequenceRef = useRef<ScaleSequence | null>(null)

  const handleStartPractice = useCallback(async (sequence: ScaleSequence) => {
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

  const handleStopPractice = useCallback(() => {
    endless.stopEndless()
    metronome.stop()
  }, [endless.stopEndless, metronome.stop])

  const handleRetry = useCallback(() => {
    if (!endlessSequenceRef.current) return
    setLastCompletedScore(null)
    endless.startEndless(endlessSequenceRef.current, centsTolerance, 3, ignoreOctave)

    if (useMetronomeEnabled) {
      metronome.start()
    }

    setView('practicing')
  }, [endless.startEndless, centsTolerance, ignoreOctave, useMetronomeEnabled, metronome.start])

  const handleMetronomeToggle = useCallback(() => {
    if (metronome.isPlaying) {
      metronome.stop()
    } else {
      if (audio.state === 'uninitialized') {
        audio.initialize().then(() => metronome.start())
      } else {
        metronome.start()
      }
    }
  }, [metronome.isPlaying, metronome.stop, metronome.start, audio])

  // Build the settings slot for the setup config panel
  const setupSettingsSlot = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Compact single-row metronome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '44px' }}>
        <input
          type="checkbox"
          checked={useMetronomeEnabled}
          onChange={(e) => setUseMetronomeEnabled(e.target.checked)}
          style={{ accentColor: 'var(--color-accent)', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
          Metronome
        </span>
        {useMetronomeEnabled && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {metronome.bpm} BPM
          </span>
        )}
        <button
          onClick={() => setMetronomeExpanded(e => !e)}
          style={{
            width: '28px', height: '28px', borderRadius: '14px',
            border: '1px solid var(--color-border)', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)', fontSize: '16px', lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Expand metronome settings"
        >
          {metronomeExpanded ? '\u2212' : '+'}
        </button>
      </div>

      {/* Collapsible BPM + Advanced */}
      <div style={{
        overflow: 'hidden',
        maxHeight: metronomeExpanded ? '300px' : '0',
        transition: 'max-height 240ms ease',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {useMetronomeEnabled && (
          <MetronomeControls
            bpm={metronome.bpm}
            isPlaying={metronome.isPlaying}
            currentBeat={metronome.currentBeat}
            beatsPerMeasure={metronome.beatsPerMeasure}
            onBpmChange={metronome.setBpm}
            onToggle={handleMetronomeToggle}
          />
        )}
        <AdvancedSettings>
          <PitchLeniency
            centsTolerance={centsTolerance}
            onCentsToleranceChange={setCentsTolerance}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ignoreOctave}
              onChange={(e) => setIgnoreOctave(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            Accept any octave (ignore octave matching)
          </label>
        </AdvancedSettings>
      </div>
    </div>
  )

  return (
    <AppShell
      onGoHome={view !== 'home' ? handleGoHome : undefined}
      onBack={view !== 'home' ? handleGoHome : undefined}
    >
      {view === 'home' && (
        <HomePage onSelectMode={handleSelectMode} />
      )}

      {view === 'setup' && (
        <div style={{ padding: 'var(--space-xl)', width: '100%', boxSizing: 'border-box' }}>
          <EndlessSetup
            availableScales={scale.availableScales}
            onStartSequence={handleStartPractice}
            settingsSlot={setupSettingsSlot}
          />
        </div>
      )}

      {view === 'practicing' && (
        <>
          {endless.endlessState && (
            <EndlessBanner
              endlessState={endless.endlessState}
              lastCompletedScore={lastCompletedScore}
            />
          )}

          {endless.innerSessionState && endless.endlessState?.phase !== 'transitioning' && (
            <PracticeView
              scaleNotes={endless.endlessState?.currentScaleNotes ?? []}
              sessionState={endless.innerSessionState}
              detectedPitch={pitchResult.pitch}
              noteResult={pitchResult.noteResult}
              onSkipNote={endless.skipNote}
              ignoreOctave={ignoreOctave}
            />
          )}

          {useMetronomeEnabled && endless.endlessState?.phase !== 'transitioning' && (
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
              onClick={handleStopPractice}
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

      {view === 'results' && endless.endlessState && (
        <EndlessResults
          endlessState={endless.endlessState}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
        />
      )}
    </AppShell>
  )
}

export default App
