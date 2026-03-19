---
name: EndlessSetup Screen Review
description: Full design audit and redesign plan for the EndlessSetup screen; tracks current state, issues, and all design decisions made
type: project
---

## Initial Review — 2026-03-18

**Reviewed:** 2026-03-18. Viewed live at localhost:5173 after clicking Scale Practice from home.

**State at initial review:** Single-column layout. 13 preset cards in a flat vertical list (~2 full screens of scrolling just to see presets). Config panel appeared at the bottom of the page after the full list.

**Critical issues identified:**
1. Config panel placement was broken — appeared at the bottom of the page, disconnected from the selected preset card
2. Flat list of 13 presets required 2+ screens of scrolling with no grouping or visual hierarchy
3. No back/home navigation visible on the setup screen
4. Font sizes were small throughout
5. The category badge on each card was redundant repetition

**Key recommendations made (initial):**
- Group presets by category with visible category headers; use a 2-column grid within each group
- Move config panel to a right-side sticky panel on desktop
- Make Basic Scale the hero entry point
- Add a back button / breadcrumb to the setup screen header
- Increase font sizes

---

## Redesign Plan — 2026-03-18 (Google / Material Design 3 direction)

**User feedback trigger:** "The card selection looks too cluttered, the config menu seems too fat. I want a clean UI that looks like something Google would have done."

**Design direction established:** Material Design 3 / Google Keep register. Lots of whitespace, light borders, clean type hierarchy, subtle elevation, soft rounded corners (12px on action buttons, 14px pill on chips). Chips for compact pickers. Compact categorized list for presets. Config panel with no card border — it is a region, not a card.

### Preset List decisions

- Replace 2-column card grid with a flat categorized list
- Each preset = 44px row, left-padded 12px, flex row: category dot (6x6px circle) + name (14px weight 500) + spacer
- No description on the row — description moves to the config panel header
- Category dot colors: Basic = accent #6366f1, Jazz = amber #f59e0b, Theory = teal #14b8a6, Technique = rose #f43f5e
- Category divider: 10px uppercase label + flex-grow horizontal rule to the right
- Selected state: left-edge 2px accent stripe via box-shadow inset + very light accent tint background + name text turns accent
- Hover state: rgba(0,0,0,0.03) background, no border
- Left column fixed width: 320px (reduced from 380px)
- Custom sequences section: same 44px row pattern; inline Edit/Delete actions visible only on row hover (opacity 0→1)
- "Create Custom Sequence" = text-only button (no border, no background), accent color, left-aligned, 13px

### Config Panel decisions

- Remove card border and background from the `.presetConfig` container entirely — it is a region, not a card
- No outer padding on the panel
- Panel header (new): preset name at 20px weight 600, description at 13px weight 400 muted, 20px margin below before sections
- Section label: 11px weight 600 uppercase letter-spacing 0.06em muted, 6px below to control
- Section-to-section gap: 18px
- Last section to Start button: 24px
- No dividers or horizontal rules between sections — whitespace only
- Sequence preview: plain inline text (no box), arrow-separated, 13px mono
- Skip transition: custom 28x16px toggle switch, no hint text
- Loop shift hint text removed (redundant)

### Chip spec (universal)

- Height: 28px
- Horizontal padding: 10px
- Border-radius: 14px (pill)
- Font: 13px weight 500
- Unselected: transparent background, 1px solid --color-border, --color-text-primary text
- Selected: --color-accent background, --color-accent border, white text
- Hover (unselected): rgba(99,102,241,0.06) background
- One-line treatment for Octaves (3 chips) and Direction (3 chips): label and chips share same horizontal line
- Loop Shift and Root Note: label above, chips wrap freely, gap 6px

### Placeholder state

- Replace arrow-and-text with centered column: 40px stroked circle icon (muted) + "Select a preset to configure" at 14px muted
- No arrow character

### Start button

