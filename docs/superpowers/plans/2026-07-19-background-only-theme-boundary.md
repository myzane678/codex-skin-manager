# Background-Only Theme Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Make every theme background-only so Codex retains its native layout, typography, colors, and controls.

**Architecture:** Keep manifest parsing and validation compatible, but narrow runtime compilation to a small, fixed stylesheet that only paints local image backgrounds on verified shell anchors. Plain themes become visual no-ops, and the runtime no longer appends welcome decorations.

**Tech Stack:** TypeScript, Vitest, Electron CDP runtime, CSS

---

### Task 1: Encode the global boundary

**Files:**
- Modify: `tests/unit/compiler.test.ts`

- [ ] Add assertions that plain themes compile to empty CSS and no decoration.
- [ ] Add assertions that image themes contain only approved background declarations and stable shell selectors.
- [ ] Run `npm test -- --run tests/unit/compiler.test.ts` and confirm the new assertions fail against the existing broad theme CSS.

### Task 2: Narrow runtime compilation

**Files:**
- Modify: `src/core/theme-runtime/compiler.ts`
- Modify: `src/core/theme-runtime/dream-skin-css.ts`

- [ ] Remove plain-theme accent strips, shell recoloring, text recoloring, and welcome decorations from the compiled plan.
- [ ] Replace the broad Dream Skin stylesheet with fixed background-only rules for verified home and task shell anchors.
- [ ] Preserve local data URL validation, focus coordinates, image layout, safe area, task mode, and legacy shell validation.
- [ ] Run `npm test -- --run tests/unit/compiler.test.ts` and confirm the compiler tests pass.

### Task 3: Verify compatibility

**Files:**
- Test: `tests/unit/compiler.test.ts`
- Test: `tests/unit/injection-runtime.test.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test -- --run`.
- [ ] Run `git diff --check`.
- [ ] Inspect the final diff and confirm every changed production line enforces the background-only boundary.
