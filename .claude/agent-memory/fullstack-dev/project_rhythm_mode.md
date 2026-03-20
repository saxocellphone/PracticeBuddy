---
name: Rhythm Mode Feature
description: Rhythm Mode implementation - auto-advancing note rail practice mode with pitch and timing scoring
type: project
---

Rhythm Mode was implemented as a new practice mode alongside Endless mode.

**Why:** Users need to practice playing notes in time, not just pitch accuracy. Rhythm mode auto-advances notes at BPM tempo and grades both pitch and timing.

**How to apply:** When working on Rhythm Mode, key files are:
- `src/core/rhythm/types.ts` - NoteDuration, TimingResult, timing windows, RhythmNoteEvent, session state types, StepBoundary
- `src/hooks/useRhythmPractice.ts` - Main orchestration hook using refs + requestAnimationFrame against AudioContext.currentTime for drift-free sync
- `src/components/rhythm-practice/RhythmPracticeView.tsx` - Note rail with horizontal scrolling, playhead, beat dots, VexFlow staff notation, OSU-style hit/miss feedback
- `src/components/rhythm-practice/StaffNote.tsx` - VexFlow-rendered bass clef staff for individual notes (memo'd, renders into SVG)
- `src/components/rhythm-practice/HitMissFeedback.tsx` + `.module.css` - OSU-style expanding rings/particles for hits, shake/X for misses (CSS keyframe animations)
- `src/components/rhythm-results/RhythmResults.tsx` - Two accuracy circles (pitch + timing), timing stat breakdown
- `src/components/common/NoteDurationPicker.tsx` - Duration chip row with reactive BPM hint
- `src/components/common/TimingWindowsSettings.tsx` - Tunable perfect/good/late ms windows in AdvancedSettings

Architecture note: useRhythmPractice uses ref-based function pointers (tickRef, handleScaleCompleteRef) assigned inside useEffect to avoid circular useCallback dependencies that React 19 compiler lint disallows.

Concatenated runs: All steps in a sequence are built upfront into one continuous note array via `buildAllStepsNotes()`. `StepBoundary` tracks where each step starts/ends within the concatenated array. The tick loop updates `currentStepIndex`/`currentLabel` in `rhythmState` as the playhead crosses boundaries. `handleScaleCompleteRef` fires once per full sequence pass (not per step), splits events into per-step `RhythmScaleRunResult` entries using boundaries, then applies transpose/loop logic.

localStorage keys: `practicebuddy:rhythmDuration`, `practicebuddy:timingWindows`
