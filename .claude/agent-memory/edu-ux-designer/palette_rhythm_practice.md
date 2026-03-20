---
name: Rhythm Practice Color Palette
description: "Deep Stage" color palette designed for RhythmPracticeView — all hex values, rationale, and state colors. Designed 2026-03-19.
type: project
---

Theme concept: "Deep Stage" — concert stage at night. Deep blue-purple environment, warm amber for beat/tempo, electric lime for position/active, cool neon feedback colors.

**Primary accent shift:** Electric Lime (#a3e635) replaces Indigo (#6366f1) as the active/playhead accent. Indigo becomes a structural/border color only. Amber (#f59e0b) owns beat/tempo signals.

## Environment

- Page background: `#0b0d1a`
- Rail container background: `#07080f`
- Rail container border: `#1a1c2e`

## Note Cells

- Note cell background: `#181a2e`
- Note cell border (right): `#2e3058`
- Active cell background: `#21234a`
- Active cell accent border: `#a3e635` (electric lime)
- Active cell box-shadow: `rgba(163, 230, 53, 0.25)`
- Past cell background: `#0e0f1c`
- Past cell opacity: `0.5`

## Playhead

- Color: `#a3e635` (electric lime)
- Glow: `box-shadow: 0 0 12px rgba(163, 230, 53, 0.7)`

## Beat Dots

- Inactive: `#1e2038`
- Active: `#f59e0b` (amber)
- Active scale: 1.4 (unchanged)

## Countdown Dots

- Background: `#1c1e3a`
- Border: `#2e3058`
- Lit background: `#f59e0b`
- Lit border: `#fbbf24`
- Lit box-shadow: `rgba(245, 158, 11, 0.65)`

## VexFlow Staff Color

- Normal: `#eef0d4` (warm white with slight yellow cast — harmonizes with lime accents)
- Dimmed opacity: 0.4 (existing approach, keep)
- Contrast vs cell bg (#181a2e): ~13.5:1

## Text Elements

- Note name label: `#7b7fa8` (lifted from muted — contrast ~4.6:1 on cell bg)
- Time signature: `#a8aac8`
- Scale label: `#e8e8f0` (unchanged)
- Scale meta: `#7b7fa8`
- Pitch flat/sharp labels: `#7b7fa8`
- Detected note name: `#e8e8f0`

## Pitch Display

- Pitch bar background: `#1e2038`
- Pitch center line: `#4a4e70`
- Pitch needle: `#a3e635` (lime — same as playhead, both mean "current position")

## Timing Feedback States

| State   | Label    | Ring/Flash | Particle   | Flash BG overlay            |
|---------|----------|------------|------------|-----------------------------|
| Perfect | #4ade80  | #4ade80    | #86efac    | rgba(74, 222, 128, 0.18)   |
| Good    | #22d3ee  | #22d3ee    | #67e8f9    | rgba(34, 211, 238, 0.15)   |
| Late    | #fb923c  | #fb923c    | #fdba74    | rgba(251, 146, 60, 0.14)   |
| Missed  | #f87171  | #f87171    | #fca5a5    | rgba(248, 113, 113, 0.14)  |

Note: Late changed from amber to orange (#fb923c) to avoid collision with beat-dot amber.
Note: Missed softened from #ef4444 to #f87171 — less punishing for young learners.

## Badge chip variants (timingBadge_*)

- Perfect: bg rgba(74,222,128,0.2), text #4ade80
- Good: bg rgba(34,211,238,0.2), text #22d3ee
- Late: bg rgba(251,146,60,0.2), text #fb923c
- Missed: bg rgba(248,113,113,0.2), text #f87171

## Why this matters

**Why:** Dark-only near-black palette with indigo accents reads as developer tool, not music game.
The "Deep Stage" approach matches the visual language of Taiko no Tatsujin, Guitar Hero, osu!, Rhythm Heaven — all use saturated, high-luminance accents on dark backgrounds.

**How to apply:** Always use lime for position/active signals, amber for tempo/beat signals. These two must never swap or merge — their semantic separation is load-bearing.
