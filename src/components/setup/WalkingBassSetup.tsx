import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import {
  WALKING_BASS_PRESETS,
  WALKING_BASS_CATEGORIES,
} from '@core/walking-bass/presets.ts'
import type { WalkingBassCategory } from '@core/walking-bass/presets.ts'
import type { WalkingBassSequence, WalkingBassStep, ApproachType } from '@core/walking-bass/types.ts'
import { APPROACH_TYPE_LABELS, WALKING_BASS_PATTERNS } from '@core/walking-bass/index.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import type { ClefType } from '@core/instruments.ts'
import { RootNoteSelector } from '@components/common/RootNoteSelector.tsx'
import { LoopSection } from '@components/common/LoopSection.tsx'
import { SetupShell } from '@components/common/SetupShell.tsx'
import { mergeStyles } from '@components/common/mergeStyles.ts'
import type { PresetCategory } from '@components/common/SetupShell.tsx'
import { WalkingBassStaffPreview } from './WalkingBassStaffPreview.tsx'
import sharedStyles from '../common/SetupLayout.module.css'
import localStyles from './WalkingBassSetup.module.css'
const styles = mergeStyles(sharedStyles, localStyles)

const CATEGORY_ORDER: PresetCategory[] = (
  ['blues', 'ii-v-i', 'standards', 'technique'] as WalkingBassCategory[]
).map(key => ({ key, label: WALKING_BASS_CATEGORIES[key] }))

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

  const presetItems = WALKING_BASS_PRESETS.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
  }))

  const configContent = (
    <>
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
    </>
  )

  return (
    <SetupShell
      presets={presetItems}
      categories={CATEGORY_ORDER}
      selectedPresetId={selectedPresetId}
      onSelectPreset={setSelectedPresetId}
      localStyles={localStyles}
      presetName={selectedPreset?.name}
      presetDescription={selectedPreset?.description}
      configContent={configContent}
      settingsSlot={settingsSlot}
      startButtonLabel={startButtonLabel}
      onStart={handleStart}
      previewLabel="Walking Bass Preview"
      previewMeta={
        previewSequence
          ? `${previewSequence.steps.length} ${previewSequence.steps.length === 1 ? 'measure' : 'measures'}`
          : undefined
      }
      previewContent={
        previewSequence ? (
          <WalkingBassStaffPreview
            sequence={previewSequence}
            range={range}
            clef={clef}
          />
        ) : undefined
      }
    />
  )
}
