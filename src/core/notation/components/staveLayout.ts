/**
 * Pure layout functions for the Stave component.
 * Separated from Stave.tsx so that file only exports React components
 * (required by react-refresh/only-export-components).
 */

import type { StaffConfig } from '../types.ts'
import { keySignatureWidth } from '../glyphs/keySignatureLayout.ts'

/**
 * Minimum left margin to prevent accidental glyphs from clipping past
 * the measure's left edge. Accidentals on the first note extend
 * ~22px left of center (noteRadius + 14), and with note centers at
 * noteSpacing/2, a small padding is needed to keep them in bounds.
 */
export const ACCIDENTAL_LEFT_MARGIN = 12

/**
 * Compute the horizontal offset where notes should begin,
 * accounting for clef, time signature, and key signature widths.
 * Always returns at least ACCIDENTAL_LEFT_MARGIN to prevent
 * accidental glyphs from bleeding past the measure boundary.
 */
export function staveContentStartX(
  config: StaffConfig,
  options: {
    showClef?: boolean
    showTimeSignature?: boolean
    keySigAccidentalCount?: number
  } = {},
): number {
  let x = 0
  if (options.showClef) x += config.clefWidth
  if (options.showTimeSignature) x += config.timeSigWidth
  if (options.keySigAccidentalCount) {
    x += keySignatureWidth(options.keySigAccidentalCount)
  }
  return Math.max(x, ACCIDENTAL_LEFT_MARGIN)
}
