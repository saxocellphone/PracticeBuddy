---
name: Project Overview
description: PracticeBuddy design system tokens, color palette, and observed UI conventions
type: project
---

PracticeBuddy is a music practice app for bass players. React 19 + TypeScript + CSS Modules. Real-time pitch detection via WebAssembly.

**View state machine:** home -> setup (EndlessSetup) -> practicing -> results

**Design tokens observed (CSS custom properties, confirmed from src/styles/variables.css):**
- `--color-bg: #0f0f14` — near-black page background (deep navy-black)
- `--color-surface: #1a1a24` — card/panel surface
- `--color-surface-hover: #22222e`
- `--color-border: #2a2a3a`
- `--color-text-primary: #e8e8f0`
- `--color-text-secondary: #8888a0`
- `--color-text-muted: #555570`
- `--color-accent: #6366f1` — indigo
- `--color-accent-hover: #818cf8`
- `--color-correct: #22c55e`
- `--color-incorrect: #ef4444`
- `--color-missed: #6b7280`
- `--color-warning: #f59e0b`
- `--color-beat-active: #f59e0b`
- `--color-beat-inactive: #333348`
- Spacing: xs 4px, sm 8px, md 16px, lg 24px, xl 32px, 2xl 48px
- Radii: sm 6px, md 10px, lg 16px, full 9999px
- Fonts: Inter (sans), JetBrains Mono (mono)
- Transitions: fast 150ms, normal 250ms

**Overall app aesthetic:** Dark theme, dense professional feel, low visual warmth. Functional but skews older/adult rather than student-friendly. No icons used anywhere in the setup screen.

**Preset categories (as of 2026-03-18):** Basic (1), Jazz (6), Theory (3), Technique (2) = 13 total presets.

**Why:** Preset list grew from a manageable size to 13 items, breaking the flat vertical list pattern that worked when there were fewer options.

**Chip pattern (established):**
- Height: 28px, padding 0 10px, border-radius 14px, font-size 13px
- Inactive: transparent bg, var(--color-border) border
- Active: var(--color-accent) bg + border, white text
- Used for: Root Note, Octaves, Scale Type, Direction, Loop Shift

**Setup screen layout:** Three-column grid at 900px+ (280px preset list | 420px config | 1fr preview). Middle column uses configSection pattern (uppercase 12px label + chipRow below).

**Results screen:** Accuracy circle (colored border + percentage), stat row (Scales / Correct / Wrong / Missed / Avg cents off), collapsible per-scale breakdown with per-note detail rows. Uses --color-correct, --color-warning, --color-incorrect for threshold coloring (>=80% / >=50% / below).

**Home screen:** Card grid with icon + title + description. Cards have per-card accent color via CSS custom property. "Coming Soon" badge pattern exists for disabled cards.

**AdvancedSettings component:** Collapsible section via chevron toggle, state persisted to localStorage. Used as settingsSlot in EndlessSetup. Metronome/BPM/tolerance controls live inside it.

**Rhythm Mode feature:** Designed 2026-03-19. Spec covers setup addition, practice view, and results additions. See screen_rhythm_mode.md for the full spec.

## Known Design Issues (RhythmPracticeView — reviewed 2026-03-19)
- Rail background (`--color-surface` = #1a1a24) is nearly indistinguishable from note cells (no explicit background set on `.noteCell` — transparent by default). Staff SVG ink on dark surface lacks contrast.
- Active note highlight (`rgba(99, 102, 241, 0.08)`) is only 8% opacity — nearly invisible against the surface.
- Past note dim (`opacity: 0.4`) applied on top of already low-contrast elements compounds readability.
- Recommended fix: use a deeper rail background (#0a0a10) and an explicit elevated card background (#252535) for note cells to create a clear two-layer contrast system.