- Full panel width, height 44px, border-radius 8px (not pill)
- Background: --color-accent, white text, 15px weight 600
- Hover: filter brightness(0.92)
- 24px top margin (largest gap in panel)

---

## Scale Preview Panel — Design Decision 2026-03-18

**User feedback trigger:** "The menu on the right still feels too large. The button and the metronome takes up more than half the screen. Maybe we can add a scale preview section on the right hand side instead."

**Decision: Replace the existing `.preview` sequence-step chips section with a full ScalePreview component.** The metronome is collapsed to a single compact inline row. The Start button remains full-width at the bottom. The Scale Preview occupies the reclaimed space between the config controls and the footer.

### ScalePreview component spec

**Data source:** `buildScale(step.rootNote, step.scaleTypeIndex, direction)` called on `generatedSequence.steps[previewStepIndex]`. The component holds its own `previewStepIndex` state (default 0). Called inside a `useMemo` with the step as dependency — no async needed since WASM is synchronous once loaded.

**What is displayed (per step):**
- Scale name heading: e.g. "D Dorian" — 15px weight 600 text-primary
- Step counter (multi-step only): "Step 2 of 3" — 11px uppercase muted, positioned top-right of the panel
- Root note is visually distinguished: accent fill, white text
- All other notes: outlined pill chips matching the standard chip style (28px height, 14px border-radius, 10px h-padding, 13px weight 500, border 1px --color-border, transparent background)
- Notes rendered in a single horizontal flex-wrap row, gap 6px — same chip row pattern already in use
- Below the note row: two metadata lines at 12px muted — interval formula (e.g. "W W H W W W H") and note count (e.g. "7 notes")
- Direction indicator: small arrow glyphs (↑ Up / ↓ Down / ↕ Both) shown as a dim 12px label before the note row

**Step navigation (multi-step sequences):**
- Two ghost icon buttons flanking a step label: ← [Step 1 of 7] →
- Buttons: 32x32px circle, border 1px --color-border, transparent bg, hover: --color-surface-hover
- Prev arrow disabled (opacity 0.3, not clickable) when on step 0
- Next arrow disabled when on last step
- Step label: 13px weight 500 text-secondary, centered between arrows
- When preset changes or root note changes: reset previewStepIndex to 0

**Placement within the right column:**
- Sits between the last config control (Loop Shift / Skip Transition) and the footer row
- Introduced by its own section label: "Scale Preview" — 11px weight 600 uppercase text-muted (same style as configLabel)
- No card border, no background — consistent with the borderless panel approach

**Metronome compaction:**
- Collapse the `settingsSlot` region into a single 44px row
- Row layout: toggle icon/label on the left (BPM shown inline as "120 BPM"), pencil/edit icon on the right to expand advanced settings
- When expanded: BPM slider + advanced settings appear in a collapsible block below the row (CSS max-height transition)
- This frees approximately 80-120px of vertical space that becomes the scale preview

**Footer row (Start button):**
- Remains full-width, 48px, at the very bottom of `.presetConfig`
- No change to its appearance

**Single-step sequences (Basic Scale preset):**
- Nav arrows are hidden entirely (no need to navigate)
- Step counter label hidden
- Only the note row + metadata lines render — clean, no extra chrome

**Edge cases:**
- No preset selected: placeholder state unchanged (no ScalePreview shown)
- WASM not ready or `buildScale` throws: render a single muted line "Preview not available" in place of note chips; do not throw to the UI
- Empty note array returned: same fallback as above
- Very long scales (8+ notes, e.g. BebopDominant has 8): chips wrap naturally — acceptable, do not truncate

### Typography system

- Preset list category header: 10px / 600 / uppercase / 0.08em tracking / muted
- Preset item name: 14px / 500 / text-primary
- Config panel preset name: 20px / 600 / text-primary
- Config panel description: 13px / 400 / text-muted
- Config section label: 11px / 600 / uppercase / 0.06em tracking / text-muted
- Chip text: 13px / 500
- Sequence preview: 13px / mono / text-secondary
- Start button: 15px / 600
