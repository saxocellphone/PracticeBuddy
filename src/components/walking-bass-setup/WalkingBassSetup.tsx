import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import {
  WALKING_BASS_PRESETS,
  WALKING_BASS_CATEGORIES,
} from '@core/walking-bass/presets.ts'
import type { WalkingBassPresetTemplate, WalkingBassCategory } from '@core/walking-bass/presets.ts'
import type { WalkingBassSequence, WalkingBassStep, ApproachType } from '@core/walking-bass/types.ts'
import { APPROACH_TYPE_LABELS, WALKING_BASS_PATTERNS } from '@core/walking-bass/index.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { ClefType } from '@core/instruments.ts'
import { RootNoteSelector } from '@components/common/RootNoteSelector.tsx'
import { LoopSection } from '@components/common/LoopSection.tsx'
import { WalkingBassStaffPreview } from './WalkingBassStaffPreview.tsx'
import sharedStyles from '../common/SetupLayout.module.css'
import localStyles from './WalkingBassSetup.module.css'
const styles = { ...sharedStyles, ...localStyles }

const CATEGORY_ORDER: WalkingBassCategory[] = [
  'blues',
  'ii-v-i',
  'standards',
  'technique',
]

const APPROACH_TYPES: ApproachType[] = [
  'chromatic-below',
  'chromatic-above',
  'diatonic',
  'dominant',
]

interface WalkingBassSetupProps {
  onStart: (sequence: WalkingBassSequence) => void
  settingsSlot?: ReactNode
  defaultOctave?: number
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
  startButtonLabel?: string
}

const WALKING_BASS_SETUP_KEY = 'practicebuddy:walking-bass:setup'

interface WalkingBassSetupState {
  selectedPresetId: string | null
  rootKey: string
  patternId: string | null
  approachType: ApproachType
  shiftSemitones: number
  loopCount: number
  shiftUntilKey: string
}

