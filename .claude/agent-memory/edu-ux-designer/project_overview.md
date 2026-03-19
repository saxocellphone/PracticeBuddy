---
name: Project Overview
description: PracticeBuddy design system tokens, color palette, and observed UI conventions
type: project
---

PracticeBuddy is a music practice app for bass players. React 19 + TypeScript + CSS Modules. Real-time pitch detection via WebAssembly.

**View state machine:** home → setup (EndlessSetup) → practicing → results

**Design tokens observed (CSS custom properties):**
- Colors: --color-surface, --color-surface-hover, --color-bg, --color-border, --color-accent (indigo ~#6366f1), --color-text-primary, --color-text-secondary, --color-text-muted, --color-incorrect, --color-incorrect-bg
- Spacing: --space-xs, --space-sm, --space-md, --space-lg, --space-xl
- Radius: --radius-sm, --radius-md
- Transition: --transition-fast
- Font: --font-mono (used for scale step labels)

**Overall app aesthetic:** Dark theme, dense professional feel, low visual warmth. Functional but skews older/adult rather than student-friendly. No icons used anywhere in the setup screen.

**Preset categories (as of 2026-03-18):** Basic (1), Jazz (6), Theory (3), Technique (2) = 13 total presets.

**Why:** Preset list grew from a manageable size to 13 items, breaking the flat vertical list pattern that worked when there were fewer options.
