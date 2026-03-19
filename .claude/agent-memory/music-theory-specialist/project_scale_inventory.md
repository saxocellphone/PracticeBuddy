---
name: PracticeBuddy scale inventory
description: Current scale types supported in the Rust/WASM layer and preset sequences available in presets.ts, as of initial review
type: project
---

**Scale types defined in Rust (ScaleType enum), exposed via WASM (index order in presets.ts SCALE constant):**
- 0 Major
- 1 NaturalMinor
- 2 HarmonicMinor
- 3 MelodicMinor (ascending jazz melodic minor only — not confirmed if Rust uses bidirectional classical form)
- 4 Dorian
- 5 Phrygian
- 6 Lydian
- 7 Mixolydian
- 8 Locrian
- 9 MajorPentatonic
- 10 MinorPentatonic
- 11 Blues

**Presets in presets.ts:**
- basic-scale: single scale, any type, any key, any direction
- jazz-ii-v-i: Dorian (ii) → Mixolydian (V) → Major (I), transposable, shifts by 7 semitones (circle of 5ths) each loop
- circle-of-fifths-major: all 12 major scales around the circle of fifths from a chosen root
- relative-major-minor: Major + its relative NaturalMinor, shifts by 1 semitone each loop
- mode-workout: all 7 diatonic modes from same root, shifts by 1 semitone each loop
- pentatonic-pairs: MajorPentatonic + MinorPentatonic from same root, shifts by 2 semitones each loop

**Missing scales/modes (no Rust enum values exist for these):**
- Lydian Dominant (4th mode of melodic minor) — critical for jazz
- Altered scale / Super Locrian (7th mode of melodic minor) — critical for jazz
- Phrygian Dominant (5th mode of harmonic minor) — common in Latin/flamenco jazz
- Half-Whole Diminished (symmetric) — used on dom7 chords
- Whole-Tone (symmetric) — used on dom7(#5) or dom7(b5) chords
- Bebop Dominant (Mixolydian + passing tone between b7 and root)
- Bebop Major (Major + passing tone between 5 and 6)
- Dorian b2 / Phrygian natural 6 (2nd mode of melodic minor)
- Lydian Augmented (3rd mode of melodic minor)
- Locrian natural 2 / Half-Diminished (6th mode of melodic minor)

**Why:** These are the scales most commonly taught in jazz curriculum alongside the diatonic modes. The melodic minor modes in particular are foundational for modern jazz improvisation and the app currently only surfaces the scale itself, not its modes.

**How to apply:** When asked about jazz scale additions or new presets, recommend adding at minimum: Lydian Dominant, Altered scale, Half-Whole Diminished, Whole-Tone, and Bebop Dominant to the Rust enum, then build new presets around them.