function loadSetup(): Partial<WalkingBassSetupState> {
  try {
    const raw = localStorage.getItem(WALKING_BASS_SETUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function WalkingBassSetup({ onStart, settingsSlot, defaultOctave, clef, range, startButtonLabel }: WalkingBassSetupProps) {
  const [saved] = useState(loadSetup)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(saved.selectedPresetId ?? null)
  const [rootKey, setRootKey] = useState(saved.rootKey ?? 'F')
  const [patternId, setPatternId] = useState<string | null>(saved.patternId ?? null)
  const [approachType, setApproachType] = useState<ApproachType>(saved.approachType ?? 'chromatic-below')
  const [shiftSemitones, setShiftSemitones] = useState(saved.shiftSemitones ?? 0)
  const [loopCount, setLoopCount] = useState(saved.loopCount ?? 1)
  const [shiftUntilKey, setShiftUntilKey] = useState(saved.shiftUntilKey ?? rootKey)

  const persistSetup = useCallback(() => {
    const state: WalkingBassSetupState = { selectedPresetId, rootKey, patternId, approachType, shiftSemitones, loopCount, shiftUntilKey }
    localStorage.setItem(WALKING_BASS_SETUP_KEY, JSON.stringify(state))
  }, [selectedPresetId, rootKey, patternId, approachType, shiftSemitones, loopCount, shiftUntilKey])

  useEffect(() => { persistSetup() }, [persistSetup])

  const selectedPreset = WALKING_BASS_PRESETS.find((p) => p.id === selectedPresetId)

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    const seq = selectedPreset.generate(rootKey, defaultOctave ?? 2)
    return {
      ...seq,
      patternId,
      approachType,
    }
  }, [selectedPreset, rootKey, defaultOctave, patternId, approachType])

  const previewSequence = useMemo(() => {
    if (!generatedSequence) return null
    const withLoopParams = {
      ...generatedSequence,
      shiftSemitones,
      loopCount: shiftSemitones === 0 ? loopCount : undefined,
      shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
    }
    return expandSequenceWithLoops<WalkingBassSequence, WalkingBassStep>(
      withLoopParams,
      (step) => ({ root: step.root, octave: step.rootOctave }),
      (step, pc, oct) => ({ ...step, root: pc, rootOctave: oct, label: undefined }),
    )
  }, [generatedSequence, shiftSemitones, loopCount, shiftUntilKey])

  const handleStart = () => {
    if (!generatedSequence) return
    onStart({
      ...generatedSequence,
      shiftSemitones,
      loopCount: shiftSemitones === 0 ? loopCount : undefined,
      shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
    })
  }

  const presetsByCategory = useMemo(() => {
    const grouped: Record<string, WalkingBassPresetTemplate[]> = {}
    for (const preset of WALKING_BASS_PRESETS) {
      if (!grouped[preset.category]) grouped[preset.category] = []
      grouped[preset.category].push(preset)
    }
    return grouped
  }, [])

  return (
    <div className={styles.threeColumnLayout}>
      {/* Column 1: preset list */}
      <div className={styles.leftColumn}>
        <section>
          <h3 className={styles.sectionTitle}>Presets</h3>
          {CATEGORY_ORDER.map((category) => {
            const presets = presetsByCategory[category]
            if (!presets || presets.length === 0) return null
            return (
              <div key={category} className={styles.categoryGroup}>
                <span className={styles.categoryHeader}>
                  {WALKING_BASS_CATEGORIES[category]}
                </span>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`${styles.presetRow} ${selectedPresetId === preset.id ? styles.presetRowActive : ''}`}
                    onClick={() => {
                      if (selectedPresetId === preset.id) {
                        setSelectedPresetId(null)
                      } else {
                        setSelectedPresetId(preset.id)
                      }
                    }}
                  >
                    <span className={styles.presetName}>{preset.name}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </section>
      </div>

      {/* Placeholder when no preset selected */}
      {!selectedPreset && (
        <div className={styles.emptyStatePlaceholder}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Select a preset to get started</span>
        </div>
      )}

      {/* Column 2: config panel */}
      {selectedPreset && (
        <div className={styles.middleColumn}>
          <div className={styles.presetConfig}>
            {/* Preset header */}
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderName}>{selectedPreset.name}</span>
              <span className={styles.panelHeaderDesc}>{selectedPreset.description}</span>
            </div>

            {/* Root Note */}
            <RootNoteSelector value={rootKey} onChange={setRootKey} classes={styles} />

            {/* Pattern */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Pattern</span>
              <div className={styles.chipRow}>
                <button
                  className={`${styles.chip} ${patternId === null ? styles.chipActive : ''}`}
                  onClick={() => setPatternId(null)}
                >
                  Default
                </button>
                {WALKING_BASS_PATTERNS.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.chip} ${patternId === p.id ? styles.chipActive : ''}`}
                    onClick={() => setPatternId(p.id)}
                    title={p.description}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Approach Type */}
            <div className={styles.configSection}>
              <span className={styles.configLabel}>Approach Notes</span>
              <div className={styles.chipRow}>
                {APPROACH_TYPES.map((at) => (
                  <button
                    key={at}
                    className={`${styles.chip} ${approachType === at ? styles.chipActive : ''}`}
                    onClick={() => setApproachType(at)}
                  >
                    {APPROACH_TYPE_LABELS[at]}
                  </button>
                ))}
              </div>
            </div>

            {/* Loop */}
            <LoopSection
              shiftSemitones={shiftSemitones}
              onShiftSemitonesChange={setShiftSemitones}
              loopCount={loopCount}
              onLoopCountChange={setLoopCount}
              shiftUntilKey={shiftUntilKey}
              onShiftUntilKeyChange={setShiftUntilKey}
              rootKey={rootKey}
              classes={styles}
              untilVariant="chips"
            />

            {/* Settings slot (metronome, advanced) */}
            {settingsSlot}

            <button className={styles.startButton} onClick={handleStart}>
              {startButtonLabel ?? 'Start Practice'}
            </button>
          </div>
        </div>
      )}

      {/* Column 3: preview */}
      {selectedPreset && previewSequence && (
        <div className={styles.previewColumn}>
          <span className={styles.configLabel}>Walking Bass Preview</span>
          <span className={styles.previewInfo}>
            {previewSequence.steps.length} {previewSequence.steps.length === 1 ? 'measure' : 'measures'}
          </span>
          <WalkingBassStaffPreview
            sequence={previewSequence}
            range={range}
            clef={clef}
          />
        </div>
      )}
    </div>
  )
}
