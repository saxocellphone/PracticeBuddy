import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import {
  ARPEGGIO_PRESETS,
  ARPEGGIO_PRESET_CATEGORIES,
} from '@core/arpeggio/presets.ts'
import type { ArpeggioSequence, ArpeggioStep, ArpeggioDirection } from '@core/arpeggio/types.ts'
import { expandSequenceWithLoops } from '@core/music/sequenceExpander.ts'
import { isArpeggioPlayable } from '@core/music/arpeggioBuilder.ts'
import type { ClefType } from '@core/instruments.ts'
import type { NoteDuration, ScaleStartPosition } from '@core/rhythm/types.ts'
import { NOTE_DURATIONS, NOTE_DURATION_LABELS } from '@core/rhythm/types.ts'
import { RootNoteSelector } from '@components/common/RootNoteSelector.tsx'
import { LoopSection } from '@components/common/LoopSection.tsx'
import { SetupShell } from '@components/common/SetupShell.tsx'
import { mergeStyles } from '@components/common/mergeStyles.ts'
import type { PresetCategory } from '@components/common/SetupShell.tsx'
import { ArpeggioStaffPreview } from './ArpeggioStaffPreview.tsx'
import sharedStyles from '../common/SetupLayout.module.css'
import localStyles from './ArpeggioSetup.module.css'
const styles = mergeStyles(sharedStyles, localStyles)

const CATEGORY_ORDER: PresetCategory[] = [
  { key: 'triads', label: ARPEGGIO_PRESET_CATEGORIES['triads'] },
  { key: 'seventh', label: ARPEGGIO_PRESET_CATEGORIES['seventh'] },
  { key: 'jazz', label: ARPEGGIO_PRESET_CATEGORIES['jazz'] },
]

const DIRECTION_OPTIONS: { label: string; value: ArpeggioDirection }[] = [
  { label: '\u2191 Up', value: 'ascending' },
  { label: '\u2193 Down', value: 'descending' },
  { label: '\u2195 Both', value: 'ascendingDescending' },
]

interface ArpeggioSetupProps {
  onStart: (sequence: ArpeggioSequence) => void
  settingsSlot?: ReactNode
  noteDuration?: NoteDuration
  onNoteDurationChange?: (d: NoteDuration) => void
  bpm?: number
  defaultOctave?: number
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
  scaleStartPosition?: ScaleStartPosition
  startButtonLabel?: string
}

const ARPEGGIO_SETUP_KEY = 'practicebuddy:arpeggios:setup'

interface ArpeggioSetupState {
  selectedPresetId: string | null
  rootKey: string
  direction: ArpeggioDirection
  shiftSemitones: number
  numOctaves: number
  loopCount: number
  shiftUntilKey: string
}

