import type { PGlite } from "@electric-sql/pglite";
import type { JazzStandardMeasure } from "@core/jazz-standards/types.ts";

// "There Will Never Be Another You" — Harry Warren / Mack Gordon (1942)
// Key: Eb major | 4/4 | 32 bars ABAC | Treble clef
// Melody transcribed from standard lead sheet (Swiss Jazz / Real Book)
//
// IMPORTANT: Bar 0 is a pickup measure (1 beat). Bar 32 is shortened (3 beats)
// to compensate. Together they form one complete measure.
//
// Each measure's melody events total exactly 4 beats, except:
//   - Bar 0 (pickup): 1 beat
//   - Bar 32 (final): 3 beats

const MEASURES: JazzStandardMeasure[] = [
  // ── PICKUP (1 beat) ────────────────────────────────────────────────────────

  // Bar 0 — pickup into bar 1
  {
    chords: [],
    pickup: true,
    melody: [
      { type: "note", pitchClass: "Bb", octave: 4, duration: "quarter" },
    ],
  },

  // ── A SECTION (bars 1–8) ───────────────────────────────────────────────────

  // Bar 1 — EbMaj7
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "D", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 2 — EbMaj7 (%)
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "B", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 3 — Dm7b5
  {
    chords: [{ symbol: "Dm7b5", root: "D", quality: "m7b5", beat: 1 }],
    melody: [{ type: "note", pitchClass: "F", octave: 5, duration: "whole" }],
  },

  // Bar 4 — G7b9
  {
    chords: [{ symbol: "G7b9", root: "G", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "F", octave: 5, duration: "half" },
      { type: "rest", duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 5 — Cm7
  {
    chords: [{ symbol: "Cm7", root: "C", quality: "min7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 6 — Bbm7
  {
    chords: [{ symbol: "Bbm7", root: "Bb", quality: "min7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 7 — Eb7
  {
    chords: [{ symbol: "Eb7", root: "Eb", quality: "dom7", beat: 1 }],
    melody: [{ type: "note", pitchClass: "C", octave: 6, duration: "whole" }],
  },

  // Bar 8 — (Eb7 cont.)
  {
    chords: [{ symbol: "Eb7", root: "Eb", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 6, duration: "half" },
      { type: "rest", duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // ── B SECTION (bars 9–16) ──────────────────────────────────────────────────

  // Bar 9 — AbMaj7
  {
    chords: [{ symbol: "AbMaj7", root: "Ab", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Eb", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 10 — Fm7b5 (beat 1) + Bb7 (beat 3)
  {
    chords: [
      { symbol: "Fm7b5", root: "F", quality: "m7b5", beat: 1 },
      { symbol: "Bb7", root: "Bb", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 11 — EbMaj7
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 12 — Cm7
  {
    chords: [{ symbol: "Cm7", root: "C", quality: "min7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "dotted-quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "eighth" },
    ],
  },

  // Bar 13 — F7 (A natural = major 3rd of F7)
  {
    chords: [{ symbol: "F7", root: "F", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "D", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 14 — Cm7 (beat 1) + F7 (beat 3)
  {
    chords: [
      { symbol: "Cm7", root: "C", quality: "min7", beat: 1 },
      { symbol: "F7", root: "F", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 15 — Fm7
  {
    chords: [{ symbol: "Fm7", root: "F", quality: "min7", beat: 1 }],
    melody: [{ type: "note", pitchClass: "Ab", octave: 5, duration: "whole" }],
  },

  // Bar 16 — Bb7
  {
    chords: [{ symbol: "Bb7", root: "Bb", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Ab", octave: 5, duration: "half" },
      { type: "rest", duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 4, duration: "quarter" },
    ],
  },

  // ── A SECTION REPEAT (bars 17–24) — same melody as bars 1–8 ──────────────

  // Bar 17 — EbMaj7
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "D", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 18 — EbMaj7 (%)
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 19 — Dm7b5
  {
    chords: [{ symbol: "Dm7b5", root: "D", quality: "m7b5", beat: 1 }],
    melody: [{ type: "note", pitchClass: "F", octave: 5, duration: "whole" }],
  },

  // Bar 20 — G7b9
  {
    chords: [{ symbol: "G7b9", root: "G", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "F", octave: 5, duration: "half" },
      { type: "rest", duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 21 — Cm7
  {
    chords: [{ symbol: "Cm7", root: "C", quality: "min7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 22 — Bbm7
  {
    chords: [{ symbol: "Bbm7", root: "Bb", quality: "min7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 23 — Eb7
  {
    chords: [{ symbol: "Eb7", root: "Eb", quality: "dom7", beat: 1 }],
    melody: [{ type: "note", pitchClass: "C", octave: 6, duration: "whole" }],
  },

  // Bar 24 — (Eb7 cont.)
  {
    chords: [{ symbol: "Eb7", root: "Eb", quality: "dom7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "C", octave: 6, duration: "half" },
      { type: "rest", duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
    ],
  },

  // ── C SECTION (bars 25–32) ─────────────────────────────────────────────────

  // Bar 25 — AbMaj7
  {
    chords: [{ symbol: "AbMaj7", root: "Ab", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Eb", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 26 — Fm7b5 (beat 1) + Bb7 (beat 3)
  {
    chords: [
      { symbol: "Fm7b5", root: "F", quality: "m7b5", beat: 1 },
      { symbol: "Bb7", root: "Bb", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 27 — EbMaj7
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "G", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 28 — Gm7 (beat 1) + C7#5 (beat 3)
  {
    chords: [
      { symbol: "Gm7", root: "G", quality: "min7", beat: 1 },
      { symbol: "C7#5", root: "C", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "D", octave: 6, duration: "dotted-half" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
    ],
  },

  // Bar 29 — EbMaj7 (beat 1) + D7 (beat 3)
  {
    chords: [
      { symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 },
      { symbol: "D7", root: "D", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Eb", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "D", octave: 6, duration: "quarter" },
      { type: "note", pitchClass: "C", octave: 6, duration: "quarter" },
    ],
  },

  // Bar 30 — G7#9 (beat 1) + C7#5 (beat 3)
  {
    chords: [
      { symbol: "G7#9", root: "G", quality: "dom7", beat: 1 },
      { symbol: "C7#5", root: "C", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "F", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Bb", octave: 5, duration: "quarter" },
      { type: "note", pitchClass: "Ab", octave: 5, duration: "quarter" },
    ],
  },

  // Bar 31 — Fm7 (beat 1) + Bb13(b9) (beat 3)
  {
    chords: [
      { symbol: "Fm7", root: "F", quality: "min7", beat: 1 },
      { symbol: "Bb13(b9)", root: "Bb", quality: "dom7", beat: 3 },
    ],
    melody: [
      { type: "note", pitchClass: "F", octave: 5, duration: "half" },
      { type: "note", pitchClass: "G", octave: 5, duration: "half" },
    ],
  },

  // Bar 32 — EbMaj7
  {
    chords: [{ symbol: "EbMaj7", root: "Eb", quality: "maj7", beat: 1 }],
    melody: [{ type: "note", pitchClass: "Eb", octave: 5, duration: "whole" }],
  },
];

export async function seedJazzStandards(db: PGlite): Promise<void> {
  await db.query(
    `INSERT INTO jazz_standards (id, title, composer, key, time_sig_beats, time_sig_value, tempo, form, melody_clef, tags, measures)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET measures = $11`,
    [
      "there-will-never-be-another-you",
      "There Will Never Be Another You",
      "Harry Warren",
      "Eb",
      4,
      4,
      144,
      "ABAC",
      "treble",
      ["standard", "swing"],
      JSON.stringify(MEASURES),
    ],
  );
}
