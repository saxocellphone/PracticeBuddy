import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { loadNotationFont } from '@core/notation/font.ts'
import { useWasm } from '@hooks/useWasm.ts'
import { useAudioEngine } from '@hooks/useAudioEngine.ts'
import { usePitchDetection } from '@hooks/usePitchDetection.ts'
import { useMetronome } from '@hooks/useMetronome.ts'
import { useScaleSelection } from '@hooks/useScaleSelection.ts'
import { useEndlessPractice } from '@hooks/useEndlessPractice.ts'
import { useRhythmPractice } from '@hooks/useRhythmPractice.ts'
import { useArpeggioPractice } from '@hooks/useArpeggioPractice.ts'
import { AppShell } from '@components/layout/AppShell.tsx'
import { MetronomeControls } from '@components/metronome/MetronomeControls.tsx'
import { PracticeView } from '@components/practice-view/PracticeView.tsx'
import { EndlessResults } from '@components/session-results/EndlessResults.tsx'
import { RhythmPracticeView } from '@components/rhythm-practice/RhythmPracticeView.tsx'
import { RhythmResults } from '@components/rhythm-results/RhythmResults.tsx'
import { PitchLeniency } from '@components/common/PitchLeniency.tsx'
import { AdvancedSettings } from '@components/common/AdvancedSettings.tsx'
import { NoteDurationPicker } from '@components/common/NoteDurationPicker.tsx'
import { HomePage } from '@components/home/HomePage.tsx'
import type { PracticeMode, TimingMode } from '@components/home/HomePage.tsx'
import { EndlessSetup } from '@components/endless-setup/EndlessSetup.tsx'
import { EndlessBanner } from '@components/practice-view/EndlessBanner.tsx'
import { ArpeggioSetup } from '@components/arpeggio-setup/ArpeggioSetup.tsx'
import { ArpeggioPracticeView } from '@components/arpeggio-practice/ArpeggioPracticeView.tsx'
import { ArpeggioResults } from '@components/arpeggio-results/ArpeggioResults.tsx'
import type { ScaleSequence } from '@core/endless/types.ts'
import type { ArpeggioSequence } from '@core/arpeggio/types.ts'
import { buildAllArpeggioStepsNotes, arpeggioToScaleSequence, expandArpeggioSequence } from '@core/arpeggio/sequence.ts'
import {
  RHYTHM_DURATION_STORAGE_KEY,
} from '@core/rhythm/types.ts'
import type { NoteDuration } from '@core/rhythm/types.ts'

type AppView = 'home' | 'setup' | 'practicing' | 'results'

function App() {
  // Load the Bravura music notation font as early as possible
  useEffect(() => { loadNotationFont() }, [])

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
  timingMode: TimingMode
}