function loadArpeggioSetup(): Partial<ArpeggioSetupState> {
  try {
    const raw = localStorage.getItem(ARPEGGIO_SETUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function ArpeggioSetup({ onStart, settingsSlot, noteDuration, onNoteDurationChange, defaultOctave, range, clef, scaleStartPosition, startButtonLabel }: ArpeggioSetupProps) {
  const [saved] = useState(loadArpeggioSetup)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(saved.selectedPresetId ?? null)
  const [rootKey, setRootKey] = useState(saved.rootKey ?? 'C')
  const [direction, setDirection] = useState<ArpeggioDirection>(saved.direction ?? 'ascending')
  const [shiftSemitones, setShiftSemitones] = useState(saved.shiftSemitones ?? 0)
  const [numOctaves, setNumOctaves] = useState(saved.numOctaves ?? 1)
  const [loopCount, setLoopCount] = useState(saved.loopCount ?? 1)
  const [shiftUntilKey, setShiftUntilKey] = useState(saved.shiftUntilKey ?? rootKey)

  const persistSetup = useCallback(() => {
    const state: ArpeggioSetupState = { selectedPresetId, rootKey, direction, shiftSemitones, numOctaves, loopCount, shiftUntilKey }
    localStorage.setItem(ARPEGGIO_SETUP_KEY, JSON.stringify(state))
  }, [selectedPresetId, rootKey, direction, shiftSemitones, numOctaves, loopCount, shiftUntilKey])

  useEffect(() => { persistSetup() }, [persistSetup])

  const selectedPreset = ARPEGGIO_PRESETS.find((p) => p.id === selectedPresetId)

  const generatedSequence = useMemo(() => {
    if (!selectedPreset) return null
    return selectedPreset.generate(rootKey, (defaultOctave ?? 2))
  }, [selectedPreset, rootKey, defaultOctave])

  const previewSequence = useMemo(() => {
    if (!generatedSequence) return null
    const withLoopParams = {
      ...generatedSequence,
      shiftSemitones,
      loopCount: shiftSemitones === 0 ? loopCount : undefined,
      shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
    }
    return expandSequenceWithLoops<ArpeggioSequence, ArpeggioStep>(
      withLoopParams,
      (step: ArpeggioStep) => ({ root: step.root, octave: step.rootOctave }),
      (step: ArpeggioStep, pitchClass: string, octave: number) => ({ ...step, root: pitchClass, rootOctave: octave, label: undefined }),
    )
  }, [generatedSequence, shiftSemitones, loopCount, shiftUntilKey])

  const playableOctaves = useMemo(() => {
    if (!generatedSequence) return [1, 2, 3]
    return [1, 2, 3].filter(n =>
      generatedSequence.steps.every(step => isArpeggioPlayable(step, direction, n, range))
    )
  }, [generatedSequence, direction, range])

  const effectiveNumOctaves = playableOctaves.includes(numOctaves)
    ? numOctaves
    : (playableOctaves[playableOctaves.length - 1] ?? 1)

  const handleStart = () => {
    if (!generatedSequence) return
    onStart({
      ...generatedSequence,
      direction,
      shiftSemitones,
      numOctaves: effectiveNumOctaves,
      loopCount: shiftSemitones === 0 ? loopCount : undefined,
      shiftUntilKey: shiftSemitones > 0 ? shiftUntilKey : undefined,
    })
  }

  const handleSelectPreset = (id: string | null) => {
    setSelectedPresetId(id)
    if (id && id !== selectedPresetId) {
      const preset = ARPEGGIO_PRESETS.find(p => p.id === id)
      if (preset) {
        const seq = preset.generate(rootKey, (defaultOctave ?? 2))
        setShiftSemitones(seq.shiftSemitones ?? 0)
      }
    }
  }

  const presetItems = ARPEGGIO_PRESETS.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
  }))

  const configContent = (
    <>
      {/* Root Note */}
      <RootNoteSelector value={rootKey} onChange={setRootKey} classes={styles} />

      {/* Note Duration */}
      {noteDuration && onNoteDurationChange && (
        <div className={styles.configSection}>
          <span className={styles.configLabel}>Note Duration</span>
          <div className={styles.chipRow}>
            {NOTE_DURATIONS.map((d) => (
              <button
                key={d}
                className={`${styles.chip} ${noteDuration === d ? styles.chipActive : ''}`}
                onClick={() => onNoteDurationChange(d)}
              >
                {NOTE_DURATION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Octaves */}
      <div className={styles.configSection}>
        <span className={styles.configLabel}>Octaves</span>
        <div className={styles.chipRow}>
          {playableOctaves.map((n) => (
            <button
              key={n}
              className={`${styles.chip} ${numOctaves === n ? styles.chipActive : ''}`}
              onClick={() => setNumOctaves(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Direction */}
      <div className={styles.configSection}>
        <span className={styles.configLabel}>Direction</span>
        <div className={styles.chipRow}>
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.chip} ${direction === opt.value ? styles.chipActive : ''}`}
              onClick={() => setDirection(opt.value)}
            >
              {opt.label}
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
      />
    </>
  )

  return (
    <SetupShell
      presets={presetItems}
      categories={CATEGORY_ORDER}
      selectedPresetId={selectedPresetId}
      onSelectPreset={handleSelectPreset}
      localStyles={localStyles}
      presetName={selectedPreset?.name}
      presetDescription={selectedPreset?.description}
      configContent={configContent}
      settingsSlot={settingsSlot}
      startButtonLabel={startButtonLabel}
      onStart={handleStart}
      previewLabel="Arpeggio Preview"
      previewMeta={
        previewSequence
          ? `${direction === 'ascending' ? '\u2191 Ascending' : direction === 'descending' ? '\u2193 Descending' : '\u2195 Both directions'} \u00B7 ${previewSequence.steps.length} ${previewSequence.steps.length === 1 ? 'arpeggio' : 'arpeggios'}`
          : undefined
      }
      previewContent={
        previewSequence ? (
          <ArpeggioStaffPreview
            sequence={previewSequence}
            direction={direction}
            numOctaves={effectiveNumOctaves}
            noteDuration={noteDuration}
            clef={clef}
            range={range}
            scaleStartPosition={scaleStartPosition}
          />
        ) : undefined
      }
    />
  )
}
