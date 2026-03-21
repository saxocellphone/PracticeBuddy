# PracticeBuddy

A music practice app for bass players with real-time pitch detection. Play your instrument into your microphone and get instant feedback on pitch accuracy and timing.

Built with React, TypeScript, Rust/WebAssembly, and the Web Audio API.

## Features

### Practice Modes

**Follow Mode** — Play at your own pace. The app listens to your microphone and advances to the next note when you play the correct pitch.

**Rhythm Mode** — Play in time with the metronome. Scored on both pitch accuracy and timing.

### Scales

- 15+ preset sequences including Jazz ii-V-I, circle of fifths, blues, modes, and more
- Build custom scale sequences
- All common scale types: Major, Minor, Dorian, Mixolydian, Blues, Pentatonic, etc.
- Configurable octaves (1-3), direction (up/down/both), and loop shift

### Arpeggios

- Major, Minor, Dominant 7th, Major 7th, Minor 7th, Diminished, Augmented, and more
- Jazz progression presets (ii-V-I Major, ii-V-i Minor)
- Configurable octaves, direction, and loop shift through all keys
- Chord symbols displayed above the staff notation

### Notation

- Real-time bass clef staff notation with proper engraving
- Key signatures, accidentals, ledger lines
- Chord symbols above measures (lead sheet style)
- Multi-line wrapping for long sequences

### Real-Time Feedback

- Live pitch detection via WebAssembly
- Cents-offset indicator showing how sharp or flat you are
- Hold progress bar — sustain the note to confirm
- Correct/incorrect flash feedback
- Session results with per-note accuracy breakdown

### Settings

- Adjustable BPM with metronome
- Mic sensitivity control for different microphone setups
- Cents tolerance (how close to the pitch you need to be)
- Settings persist across sessions via localStorage

## Tech Stack

- **Frontend**: React 19 + TypeScript (strict mode)
- **Pitch Detection**: Rust compiled to WebAssembly
- **Audio**: Web Audio API (microphone input + FFT analysis)
- **Build**: Vite + wasm-pack
- **Tests**: Vitest (300+ tests)

## Development

```bash
# Prerequisites: Node.js 20+, Rust toolchain, wasm-pack

# Install dependencies
npm install

# Start dev server (builds WASM + starts Vite)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run all tests (Rust + JS)
npm run test:all

# Lint
npm run lint
```

## License

MIT
