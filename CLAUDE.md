# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Build WASM (dev mode) + start Vite dev server

# Build
npm run build        # Build WASM + type-check + Vite production build

# Testing
npm test             # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run test:rust    # Run Rust unit tests
npm run test:all     # Run all tests (Rust + JS)

# Code quality
npm run lint         # Run ESLint

# WASM (usually handled by dev/build scripts)
npm run wasm:build      # Production WASM build
npm run wasm:build:dev  # Fast dev WASM build
```

## Architecture

**PracticeBuddy** is a music practice app for bass players with real-time pitch detection. It uses:
- **React 19 + TypeScript** (strict mode) for the UI
- **Rust + WebAssembly** (`crates/core/`) for music theory and pitch detection
- **Web Audio API** for microphone input and FFT analysis

### View State Machine (App.tsx)

`App.tsx` is the root coordinator with four views managed via a `view` state:
- `'home'` → practice mode selection
- `'setup'` → configure scale sequence, BPM, settings
- `'practicing'` → active session with real-time pitch feedback
- `'results'` → cumulative stats, retry option

### Layer Separation

```
React Components (src/components/)
        ↓
Custom Hooks (src/hooks/)          ← stateful orchestration
        ↓
Core Modules (src/core/)           ← business logic, engines
        ↓
WASM Bindings (src/core/wasm/pkg/) ← Rust-generated
```

**Key hooks:**
- `useEndlessPractice` — main session orchestration, coordinates all other hooks
- `usePitchDetection` — reads frequency from `AudioEngine`, feeds to WASM validation
- `useWasm` — loads and initializes the WASM module
- `useAudioEngine` — wraps `AudioEngine` class (microphone + Web Audio API)
- `useMetronome` — wraps `MetronomeEngine` class

### Endless Practice Mode (`src/core/endless/`)

The primary practice mode. A `ScaleSequence` defines an ordered list of scales to cycle through. Presets (e.g. circle-of-fifths transpositions) live in `presets.ts`. Custom sequences persist via `localStorage` (`storage.ts`).

### WASM Layer (`src/core/wasm/`)

`src/core/wasm/pkg/` is generated — do not edit. The wrappers in `src/core/wasm/` (scales.ts, validation.ts, pitchDetector.ts, etc.) are the JS interface to Rust logic. When modifying music theory or pitch detection, edit the Rust source in `crates/core/src/`.

### Path Aliases

`@core` → `src/core/`, `@hooks` → `src/hooks/`, `@components` → `src/components/`

### Persistence

User settings (BPM, metronome toggle, cents tolerance, octave matching) are stored in `localStorage`. Custom scale sequences use `src/core/endless/storage.ts`.

## Agent Team Structure

When working as a team, use these three roles with strict file ownership to prevent conflicts:

### UI Agent
- **Owns (read/write):** `src/components/`, `src/styles/`, `src/assets/`
- **Read-only:** `src/hooks/`, `src/core/`, `src/App.tsx`
- **Role:** Build and modify React components, CSS modules, and UI layout. Define component interfaces and props. When a new hook or core function is needed, describe the required API and create a task for the Logic Agent.

### Logic Agent
- **Owns (read/write):** `src/hooks/`, `src/core/` (except `src/core/wasm/pkg/`), `crates/core/src/`, `src/App.tsx`, `src/context/`
- **Read-only:** `src/components/`
- **Role:** Implement hooks, business logic, state machines, Rust/WASM core, and app-level orchestration. Export the interfaces that components consume. When a UI change is needed, describe it and create a task for the UI Agent.

### Test Agent
- **Owns (read/write):** `src/__tests__/`, `src/__test-utils__/`, `src/core/__tests__/`, `src/core/metronome/__tests__/`, `src/hooks/__tests__/`, `src/core/rhythm/__tests__/`
- **Read-only:** everything else
- **Role:** Write and maintain unit/integration tests. Validate that UI and Logic changes work correctly. Run `npm test` to verify. Never modify production code — if a test reveals a bug, create a task describing the fix for the appropriate agent.

### Coordination Rules
- **Never edit files you don't own.** If you need a change in another agent's domain, create a task or send a message.
- **Shared boundaries:** When UI Agent needs a new hook, or Logic Agent needs a new component prop, communicate the interface (types, function signatures) via the task list.
- **`src/App.tsx`** is owned by Logic Agent since it contains the view state machine, but UI Agent may read it to understand view transitions.
