# Landing Page & UI Refactor Plan

## Summary
1. Add a modern, card-based **Home Page** as the app's landing screen
2. **Deprecate single scale mode** — merge its scale/direction config into the endless mode to create a unified **"Scale Practice"** mode
3. Hide complex configs behind an **"Advanced Settings"** collapsible
4. Fix buggy mode transitions with proper cleanup
5. Make the design extensible for future modes (Jazz Standards, etc.)

## Architecture Changes

### New View Flow
```
'home' → 'setup' → 'practicing' → 'results'
                         ↑              │
                         └──────────────┘ (retry)
```

- **`home`** (NEW): Card grid with practice mode options. Default view on launch.
- **`setup`**: Mode-specific config (currently only Scale Practice / formerly "Endless")
- **`practicing`**: Unchanged behavior
- **`results`**: Unchanged behavior, "Back" goes to `home`

### Deprecate Single Scale Mode
- Remove `ModeSelector` component entirely
- Remove `practiceMode` state — everything is now the endless/scale-practice flow
- Remove `ScaleSelector` component (its key/octave/scale/direction config is already duplicated in `EndlessSetup`)
- Remove `SessionResults` usage — all results use `EndlessResults` (which already has per-scale breakdown)
- Remove `usePracticeSession` hook from App.tsx (it's still used internally by `useEndlessPractice`)
- Remove single-mode handlers: `handleStartPractice`, `handleRetry`, `handleChangeScale`, `handleStopPractice`
- Remove `onSwitchToSingle` from `EndlessResults`

### Home Page Component
- `src/components/home/HomePage.tsx` + CSS module
- Modern card grid layout with staggered entrance animation
- Each card: icon area, title, description, accent top-edge glow on hover
- Currently two cards:
  - **Scale Practice** — "Practice scales with presets or custom sequences" → navigates to setup
  - **Jazz Standards** (Coming Soon) — disabled card with "Coming Soon" badge
- Data-driven: array of mode objects, easy to add more

### Design Details (from research)
- Cards: `var(--color-surface)` bg, `var(--color-border)` border, `border-radius: var(--radius-lg)` (16px)
- Hover: `translateY(-2px)`, accent border color, subtle accent glow shadow
- Accent top-edge: `::before` gradient bar, fades in on hover
- Staggered entrance: `cardEnter` keyframes, 80ms delay per card
- Typography: page title 1.75rem/700, subtitle 0.95rem secondary, card title 1.1rem/600, card desc 0.85rem secondary
- "Coming Soon" badge: muted pill, card at 0.5 opacity, no hover effects

### Advanced Settings Collapsible
- New component: `src/components/common/AdvancedSettings.tsx` + CSS module
- Native `<details>`/`<summary>` element, styled to match design system
- **Always visible (basic settings)**: Metronome toggle + BPM, Start button
- **Inside Advanced**: Pitch leniency, ignore octave, skip transition
- Persists open/closed state in localStorage

### Transition Bug Fixes
- `handleGoHome` callback does full cleanup: `endless.stopEndless()`, `metronome.stop()`, resets state
- Header title becomes clickable → calls `handleGoHome`
- Results "Back" → `handleGoHome`
- No more stale endless state when switching views

## File Changes

| File | Action | What |
|------|--------|------|
| `src/components/home/HomePage.tsx` | CREATE | Landing page with mode cards |
| `src/components/home/HomePage.module.css` | CREATE | Card grid, hover effects, animations |
| `src/components/common/AdvancedSettings.tsx` | CREATE | Collapsible wrapper for advanced configs |
| `src/components/common/AdvancedSettings.module.css` | CREATE | Collapsible styling |
| `src/App.tsx` | EDIT | Add `home` view, remove single mode, integrate HomePage + AdvancedSettings, fix transitions |
| `src/components/layout/AppShell.tsx` | EDIT | Make header clickable → home, accept `onGoHome` prop |
| `src/components/layout/AppShell.module.css` | EDIT | Clickable title cursor |
| `src/components/session-results/EndlessResults.tsx` | EDIT | Remove "Switch to Single Scale" button, rename "Change Sequence" → "Home" |
| `src/components/mode-selector/ModeSelector.tsx` | DELETE | Replaced by HomePage |
| `src/components/mode-selector/ModeSelector.module.css` | DELETE | Replaced by HomePage |

## Implementation Order
1. Create `HomePage` component with card grid
2. Create `AdvancedSettings` collapsible component
3. Refactor `App.tsx`: add `home` view, remove single mode, reorganize config, fix transitions
4. Update `AppShell` header to be clickable
5. Update `EndlessResults` (remove single-mode references)
6. Delete `ModeSelector` files
7. Verify in preview
