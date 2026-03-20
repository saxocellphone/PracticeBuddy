---
name: Rhythm practice mode architecture
description: Code organization of the rhythm practice feature - hooks, core modules, components, and extraction patterns used
type: project
---

Rhythm practice mode spans several areas:
- **Hook**: `src/hooks/useRhythmPractice.ts` - main session orchestration (was 665 lines, reduced to ~564 after extracting evaluation logic)
- **Core modules**: `src/core/rhythm/` contains types.ts, sequence.ts, stats.ts, and evaluation.ts (new)
- **Components**: `src/components/rhythm-practice/` (RhythmPracticeView, StaffNote, HitMissFeedback) and `src/components/rhythm-results/` (RhythmResults)

**Why:** The hook uses a ref-heavy pattern to manage real-time audio state outside React's render cycle. Pure evaluation logic (pitch matching, note scoring, live feedback computation) was extracted to `evaluation.ts` since it doesn't depend on React state.

**How to apply:** When refactoring hooks with ref-heavy real-time patterns, look for pure functions that read ref values — these can be extracted by passing ref values as parameters. The `evaluateCurrentNote` thin wrapper pattern keeps call sites clean while enabling extraction.
