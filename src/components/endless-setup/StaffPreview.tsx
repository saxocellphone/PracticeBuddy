import { useEffect, useRef, useState } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import type { Note } from '@core/wasm/types.ts'

interface StaffPreviewProps {
  notes: Note[]
  scaleName: string
  rootPitchClass: string
  scaleTypeIndex: number
}

// Chromatic scale in sharp notation for semitone lookup
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

// Normalize flat spellings to sharp for index lookup
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
}

// Semitone offset from scale root up to the relative major root.
// Undefined = no standard major key equivalent (jazz/symmetric scales → no key sig).
const RELATIVE_MAJOR_OFFSET: Partial<Record<number, number>> = {
  0:  0,  // Major
  1:  3,  // Natural Minor
  2:  3,  // Harmonic Minor (approximate)
  3:  0,  // Melodic Minor (no standard key sig, show as root major)
  4:  10, // Dorian        (parent major is whole step below root)
  5:  8,  // Phrygian      (parent major is major third below root)
  6:  7,  // Lydian        (parent major is perfect fourth below root)
  7:  5,  // Mixolydian    (parent major is perfect fifth below root)
  8:  1,  // Locrian       (parent major is semitone below root)
  9:  0,  // Major Pentatonic
  10: 3,  // Minor Pentatonic
  11: 3,  // Blues
  17: 5,  // Bebop Dominant (same parent as Mixolydian)
  // Indices 12–16 (jazz modal / symmetric) → undefined → no key sig shown
}

// Semitone index → VexFlow key signature string.
// Where enharmonic ambiguity exists, prefer the conventional spelling
// (Db over C#, F# over Gb for the 6-accidental keys).
const MAJOR_KEY_SIG: Record<number, string> = {
  0:  'C',
  7:  'G',
  2:  'D',
  9:  'A',
  4:  'E',
  11: 'B',
  6:  'F#',
  5:  'F',
  10: 'Bb',
  3:  'Eb',
  8:  'Ab',
  1:  'Db',
}

/**
 * Return the VexFlow key signature string for a given root + scale type.
 * Returns 'C' (no accidentals shown in key sig) for scales without a
 * standard major-key equivalent.
 */
function getKeySignature(rootPitchClass: string, scaleTypeIndex: number): string {
  const offset = RELATIVE_MAJOR_OFFSET[scaleTypeIndex]
  if (offset === undefined) return 'C'

  const normalized = FLAT_TO_SHARP[rootPitchClass] ?? rootPitchClass
  const rootIdx = CHROMATIC.indexOf(normalized as typeof CHROMATIC[number])
  if (rootIdx === -1) return 'C'

  const majorRootIdx = (rootIdx + offset) % 12
  return MAJOR_KEY_SIG[majorRootIdx] ?? 'C'
}

/** Convert a Note to VexFlow key string: "c/4", "db/3", "f#/2" etc. */
function noteToVexKey(note: Note): string {
  return `${note.pitchClass.toLowerCase()}/${note.octave}`
}

export function StaffPreview({ notes, rootPitchClass, scaleTypeIndex }: StaffPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(420)

  // Track container width via ResizeObserver so VexFlow always has real dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Re-render VexFlow whenever notes, width, root, or scale type changes
  useEffect(() => {
    const el = containerRef.current
    if (!el || notes.length === 0 || width === 0) return

    el.innerHTML = ''

    try {
      const keySig = getKeySignature(rootPitchClass, scaleTypeIndex)
      const height = 120

      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const context = renderer.getContext()
      context.setFont('Arial', 10)

      // Stave with bass clef + key signature
      const stave = new Stave(10, 10, width - 20)
      stave.addClef('bass')
      stave.addKeySignature(keySig)
      stave.setContext(context).draw()

      // Build notes — no manual accidentals; applyAccidentals handles them
      const staveNotes = notes.map((note) => (
        new StaveNote({ keys: [noteToVexKey(note)], duration: 'q', clef: 'bass' })
      ))

      const voice = new Voice({ numBeats: notes.length, beatValue: 4 })
      voice.setMode(Voice.Mode.SOFT)
      voice.addTickables(staveNotes)

      // Let VexFlow compute which accidentals are needed given the key signature
      Accidental.applyAccidentals([voice], keySig)

      // Extra left margin for clef + key sig (more accidentals = more space needed)
      const keySigWidth = keySig === 'C' ? 80 : 120
      new Formatter().joinVoices([voice]).format([voice], width - keySigWidth)

      voice.draw(context, stave)
    } catch (err) {
      console.error('StaffPreview render error:', err)
    }
  }, [notes, width, rootPitchClass, scaleTypeIndex])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', minHeight: '120px', overflow: 'hidden' }}
    />
  )
}
