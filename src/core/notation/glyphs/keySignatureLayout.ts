/**
 * Pure layout functions for key signature rendering.
 * Separated from KeySignatureGlyphs.tsx so that file only exports
 * React components (required by react-refresh/only-export-components).
 */

/** Spacing between each accidental symbol in the key signature. */
export const KEY_SIG_SPACING = 10

/** Compute the total width consumed by the key signature. */
export function keySignatureWidth(accidentalCount: number): number {
  if (accidentalCount === 0) return 0
  return accidentalCount * KEY_SIG_SPACING + 12
}
