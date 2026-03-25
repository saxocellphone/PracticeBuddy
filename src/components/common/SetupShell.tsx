import { useMemo, type ReactNode } from 'react'
import sharedStyles from './SetupLayout.module.css'
import { mergeStyles } from './mergeStyles.ts'

export interface PresetItem {
  id: string
  name: string
  category: string
  description?: string
}

export interface PresetCategory {
  key: string
  label: string
}

interface SetupShellProps {
  /** Flat list of all presets */
  presets: PresetItem[]
  /** Ordered categories with display labels */
  categories: PresetCategory[]
  /** Currently selected preset id */
  selectedPresetId: string | null
  /** Called when a preset is clicked (toggle selection) */
  onSelectPreset: (id: string | null) => void
  /** Extra content below the presets in the left column (e.g. custom sequences) */
  leftColumnExtra?: ReactNode
  /** Mode-specific local CSS overrides (merged with shared styles) */
  localStyles?: Record<string, string>

  /** Name of the selected preset (shown in config panel header) */
  presetName?: string
  /** Description of the selected preset */
  presetDescription?: string
  /** Mode-specific config controls (root note, direction, etc.) */
  configContent?: ReactNode
  /** Settings slot (metronome, advanced settings) */
  settingsSlot?: ReactNode
  /** Start button label */
  startButtonLabel?: string
  /** Called when start is clicked */
  onStart?: () => void

  /** Label above the preview (e.g. "Scale Preview") */
  previewLabel?: string
  /** Sub-label below the preview label (e.g. direction + count) */
  previewMeta?: string
  /** Preview content (staff preview component) */
  previewContent?: ReactNode
}

export function SetupShell({
  presets,
  categories,
  selectedPresetId,
  onSelectPreset,
  leftColumnExtra,
  localStyles = {},
  presetName,
  presetDescription,
  configContent,
  settingsSlot,
  startButtonLabel = 'Start Practice',
  onStart,
  previewLabel,
  previewMeta,
  previewContent,
}: SetupShellProps) {
  const styles = useMemo(() => mergeStyles(sharedStyles, localStyles), [localStyles])

  const presetsByCategory = useMemo(() => {
    const grouped: Record<string, PresetItem[]> = {}
    for (const preset of presets) {
      if (!grouped[preset.category]) grouped[preset.category] = []
      grouped[preset.category].push(preset)
    }
    return grouped
  }, [presets])

  const hasSelection = selectedPresetId !== null

  return (
    <div className={styles.threeColumnLayout}>
      {/* Column 1: Preset list */}
      <div className={styles.leftColumn}>
        <section>
          <h3 className={styles.sectionTitle}>Presets</h3>
          {categories.map(({ key, label }) => {
            const categoryPresets = presetsByCategory[key]
            if (!categoryPresets || categoryPresets.length === 0) return null
            return (
              <div key={key} className={styles.categoryGroup}>
                <span className={styles.categoryHeader}>{label}</span>
                {categoryPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`${styles.presetRow} ${selectedPresetId === preset.id ? styles.presetRowActive : ''}`}
                    onClick={() => {
                      onSelectPreset(selectedPresetId === preset.id ? null : preset.id)
                    }}
                  >
                    <span className={styles.presetName}>{preset.name}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </section>
        {leftColumnExtra}
      </div>

      {/* Empty state placeholder */}
      {!hasSelection && (
        <div className={styles.emptyStatePlaceholder}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Select a preset to get started</span>
        </div>
      )}

      {/* Column 2: Config panel */}
      {hasSelection && (
        <div className={styles.middleColumn}>
          <div className={styles.presetConfig}>
            {/* Header */}
            {presetName && (
              <div className={styles.panelHeader}>
                <span className={styles.panelHeaderName}>{presetName}</span>
                {presetDescription && (
                  <span className={styles.panelHeaderDesc}>{presetDescription}</span>
                )}
              </div>
            )}

            {/* Mode-specific config */}
            {configContent}

            {/* Settings slot (metronome, advanced) */}
            {settingsSlot}

            {onStart && (
              <button className={styles.startButton} onClick={onStart}>
                {startButtonLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Column 3: Preview */}
      {hasSelection && previewContent && (
        <div className={styles.previewColumn}>
          {previewLabel && <span className={styles.configLabel}>{previewLabel}</span>}
          {previewMeta && <span className={styles.previewMeta}>{previewMeta}</span>}
          {previewContent}
        </div>
      )}
    </div>
  )
}