const DEFAULT_SETTINGS: PersistedSettings = {
  bpm: 120,
  metronomeEnabled: true,
  centsTolerance: 40,
  ignoreOctave: true,
  timingMode: 'follow',
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
      timingMode: parsed.timingMode === 'follow' || parsed.timingMode === 'rhythm' ? parsed.timingMode : DEFAULT_SETTINGS.timingMode,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function loadNoteDuration(): NoteDuration {
  try {
    const raw = localStorage.getItem(RHYTHM_DURATION_STORAGE_KEY)
    if (raw && ['whole', 'half', 'quarter', 'eighth', 'sixteenth'].includes(raw)) {
      return raw as NoteDuration
    }
  } catch { /* ignore */ }
  return 'quarter'
}

function MainApp() {
  // Load persisted settings once on mount (lazy initializer runs only on first render)
  const [saved] = useState(loadSettings)
  const [view, setView] = useState<AppView>('home')
  const [activeMode, setActiveMode] = useState<PracticeMode>('scales')
  const [useMetronomeEnabled, setUseMetronomeEnabled] = useState(saved.metronomeEnabled)
  const [centsTolerance, setCentsTolerance] = useState(saved.centsTolerance)
  const [ignoreOctave, setIgnoreOctave] = useState(saved.ignoreOctave)

  // Rhythm mode state
  const [noteDuration, setNoteDuration] = useState<NoteDuration>(loadNoteDuration)

  // Timing mode: follow (self-paced) or rhythm (beat-synced) — applies to all content types
  const [timingMode, setTimingMode] = useState<TimingMode>(saved.timingMode)

  const [metronomeExpanded, setMetronomeExpanded] = useState(false)

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
  const metronome = useMetronome(audio.audioContext, saved.bpm)

  // Persist settings on change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      bpm: metronome.bpm,
      metronomeEnabled: useMetronomeEnabled,
      centsTolerance,
      ignoreOctave,
      timingMode,
    }))
  }, [metronome.bpm, useMetronomeEnabled, centsTolerance, ignoreOctave, timingMode])

  // Persist rhythm settings
  useEffect(() => {
    localStorage.setItem(RHYTHM_DURATION_STORAGE_KEY, noteDuration)
  }, [noteDuration])

  // Scale practice (endless mode)
  const {
    endlessState, innerSessionState, startEndless, stopEndless,
    processFrame: endlessProcessFrame, skipNote,
  } = useEndlessPractice()

  // Derive the last completed score for transition display (no state needed)
  const lastCompletedScore = useMemo(() => {
    if (endlessState?.phase === 'transitioning' && endlessState.results.length > 0) {
      return endlessState.results[endlessState.results.length - 1].score
    }
    return null
  }, [endlessState?.phase, endlessState?.results])

  // Rhythm practice mode
  const {
    rhythmState, sessionState: rhythmSessionState, startRhythm, stopRhythm,
    processFrame: rhythmProcessFrame,
  } = useRhythmPractice({ audioContext: audio.audioContext, onBeatSubscribe: metronome.onBeat })

  // Arpeggio practice mode
  const {
    arpeggioState, sessionState: arpeggioSessionState, startArpeggio, stopArpeggio,
    processArpeggioFrame, skipArpeggio,
  } = useArpeggioPractice()

  // Feed pitch detection into scales (follow mode)
  useEffect(() => {
    if (view !== 'practicing' || !pitchResult.pitch) return
    if (activeMode !== 'scales' || timingMode !== 'follow') return
    if (innerSessionState?.phase === 'Playing') {
      endlessProcessFrame(pitchResult.pitch)
    }
  }, [view, pitchResult.pitch, innerSessionState?.phase, endlessProcessFrame, activeMode, timingMode])

  // Feed pitch detection into arpeggios (follow mode)
  useEffect(() => {
    if (view !== 'practicing' || !pitchResult.pitch) return
    if (activeMode !== 'arpeggios' || timingMode !== 'follow') return
    if (arpeggioSessionState?.phase === 'Playing') {
      processArpeggioFrame(pitchResult.pitch)
    }
  }, [view, pitchResult.pitch, arpeggioSessionState?.phase, processArpeggioFrame, activeMode, timingMode])

  // Feed pitch detection into rhythm mode (any content type)
  useEffect(() => {
    if (view !== 'practicing' || !pitchResult.pitch || timingMode !== 'rhythm') return
    if (rhythmSessionState?.phase === 'playing') {
      rhythmProcessFrame(pitchResult.pitch)
    }
  }, [view, pitchResult.pitch, rhythmSessionState?.phase, rhythmProcessFrame, timingMode])

  // Destructure stable functions from hooks so dependency arrays are precise
  const { stop: metronomeStop, start: metronomeStart, isPlaying: metronomeIsPlaying, bpm } = metronome
  const { state: audioState, initialize: audioInitialize, audioContext: audioCtx } = audio

  // Auto-transition to results when stopped (scales follow mode)
  // Guard on view === 'practicing' so manual navigation (back to setup) isn't overridden.
  useEffect(() => {
    if (view !== 'practicing') return
    if (activeMode !== 'scales' || timingMode !== 'follow') return
    if (endlessState?.phase === 'stopped') {
      if (useMetronomeEnabled) metronomeStop()
      queueMicrotask(() => setView('results'))
    }
  }, [view, endlessState?.phase, useMetronomeEnabled, metronomeStop, activeMode, timingMode])

  // Auto-transition to results when stopped (arpeggios follow mode)
  useEffect(() => {
    if (view !== 'practicing') return
    if (activeMode !== 'arpeggios' || timingMode !== 'follow') return
    if (arpeggioState?.phase === 'stopped') {
      if (useMetronomeEnabled) metronomeStop()
      queueMicrotask(() => setView('results'))
    }
  }, [view, arpeggioState?.phase, useMetronomeEnabled, metronomeStop, activeMode, timingMode])

  // Auto-transition to results when stopped (rhythm mode, any content type)
  useEffect(() => {
    if (view !== 'practicing') return
    if (timingMode !== 'rhythm') return
    if (rhythmState?.phase === 'stopped') {
      metronomeStop()
      queueMicrotask(() => setView('results'))
    }
  }, [view, rhythmState?.phase, metronomeStop, timingMode])

  // ---- Navigation ----

  const handleGoHome = useCallback(() => {
    stopEndless()
    stopRhythm()
    stopArpeggio()
    metronomeStop()
    setView('home')
  }, [stopEndless, stopRhythm, stopArpeggio, metronomeStop])

  const handleBackToSetup = useCallback(() => {
    stopEndless()
    stopRhythm()
    stopArpeggio()
    metronomeStop()
    setView('setup')
  }, [stopEndless, stopRhythm, stopArpeggio, metronomeStop])

  const handleSelectMode = useCallback((mode: PracticeMode, timing: TimingMode) => {
    setActiveMode(mode)
    setTimingMode(timing)
    setView('setup')
  }, [])

  // ---- Scale Practice Handlers ----

  const endlessSequenceRef = useRef<ScaleSequence | null>(null)
  const arpeggioSequenceRef = useRef<ArpeggioSequence | null>(null)

  const handleStartPractice = useCallback(async (sequence: ScaleSequence) => {
    if (audioState === 'uninitialized') {
      await audioInitialize()
    }

    endlessSequenceRef.current = sequence
    startEndless(sequence, centsTolerance, 3, ignoreOctave)

    if (useMetronomeEnabled) {
      metronomeStart()
    }

    setView('practicing')
  }, [audioState, audioInitialize, startEndless, centsTolerance, ignoreOctave, useMetronomeEnabled, metronomeStart])

  const handleStopPractice = useCallback(() => {
    if (timingMode === 'rhythm') {
      stopRhythm()
    } else if (activeMode === 'arpeggios') {
      stopArpeggio()
    } else {
      stopEndless()
    }
    metronomeStop()
  }, [activeMode, timingMode, stopEndless, stopRhythm, stopArpeggio, metronomeStop])

  const handleRetry = useCallback(() => {
    if (timingMode === 'rhythm') {
      // Rhythm retry — works for both scales and arpeggios
      if (activeMode === 'arpeggios') {
        if (!arpeggioSequenceRef.current) return
        const expanded = expandArpeggioSequence(arpeggioSequenceRef.current)
        const prebuiltNotes = buildAllArpeggioStepsNotes(expanded, ignoreOctave)
        const adaptedSequence = arpeggioToScaleSequence(expanded, ignoreOctave)
        endlessSequenceRef.current = adaptedSequence
        metronomeStop()
        startRhythm(adaptedSequence, bpm, noteDuration, centsTolerance, ignoreOctave, audioCtx ?? undefined, prebuiltNotes)
        metronomeStart()
      } else {
        if (!endlessSequenceRef.current) return
        metronomeStop()
        startRhythm(endlessSequenceRef.current, bpm, noteDuration, centsTolerance, ignoreOctave, audioCtx ?? undefined)
        metronomeStart()
      }
      setView('practicing')
      return
    }

    // Follow retry
    if (activeMode === 'arpeggios') {
      if (!arpeggioSequenceRef.current) return
      startArpeggio(arpeggioSequenceRef.current, centsTolerance, 3, ignoreOctave)
      if (useMetronomeEnabled) metronomeStart()
      setView('practicing')
      return
    }

    if (!endlessSequenceRef.current) return
    startEndless(endlessSequenceRef.current, centsTolerance, 3, ignoreOctave)
    if (useMetronomeEnabled) metronomeStart()
    setView('practicing')
  }, [activeMode, timingMode, startEndless, startRhythm, startArpeggio, centsTolerance, ignoreOctave, useMetronomeEnabled, metronomeStart, metronomeStop, bpm, noteDuration, audioCtx])

  // Rhythm-specific start handler
  const handleStartRhythmPractice = useCallback(async (sequence: ScaleSequence) => {
    // Ensure the audio engine is initialised and grab the AudioContext
    // directly from the return value.  We cannot rely on `audio.audioContext`
    // (React state) because the state update from initialize() hasn't been
    // committed to a render yet at this point in the async callback.
    let ctx = audioCtx
    if (audioState === 'uninitialized') {
      ctx = await audioInitialize()
    }

    if (!ctx) return

    endlessSequenceRef.current = sequence
    metronomeStop()
    startRhythm(
      sequence,
      bpm,
      noteDuration,
      centsTolerance,
      ignoreOctave,
      ctx,
    )
    metronomeStart()
    setView('practicing')
  }, [audioCtx, audioState, audioInitialize, startRhythm, bpm, metronomeStop, metronomeStart, noteDuration, centsTolerance, ignoreOctave])

  // Arpeggio-specific start handler
  const handleStartArpeggioPractice = useCallback(async (sequence: ArpeggioSequence) => {
    let ctx = audioCtx
    if (audioState === 'uninitialized') {
      ctx = await audioInitialize()
    }

    arpeggioSequenceRef.current = sequence

    if (timingMode === 'rhythm') {
      if (!ctx) return
      // Expand single-step sequences to include all transpositions
      const expanded = expandArpeggioSequence(sequence)
      const prebuiltNotes = buildAllArpeggioStepsNotes(expanded, ignoreOctave)
      const adaptedSequence = arpeggioToScaleSequence(expanded, ignoreOctave)
      endlessSequenceRef.current = adaptedSequence
      metronomeStop()
      startRhythm(adaptedSequence, bpm, noteDuration, centsTolerance, ignoreOctave, ctx, prebuiltNotes)
      metronomeStart()
    } else {
      startArpeggio(sequence, centsTolerance, 3, ignoreOctave)
      if (useMetronomeEnabled) metronomeStart()
    }

    setView('practicing')
  }, [audioCtx, audioState, audioInitialize, startArpeggio, startRhythm, timingMode, centsTolerance, ignoreOctave, useMetronomeEnabled, metronomeStart, metronomeStop, bpm, noteDuration])

  const handleMetronomeToggle = useCallback(() => {
    if (metronomeIsPlaying) {
      metronomeStop()
    } else {
      if (audioState === 'uninitialized') {
        audioInitialize().then(() => metronomeStart())
      } else {
        metronomeStart()
      }
    }
  }, [metronomeIsPlaying, metronomeStop, metronomeStart, audioState, audioInitialize])

  // Build the settings slot for the setup config panel
  const isRhythmMode = timingMode === 'rhythm'
  const setupSettingsSlot = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isRhythmMode ? (
        <>
          {/* Rhythm mode: always show metronome + note duration */}
          <MetronomeControls
            bpm={metronome.bpm}
            isPlaying={metronome.isPlaying}
            currentBeat={metronome.currentBeat}
            beatsPerMeasure={metronome.beatsPerMeasure}
            onBpmChange={metronome.setBpm}
            onToggle={handleMetronomeToggle}
          />
          <NoteDurationPicker
            value={noteDuration}
            onChange={setNoteDuration}
            bpm={metronome.bpm}
          />
        </>
      ) : (
        <>
          {/* Scale mode: collapsible metronome */}
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
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {metronome.bpm} BPM
            </span>
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
          <div style={{
            overflow: 'hidden',
            maxHeight: metronomeExpanded ? '200px' : '0',
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
          </div>
        </>
      )}

      {/* Advanced Settings — always its own section */}
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
  )

  return (
    <AppShell
      onGoHome={view !== 'home' ? handleGoHome : undefined}
      onBack={
        view === 'setup' ? handleGoHome :
        view === 'practicing' || view === 'results' ? handleBackToSetup :
        undefined
      }
      backLabel={
        view === 'setup' ? 'Home' :
        view === 'practicing' || view === 'results' ? 'Back' :
        undefined
      }
    >
      {view === 'home' && (
        <HomePage onSelectMode={handleSelectMode} />
      )}

      {view === 'setup' && activeMode === 'scales' && (
        <div style={{ padding: 'var(--space-xl)', width: '100%', boxSizing: 'border-box' }}>
          <EndlessSetup
            availableScales={scale.availableScales}
            onStartSequence={isRhythmMode ? handleStartRhythmPractice : handleStartPractice}
            settingsSlot={setupSettingsSlot}
            hideSkipTransition={isRhythmMode}
            noteDuration={isRhythmMode ? noteDuration : undefined}
          />
        </div>
      )}

      {view === 'setup' && activeMode === 'arpeggios' && (
        <div style={{ padding: 'var(--space-xl)', width: '100%', boxSizing: 'border-box' }}>
          <ArpeggioSetup
            onStart={handleStartArpeggioPractice}
            settingsSlot={setupSettingsSlot}
          />
        </div>
      )}

      {/* Practicing: scales follow mode */}
      {view === 'practicing' && activeMode === 'scales' && timingMode === 'follow' && (
        <>
          {endlessState && (
            <EndlessBanner
              endlessState={endlessState}
              lastCompletedScore={lastCompletedScore}
            />
          )}

          {innerSessionState && endlessState?.phase !== 'transitioning' && (
            <PracticeView
              scaleNotes={endlessState?.currentScaleNotes ?? []}
              sessionState={innerSessionState}
              detectedPitch={pitchResult.pitch}
              noteResult={pitchResult.noteResult}
              onSkipNote={skipNote}
              chordSymbol={endlessState?.currentChordSymbol}
              chordSymbols={endlessState?.chordSymbols}
            />
          )}

          {useMetronomeEnabled && endlessState?.phase !== 'transitioning' && (
            <div style={{ padding: '0 var(--space-xl) var(--space-md)' }}>
              <MetronomeControls
                bpm={metronome.bpm}
                isPlaying={metronome.isPlaying}
                currentBeat={metronome.currentBeat}
                beatsPerMeasure={metronome.beatsPerMeasure}
                onBpmChange={metronome.setBpm}
                onToggle={() => {
                  if (metronome.isPlaying) metronomeStop()
                  else metronomeStart()
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

      {/* Practicing: arpeggios follow mode */}
      {view === 'practicing' && activeMode === 'arpeggios' && timingMode === 'follow' && arpeggioState && (
        <ArpeggioPracticeView
          arpeggioState={arpeggioState}
          sessionState={arpeggioSessionState}
          detectedPitch={pitchResult.pitch}
          noteResult={pitchResult.noteResult}
          onSkipNote={skipArpeggio}
          onStop={handleStopPractice}
        />
      )}

      {/* Practicing: rhythm mode (any content type) */}
      {view === 'practicing' && timingMode === 'rhythm' && rhythmSessionState && rhythmState && (
        <RhythmPracticeView
          sessionState={rhythmSessionState}
          rhythmState={rhythmState}
          detectedPitch={pitchResult.pitch}
          noteResult={pitchResult.noteResult}
          onStop={handleStopPractice}
        />
      )}

      {/* Results: scales follow mode */}
      {view === 'results' && activeMode === 'scales' && timingMode === 'follow' && endlessState && (
        <EndlessResults
          endlessState={endlessState}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
          onBackToSetup={handleBackToSetup}
        />
      )}

      {/* Results: arpeggios follow mode */}
      {view === 'results' && activeMode === 'arpeggios' && timingMode === 'follow' && arpeggioState && (
        <ArpeggioResults
          sessionState={arpeggioState}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
          onBackToSetup={handleBackToSetup}
        />
      )}

      {/* Results: rhythm mode (any content type) */}
      {view === 'results' && timingMode === 'rhythm' && rhythmState && (
        <RhythmResults
          rhythmState={rhythmState}
          onRetry={handleRetry}
          onGoHome={handleGoHome}
          onBackToSetup={handleBackToSetup}
        />
      )}
    </AppShell>
  )
}

export default App
