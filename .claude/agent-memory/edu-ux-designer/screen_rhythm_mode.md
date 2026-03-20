---
name: Rhythm Mode Design Spec
description: Full UX/UI design spec for Rhythm Mode — setup addition, practice view, and results additions. Designed 2026-03-19.
type: project
---

Rhythm Mode is a time-keeping practice mode where the score advances automatically at BPM and the user is scored on both pitch and timing accuracy.

**Key design decisions:**
- Note Duration picker uses the established chip pattern, placed above the metronome row in the middle column
- Practice view uses a horizontal scrolling note rail as the primary metaphor — not a list, not a grid
- Timing feedback is shown as a colored badge on each note cell as it passes the playhead, not as text overlays mid-screen
- The "perfect/good/late/missed" vocabulary is kept consistent between the practice view badges and the results screen
- Results screen adds a second circle for Timing alongside the existing Pitch Accuracy circle — same visual language, no redesign
- The note duration symbols use standard music notation glyphs (whole/half/quarter/eighth/sixteenth) to reinforce music literacy

**Why note durations are NOT in AdvancedSettings:**
Duration is a primary, session-defining choice — not a tuning parameter. It belongs in the main config flow alongside Octaves and Direction, not hidden behind a disclosure.

**Why a horizontal rail and not a vertical list:**
Bass players already read music left-to-right. The rail mirrors sight-reading and makes "what comes next" spatially obvious without reading. The playhead metaphor is borrowed from DAW/tab software that the target audience already knows.
