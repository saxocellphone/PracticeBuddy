export type ClefType = 'bass' | 'treble'

export interface InstrumentConfig {
  id: string
  name: string
  clef: ClefType
  minMidi: number
  maxMidi: number
  defaultOctave: number
  transposition: number // 0 for concert pitch instruments
}

export const INSTRUMENTS: Record<string, InstrumentConfig> = {
  // Bass: E1–G4 (standard 4-string, 24 frets)
  bass: { id: 'bass', name: 'Bass', clef: 'bass', minMidi: 28, maxMidi: 67, defaultOctave: 2, transposition: 0 },
  // Piano (treble clef): C3–C7 (4 octaves, supports 3-octave scales comfortably)
  piano: { id: 'piano', name: 'Piano', clef: 'treble', minMidi: 48, maxMidi: 96, defaultOctave: 4, transposition: 0 },
  // Guitar (treble clef, concert pitch): E3–E6 (3 octaves, full 24-fret range written)
  guitar: { id: 'guitar', name: 'Guitar', clef: 'treble', minMidi: 52, maxMidi: 88, defaultOctave: 4, transposition: 0 },
}

export const DEFAULT_INSTRUMENT = INSTRUMENTS.bass

export function getInstrument(id: string): InstrumentConfig {
  return INSTRUMENTS[id] ?? DEFAULT_INSTRUMENT
}
