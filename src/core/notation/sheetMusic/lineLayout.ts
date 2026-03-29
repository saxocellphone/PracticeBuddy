import type { SheetMeasure } from './types.ts'

export interface StaffLineLayout {
  measures: SheetMeasure[]
  startMeasureIndex: number
  isFirstLine: boolean
}

/**
 * Width-based line wrapping: fit as many measures as the container allows.
 * Used by scale/arpeggio previews and practice views.
 */
export function computeWidthBasedLines(
  measures: SheetMeasure[],
  containerWidth: number,
  measureWidthFn: (m: SheetMeasure) => number,
  firstLineExtra: number,
  subsequentLineExtra: number,
): StaffLineLayout[] {
  if (measures.length === 0 || containerWidth <= 0) return []

  const lines: StaffLineLayout[] = []
  let idx = 0

  while (idx < measures.length) {
    const isFirstLine = idx === 0
    let usedWidth = 0
    const lineMeasures: SheetMeasure[] = []

    while (idx < measures.length) {
      let w = measureWidthFn(measures[idx])
      if (lineMeasures.length === 0) {
        w += isFirstLine ? firstLineExtra : subsequentLineExtra
      }

      if (usedWidth + w > containerWidth && lineMeasures.length > 0) {
        break
      }

      lineMeasures.push(measures[idx])
      usedWidth += w
      idx++
    }

    lines.push({
      measures: lineMeasures,
      startMeasureIndex: idx - lineMeasures.length,
      isFirstLine,
    })
  }

  return lines
}

/**
 * Fixed-count line wrapping with pickup support.
 * Pickup measures prepend to the first group without counting toward the limit.
 */
export function computeFixedCountLines(
  measures: SheetMeasure[],
  measuresPerLine: number,
): StaffLineLayout[] {
  if (measures.length === 0) return []

  const lines: StaffLineLayout[] = []
  let idx = 0

  while (idx < measures.length) {
    const lineMeasures: SheetMeasure[] = []

    // Collect any pickup measures first (don't count toward limit)
    while (idx < measures.length && measures[idx].pickup) {
      lineMeasures.push(measures[idx])
      idx++
    }

    // Then collect up to measuresPerLine full measures
    let fullCount = 0
    while (idx < measures.length && fullCount < measuresPerLine && !measures[idx].pickup) {
      lineMeasures.push(measures[idx])
      idx++
      fullCount++
    }

    if (lineMeasures.length > 0) {
      lines.push({
        measures: lineMeasures,
        startMeasureIndex: idx - lineMeasures.length,
        isFirstLine: lines.length === 0,
      })
    }
  }

  return lines
}
