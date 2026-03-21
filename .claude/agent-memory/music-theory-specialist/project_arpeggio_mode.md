---
name: PracticeBuddy arpeggio mode design
description: Design decisions and theory guidance for the planned Arpeggio Practice Mode, as discussed March 2026
type: project
---

The user is planning an Arpeggio Practice Mode as a third mode alongside Endless Practice (scales) and Rhythm Practice.

**Agreed arpeggio set by level:**

Beginner — triads first, then seventh chords:
- Major triad (1 3 5), Minor triad (1 b3 5), Diminished triad (1 b3 b5), Augmented triad (1 3 #5)
- Major 7th, Dominant 7th, Minor 7th, Half-Diminished (m7b5)

Intermediate additions:
- Diminished 7th (fully diminished), Minor/Major 7th (mMaj7), Dominant 7b9, Dominant 7#9, Major 6th, Minor 6th

**Practice patterns:**
- Default: root-position ascending + descending, two octaves
- Inversions (root, 1st, 2nd, 3rd) are important and unique to arpeggios
- Repetition count per chord (2 or 4 reps) before advancing — different from scale mode

**Key preset sequences:**
- Circle of fifths per chord quality (all 12 maj7, all 12 dom7, etc.)
- Diatonic 7ths within a single key (Cmaj7 → Dm7 → Em7 → Fmaj7 → G7 → Am7 → Bø7)
- ii-V-I (major): m7 → dom7 → maj7, cycling through all 12 keys
- ii-V-I (minor): m7b5 → dom7alt → m7, cycling through all 12 keys

**Critical implementation differences from scale mode:**
1. Chord symbol display (large, lead-sheet style) is the primary label — more important than in scale mode
2. Scale degree labels (R 3 5 7) on or below noteheads are pedagogically high-value
3. Inversion label must be shown clearly when practicing inversions
4. Sequential note-order detection is essential — pitch detection alone is insufficient; the validator must enforce correct order, not just correct pitches
5. Session engine must handle chord quality changes mid-sequence (ii-V-I mixes m7, dom7, maj7 qualities)
6. Accidentals per note preferred over key signature for arpeggio display (student thinks in chord tones, not key context)
7. Ledger lines above the bass clef staff are expected and normal for two-octave bass arpeggios

**Why:** Arpeggios connect directly to chord function and harmonic progressions in a way scales don't. ii-V-I arpeggio cycling is a cornerstone of jazz bass pedagogy (Rufus Reid, Simandl methods).

**How to apply:** When asked about arpeggio mode implementation details, defer to these design decisions as the agreed baseline. Flag if any new question conflicts with or extends these decisions.
