import type { Note, ScaleInfo, ScaleDirection } from '@core/wasm/types.ts'
import styles from './ScaleSelector.module.css'

interface ScaleSelectorProps {
  pitchClasses: readonly string[]
  availableScales: ScaleInfo[]
  selectedRoot: string
  selectedOctave: number
  selectedScaleIndex: number
  selectedDirection: ScaleDirection
  scaleNotes: Note[]
  selectedScaleInfo: ScaleInfo | null
  onRootChange: (note: string) => void
  onOctaveChange: (octave: number) => void
  onScaleTypeChange: (index: number) => void
  onDirectionChange: (direction: ScaleDirection) => void
}

export function ScaleSelector({
  pitchClasses,
  availableScales,
  selectedRoot,
  selectedOctave,
  selectedScaleIndex,
  selectedDirection,
  scaleNotes,
  selectedScaleInfo,
  onRootChange,
  onOctaveChange,
  onScaleTypeChange,
  onDirectionChange,
}: ScaleSelectorProps) {
  const scalesByCategory = availableScales.reduce<Record<string, { info: ScaleInfo; index: number }[]>>(
    (acc, scale, i) => {
      const cat = scale.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push({ info: scale, index: i })
      return acc
    },
    {}
  )

  const categoryLabels: Record<string, string> = {
    common: 'Common',
    pentatonic: 'Pentatonic',
    blues: 'Blues',
    modes: 'Modes',
  }

  return (
    <div className={styles.container}>
      {/* Root Note */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Root Note</h3>
        <div className={styles.noteGrid}>
          {pitchClasses.map((pc) => (
            <button
              key={pc}
              className={`${styles.noteButton} ${selectedRoot === pc ? styles.noteButtonActive : ''}`}
              onClick={() => onRootChange(pc)}
            >
              {pc}
            </button>
          ))}
        </div>
        <div className={styles.octaveRow}>
          <span className={styles.label}>Octave</span>
          <div className={styles.octaveButtons}>
            {[1, 2, 3, 4].map((oct) => (
              <button
                key={oct}
                className={`${styles.octaveButton} ${selectedOctave === oct ? styles.octaveButtonActive : ''}`}
                onClick={() => onOctaveChange(oct)}
              >
                {oct}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Scale Type */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Scale Type</h3>
        {Object.entries(scalesByCategory).map(([category, scales]) => (
          <div key={category} className={styles.categoryGroup}>
            <span className={styles.categoryLabel}>
              {categoryLabels[category] ?? category}
            </span>
            <div className={styles.scaleButtons}>
              {scales.map(({ info, index }) => (
                <button
                  key={index}
                  className={`${styles.scaleButton} ${selectedScaleIndex === index ? styles.scaleButtonActive : ''}`}
                  onClick={() => onScaleTypeChange(index)}
                >
                  {info.displayName}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Direction */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Direction</h3>
        <div className={styles.directionButtons}>
          {(['ascending', 'descending', 'both'] as ScaleDirection[]).map((dir) => (
            <button
              key={dir}
              className={`${styles.directionButton} ${selectedDirection === dir ? styles.directionButtonActive : ''}`}
              onClick={() => onDirectionChange(dir)}
            >
              {dir === 'ascending' ? '↑ Up' : dir === 'descending' ? '↓ Down' : '↕ Both'}
            </button>
          ))}
        </div>
      </section>

      {/* Preview */}
      {scaleNotes.length > 0 && selectedScaleInfo && (
        <section className={styles.preview}>
          <h3 className={styles.sectionTitle}>
            {selectedRoot}{selectedOctave} {selectedScaleInfo.displayName}
          </h3>
          <div className={styles.previewNotes}>
            {scaleNotes.map((note, i) => (
              <span key={i} className={styles.previewNote}>
                {note.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
