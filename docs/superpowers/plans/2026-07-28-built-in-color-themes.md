# Built-in Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Make no-background built-in themes visibly recolor the verified Codex shell.

**Architecture:** `compileInjectionPlan` selects a small color-only stylesheet when a theme has no background. Image themes retain the existing Dream Skin compilation branch.

**Tech Stack:** TypeScript, Vitest, Electron CDP injection runtime.

---

### Task 1: Prove color-only compilation

**Files:**
- Modify: `tests/unit/compiler.test.ts`

- [ ] **Step 1: Write the failing test**

Assert a no-background theme produces nonempty CSS containing its accent, the verified `aside.app-shell-left-panel` and `main.main-surface` selectors, and no image URL.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/unit/compiler.test.ts`
Expected: FAIL because no-background themes currently compile to an empty stylesheet.

### Task 2: Compile controlled color-only CSS

**Files:**
- Modify: `src/core/theme-runtime/compiler.ts`
- Test: `tests/unit/compiler.test.ts`

- [ ] **Step 1: Add the minimum color stylesheet compiler**

Use only `variables.accent` and existing verified shell selectors. Keep the image-theme compiler branch unchanged.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/unit/compiler.test.ts`
Expected: PASS.

### Task 3: Verify and package

**Files:**
- Verify: `src/core/theme-runtime/compiler.ts`

- [ ] **Step 1: Run full verification**

Run: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run package`.

- [ ] **Step 2: Verify an existing Codex++ page**

Switch to an internal theme and confirm the injected style has nonzero text length through the existing loopback CDP connection.
