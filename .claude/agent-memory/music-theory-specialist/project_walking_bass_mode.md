---
name: Walking Bass Practice Mode — Theory Design
description: Music theory decisions and data model guidance for the planned Walking Bass Line practice mode
type: project
---

Walking bass practice mode is being designed for PracticeBuddy. The team lead requested a full theory specification covering patterns, progressions, voice leading, range, and pedagogy.

**Why:** Expanding beyond scale practice to cover jazz walking bass, targeting bass players doing jazz gig prep.

**How to apply:** When asked about walking bass implementation, refer to these decisions.

## Pattern Model

Patterns are 4-beat quarter-note sequences. Key design decisions:
- Beat 4 is the "approach note" — targets the next chord's root; stored relative to NEXT chord's root, not current
- Approach notes come in tiers: half-step below (-1), half-step above (+1), whole-step below (-2), dominant approach (-7), enclosure (2-beat device on beats 3-4)
- Quality-variant semitone arrays required: maj7=[0,4,7,11], dom7=[0,4,7,10], min7=[0,3,7,10], m7b5=[0,3,6,10], mMaj7=[0,3,7,11]
- Octave must be stored per note (C2 vs C3 matters for pitch detection)
- Lines should span no more than a 10th (octave + minor 3rd) within a single measure

## 10 Canonical Patterns (in pedagogical order)

1. 1-3-5-7 ascending (quality-adjusted)
2. 1-7-5-3 descending (quality-adjusted)
3. 1-2-3-5 scalar ascending
4. 1-3-5-6
5. 1-5-8-approach (octave leap then approach)
6. 1-3-♯4-5 (chromatic passing into 5th)
7. 8-7-6-5 descending from octave
8. 1-♭7-5-approach (dominant chord specific)
9. Double chromatic approach (beats 3-4 as unit)
10. Enclosure approach (beats 3-4 surround next root)

## Chord Progressions to Support

- 12-bar blues (F, Bb) — all dominant 7ths
- Bird Blues / Blues for Alice (F) — descending ii-V chain, tritone subs in bars 6-8
- ii-V-I major (C) — IIm7-V7-Imaj7
- ii-V-i minor (Cm) — IIm7b5-V7b9-Im
- Rhythm Changes (Bb) — A section dense ii-V-I; B section: D7-G7-C7-F7 (2 bars each)
- I-vi-ii-V turnaround (diatonic, secondary dominant, tritone sub variants)
- So What / modal (Dm7 Dorian 16 bars, Ebm7 Dorian 8 bars, Dm7 8 bars)
- Autumn Leaves (Gm/Bb — alternating ii-V-I in Bb major and G minor)

## Range

- 4-string bass: E1-A1-D2-G2 (open strings, scientific pitch)
- Core walking zone: A1 to D3
- Sweet spot: B1 to C3
- Default root octave for C: C2
- Flag lines spanning more than a 10th within one measure
- Confirm octave numbering convention with pitch detector implementation

## Pedagogy (5 Levels)

1. Foundation: root-5th feel, 1-3-5-7, 1-7-5-3
2. Approach notes: half-step below/above on beat 4, 1-3-5-6, scalar 1-2-3-5
3. Chromaticism: 1-3-♯4-5, 1-♭7-5-app, 8-7-6-5, whole-step approach
4. Multi-measure thinking: dominant approach, double chromatic, ii-V-I as 12-beat unit
5. Advanced: enclosure, combined patterns, Bird Blues changes
