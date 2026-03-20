---
name: Metronome look-ahead timing requires clamping
description: MetronomeEngine notifies beat callbacks up to 100ms BEFORE the beat actually sounds due to Web Audio look-ahead scheduling -- any code using the scheduled time as a reference must clamp ctx.currentTime to avoid negative elapsed values
type: feedback
---

When using scheduled beat times from MetronomeEngine as timing anchors (e.g., startTimeRef in rhythm practice), always clamp `ctx.currentTime` to be >= the scheduled reference time. The metronome's look-ahead scheduling (SCHEDULE_AHEAD_TIME = 100ms) means JS callbacks fire before the audio click sounds, so `ctx.currentTime` can be less than the scheduled time for the first few RAF frames after a transition.

**Why:** Without clamping, `elapsed = now - startTime` goes negative, causing the playhead to jump to a negative scroll position (visual offset) and pitch detection timing offsets to be incorrectly computed.

**How to apply:** Any time a metronome `onBeat` scheduled time is used as a reference point for real-time calculations (RAF loops, pitch detection), wrap `ctx.currentTime` in `Math.max(ctx.currentTime, referenceTime)`. This applies to both the tick loop and the processFrame callback in useRhythmPractice.
