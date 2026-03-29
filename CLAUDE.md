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
- `useScalePractice` — main scale session orchestration, coordinates all other hooks
- `usePitchDetection` — reads frequency from `AudioEngine`, feeds to WASM validation
- `useWasm` — loads and initializes the WASM module
- `useAudioEngine` — wraps `AudioEngine` class (microphone + Web Audio API)
- `useMetronome` — wraps `MetronomeEngine` class

### Scale Sequences (`src/core/scales/`)

A `ScaleSequence` defines an ordered list of scales to cycle through. Presets (e.g. circle-of-fifths transpositions) live in `presets.ts`. Custom sequences persist via `localStorage` (`storage.ts`).

### WASM Layer (`src/core/wasm/`)

`src/core/wasm/pkg/` is generated — do not edit. The wrappers in `src/core/wasm/` (scales.ts, validation.ts, pitchDetector.ts, etc.) are the JS interface to Rust logic. When modifying music theory or pitch detection, edit the Rust source in `crates/core/src/`.

### Path Aliases

`@core` → `src/core/`, `@hooks` → `src/hooks/`, `@components` → `src/components/`

### Persistence

User settings (BPM, metronome toggle, cents tolerance, octave matching) are stored in `localStorage`. Custom scale sequences use `src/core/endless/storage.ts`.

## Parallel Agent Strategy

Use worktree isolation (`isolation: "worktree"`) to run agents in parallel on independent branches. This eliminates file conflicts entirely — each agent gets its own copy of the repo.

### When to Parallelize

Launch parallel worktree agents when a task decomposes into **independent subtasks** that touch different parts of the codebase:

| Pattern | Example | Agents |
|---------|---------|--------|
| Rust + TypeScript | New WASM feature + React UI for it | WASM agent + Frontend agent |
| Multiple components | New setup view + new practice view | Agent per view |
| Feature + Tests | Implement feature + write tests | Feature agent + Test agent (after feature) |
| Independent modules | New scale type + new notation feature | Agent per module |

**Do NOT parallelize** when tasks share the same files (e.g., two features both modifying `App.tsx`).

### Agent Roles and File Domains

#### WASM Agent (worktree)
- **Files:** `crates/core/src/`, `src/core/wasm/*.ts` (wrappers, NOT `pkg/`)
- **Verify:** `npm run test:rust` before completing
- **Use when:** Adding music theory, pitch detection, validation, or session logic
- **Note:** Must run `npm run wasm:build` to regenerate `pkg/` bindings after Rust changes

#### Frontend Agent (worktree)
- **Files:** `src/components/`, `src/hooks/`, `src/core/` (JS/TS only), `src/App.tsx`
- **Verify:** `npx tsc --noEmit && npm run lint` before completing
- **Use when:** Adding/modifying React components, hooks, core TS modules, or CSS

#### Test Agent (worktree or foreground)
- **Files:** `src/__tests__/`, `src/core/__tests__/`, `src/hooks/__tests__/`, `src/__test-utils__/`
- **Verify:** `npm test` before completing
- **Use when:** Writing or fixing tests. Never modifies production code — creates tasks for other agents if bugs are found.
- **Depends on:** Run after the feature agent completes so tests target the actual implementation

#### Full-Stack Agent (foreground, no worktree)
- **Files:** Any
- **Use when:** Changes are tightly coupled across layers (e.g., threading a new prop from Rust → WASM wrapper → hook → component). Worktree isolation adds overhead when you'd just be merging immediately.

### Worktree Workflow

1. **Launch:** `Agent` tool with `isolation: "worktree"` — each gets an independent branch
2. **Work:** Agent makes changes, runs verification commands, commits
3. **Return:** Agent returns its worktree path and branch name
4. **Merge:** The orchestrator (main conversation) merges branches sequentially:
   ```
   git merge <branch-name> --no-edit
   ```
5. **Resolve:** If conflicts occur, resolve them in the main worktree before merging the next branch

### Coordination Protocol

- **Define interfaces first.** Before launching parallel agents, agree on the TypeScript types/function signatures at boundaries (e.g., a new WASM function's JS wrapper signature).
- **Use tasks for handoffs.** When Agent A produces something Agent B needs, create a task describing the interface. Agent B can start from that contract.
- **Verify after merge.** After merging worktree branches, always run `npm run build` and `npm test` in the main worktree to catch integration issues.

### Example: Adding a New Practice Mode

```
1. Plan: Define the data types, hook interface, and component props
2. Launch in parallel (worktrees):
   a. WASM Agent: Implement Rust logic + WASM wrapper + Rust tests
   b. Frontend Agent: Implement hook (mocking WASM) + component + CSS
3. Merge WASM branch first (no TS dependencies)
4. Merge Frontend branch (may need minor fixup if WASM API changed)
5. Launch Test Agent: Write integration tests against merged code
6. Final: npm run build && npm run test:all
```

### Example: Bug Fix Spanning Rust + React

```
1. Diagnose in foreground (read files, understand the bug)
2. Launch Full-Stack Agent (no worktree — changes are coupled)
3. Agent fixes Rust + wrapper + hook/component, runs test:all
```

### Anti-Patterns

- **Don't use worktrees for coupled changes.** If a Rust API change requires immediate React updates, use a single Full-Stack Agent.
- **Don't launch > 3 parallel agents.** Diminishing returns; merge overhead grows.
- **Don't skip the merge verification.** Worktree branches can drift. Always `npm run build && npm test` after merging.
- **Don't have two agents edit `App.tsx`.** It's the most conflict-prone file. Only one agent should touch it per task.
