/**
 * Notation font loader — loads the Bravura (SMuFL) music font
 * from VexFlow's embedded WOFF2 data and registers it with
 * the browser's FontFace API.
 *
 * Call `loadNotationFont()` once before rendering any notation.
 * Subsequent calls are no-ops.
 */

import { BRAVURA_FONT_DATA } from './bravura-data.ts'

export const NOTATION_FONT_FAMILY = 'Bravura'

let fontLoadPromise: Promise<void> | null = null

/**
 * Load the Bravura notation font into the document.
 * Safe to call multiple times — only loads once.
 */
export function loadNotationFont(): Promise<void> {
  if (fontLoadPromise) return fontLoadPromise

  fontLoadPromise = (async () => {
    // Check if already loaded (e.g. by VexFlow or a previous call)
    const existing = Array.from(document.fonts).find(
      (f) => f.family === NOTATION_FONT_FAMILY,
    )
    if (existing) return

    const font = new FontFace(NOTATION_FONT_FAMILY, `url(${BRAVURA_FONT_DATA})`)
    await font.load()
    document.fonts.add(font)
  })()

  return fontLoadPromise
}
