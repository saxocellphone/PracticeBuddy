import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import type { ApproachType } from '@core/walking-bass/types.ts'
import { APPROACH_TYPE_LABELS, WALKING_BASS_PATTERNS } from '@core/walking-bass/index.ts'
import type { ClefType } from '@core/instruments.ts'
import type { JazzStandardSubMode } from '@core/jazz-standards/types.ts'
import {
  standardToMelodyMeasures,
  standardToWalkingBassSequence,
} from '@core/jazz-standards/builder.ts'
import { getKeySignatureForScale, getKeySignature } from '@core/notation/keySignature.ts'
import { useJazzStandards, useJazzStandard } from '@hooks/useJazzStandards.ts'
import { SetupShell } from '@components/common/SetupShell.tsx'
import type { PresetCategory } from '@components/common/SetupShell.tsx'
import { mergeStyles } from '@components/common/mergeStyles.ts'
import { SheetMusic } from '@core/notation'
import { WalkingBassStaffPreview } from './WalkingBassStaffPreview.tsx'
import sharedStyles from '../common/SetupLayout.module.css'
import localStyles from './JazzStandardSetup.module.css'
const styles = mergeStyles(sharedStyles, localStyles)

const APPROACH_TYPES: ApproachType[] = [
  'chromatic-below',
  'chromatic-above',
  'diatonic',
  'dominant',
]

const CATEGORIES: PresetCategory[] = [
  { key: 'standard', label: 'Standards' },
]

const JAZZ_STANDARD_SETUP_KEY = 'practicebuddy:jazz-standards:setup'

interface JazzStandardSetupState {
  selectedStandardId: string | null
  subMode: JazzStandardSubMode
  patternId: string | null
  approachType: ApproachType
}

function loadSetup(): Partial<JazzStandardSetupState> {
  try {
    const raw = localStorage.getItem(JAZZ_STANDARD_SETUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export interface JazzStandardSetupProps {
  onStart: (
    standardId: string,
    subMode: JazzStandardSubMode,
    walkingBassConfig?: { patternId: string | null; approachType: ApproachType },
  ) => void
  settingsSlot?: ReactNode
  clef?: ClefType
  range?: { minMidi: number; maxMidi: number }
}

export function JazzStandardSetup({
  onStart,
  settingsSlot,
  clef,
  range,
}: JazzStandardSetupProps) {
  const { standards, loading } = useJazzStandards()
  const [saved] = useState(loadSetup)
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(
    saved.selectedStandardId ?? null,
  )
  const [subMode, setSubMode] = useState<JazzStandardSubMode>(saved.subMode ?? 'melody')
  const [patternId, setPatternId] = useState<string | null>(saved.patternId ?? null)
  const [approachType, setApproachType] = useState<ApproachType>(
    saved.approachType ?? 'chromatic-below',
  )

  const { standard } = useJazzStandard(selectedStandardId)

  const persistSetup = useCallback(() => {
    const state: JazzStandardSetupState = {
      selectedStandardId,
      subMode,
      patternId,
      approachType,
    }
    localStorage.setItem(JAZZ_STANDARD_SETUP_KEY, JSON.stringify(state))
  }, [selectedStandardId, subMode, patternId, approachType])

  useEffect(() => { persistSetup() }, [persistSetup])

  const presetItems = useMemo(() => {
    if (loading) return []
    return standards.map((s) => ({
      id: s.id,
      name: s.title,
      category: 'standard',
      description: s.composer,
    }))
  }, [standards, loading])

  const melodyMeasures = useMemo(() => {
    if (!standard) return null
    try {
      return standardToMelodyMeasures(standard)
    } catch (err) {
      console.error('JazzStandardSetup melody build failed:', err)
      return null
    }
  }, [standard])

  const walkingBassSequence = useMemo(() => {
    if (!standard) return null
    try {
      const steps = standardToWalkingBassSequence(standard, 2)
      return {
        id: standard.id,
        name: standard.title,
        description: `${standard.composer} — ${standard.key}`,
        steps,
        patternId,
        approachType,
      }
    } catch (err) {
      console.error('JazzStandardSetup walking bass build failed:', err)
      return null
    }
  }, [standard, patternId, approachType])

  const melodyKeySig = useMemo(() => {
    if (!standard) return null
    const cofKeySig = getKeySignatureForScale(standard.key, 'Major')
    if (cofKeySig) return cofKeySig
    if (melodyMeasures) {
      const allNotes = melodyMeasures.flatMap((m) => m.notes.map((n) => n.note))
      return getKeySignature(allNotes)
    }
    return null
  }, [standard, melodyMeasures])

  const handleStart = () => {
    if (!selectedStandardId) return
    if (subMode === 'walking-bass') {
      onStart(selectedStandardId, subMode, { patternId, approachType })
    } else {
      onStart(selectedStandardId, subMode)
    }
  }

  const configContent = (
    <>
      {/* Sub-mode toggle */}
      <div className={styles.configSection}>
        <span className={styles.configLabel}>Mode</span>
        <div className={styles.chipRow}>
          <button
            className={`${styles.chip} ${subMode === 'melody' ? styles.chipActive : ''}`}
            onClick={() => setSubMode('melody')}
          >
            Play the Melody
          </button>
          <button
            className={`${styles.chip} ${subMode === 'walking-bass' ? styles.chipActive : ''}`}
            onClick={() => setSubMode('walking-bass')}
          >
            Walk Bass over Changes
          </button>
        </div>
      </div>

      {/* Walking bass options */}
      {subMode === 'walking-bass' && (
        <>
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
        </>
      )}
    </>
  )

  const previewContent = useMemo(() => {
    if (!standard) return undefined

    if (subMode === 'melody' && melodyMeasures && melodyKeySig) {
      return (
        <SheetMusic
          measures={melodyMeasures}
          keySignature={melodyKeySig}
          lineWrap={{ count: 4 }}
          scaling={{ scale: 0.6 }}
          maxStretch="uncapped"
          showTies
          clef={standard.melodyClef}
        />
      )
    }

    if (subMode === 'walking-bass' && walkingBassSequence) {
      return (
        <WalkingBassStaffPreview
          sequence={walkingBassSequence}
          range={range}
          clef={clef}
        />
      )
    }

    return undefined
  }, [standard, subMode, melodyMeasures, melodyKeySig, walkingBassSequence, range, clef])

  const previewLabel = subMode === 'melody' ? 'Melody Preview' : 'Walking Bass Preview'
  const previewMeta = standard
    ? `${standard.measures.length} ${standard.measures.length === 1 ? 'measure' : 'measures'} — ${standard.form}`
    : undefined

  return (
    <SetupShell
      presets={presetItems}
      categories={CATEGORIES}
      selectedPresetId={selectedStandardId}
      onSelectPreset={setSelectedStandardId}
      localStyles={localStyles}
      presetName={standard?.title}
      presetDescription={standard ? `${standard.composer} — ${standard.key} — ${standard.form}` : undefined}
      configContent={configContent}
      settingsSlot={settingsSlot}
      startButtonLabel="View Sheet Music"
      onStart={handleStart}
      previewLabel={previewLabel}
      previewMeta={previewMeta}
      previewContent={previewContent}
    />
  )
}
