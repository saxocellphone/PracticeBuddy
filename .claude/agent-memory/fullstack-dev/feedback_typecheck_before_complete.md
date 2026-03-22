---
name: Always type-check before marking tasks complete
description: Run npx tsc --noEmit before marking any task as completed to catch compile errors
type: feedback
---

Always run `npx tsc --noEmit` before marking a task as completed.

**Why:** During task #4 (metronome checkbox removal), broken references to removed state variables were left in App.tsx. The app wouldn't compile. The team lead had to fix the remaining spots manually.

**How to apply:** After making edits — especially when removing state, props, or variables — run the TypeScript compiler in check mode (`npx tsc --noEmit`) before reporting the task as done. This catches dangling references that are easy to miss when editing a large file.
