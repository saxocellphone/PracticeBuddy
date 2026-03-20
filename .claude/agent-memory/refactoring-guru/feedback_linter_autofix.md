---
name: ESLint auto-fix modifies files during runs
description: The project ESLint config auto-fixes files on lint runs, sometimes adding or removing imports and changing code structure
type: feedback
---

When running `npm run lint` or `npx eslint`, the linter may auto-fix files it processes. This includes adding missing imports or **removing imports it considers unused**. If an import references a module that doesn't exist yet (file not created), the linter will strip both the import and any code that references the imported names.

**Why:** Observed during rhythm refactoring - the linter silently modified files between edit and verification steps. When adding imports for a component whose file hadn't been created yet, the linter removed the import AND stripped the JSX/state code that referenced it.

**How to apply:**
- When adding imports for new files, create the target file FIRST before editing the importing file.
- If multiple interdependent edits are needed, prefer using the Write tool to write the complete file atomically rather than incremental Edit calls, so the linter sees a consistent state.
- After any lint run, re-read files before making further edits.
