# Stable Theme Root Attributes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Prevent Codex root-class reconciliation from disabling an active image theme during task navigation and message submission.

**Architecture:** Keep the existing runtime and style node, but express every root-level Dream Skin state through the stable `data-codex-skin-*` attributes already owned by the injector. Stop using Codex-managed `documentElement.className` as theme state; retain route element classes only where they describe route nodes.

**Tech Stack:** TypeScript, JSDOM, Vitest, Electron Forge, CDP runtime verification.

---

### Task 1: Capture the root-class regression in tests

**Files:**
- Modify: `tests/unit/compiler.test.ts`
- Modify: `tests/unit/injection-runtime.test.ts`

- [ ] Replace image-theme selector expectations with `data-codex-skin-*` attribute selectors.
- [ ] Add a runtime test that simulates Codex replacing `documentElement.className` and verifies theme attributes remain authoritative.
- [ ] Run `npm test -- tests/unit/compiler.test.ts tests/unit/injection-runtime.test.ts` and confirm the new expectations fail against the class-based implementation.

### Task 2: Move image theme state to stable attributes

**Files:**
- Modify: `src/core/theme-runtime/dream-skin-css.ts`
- Modify: `src/core/theme-runtime/compiler.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`

- [ ] Scope Dream Skin rules with `html[data-codex-skin]`.
- [ ] Replace appearance, image layout, and task mode root classes with their existing attributes plus `data-codex-skin-appearance`.
- [ ] Stop adding theme-control classes to `documentElement`; remove the appearance attribute during cleanup and rollback.
- [ ] Preserve cleanup of legacy root classes so an upgrade cannot leave stale state behind.
- [ ] Run the two focused test files and confirm they pass.

### Task 3: Version and verify the release candidate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] Bump the application version from `0.1.4` to `0.1.5` without changing dependency versions.
- [ ] Add a concise `0.1.5` changelog entry describing the verified root-class conflict and attribute-based fix.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Build with `npm run make`; verify the installer exists and the packaged `app.asar` reports `0.1.5`.
- [ ] Apply the development build to the real renderer and repeat task switching and Enter submission while checking that theme selectors stay active.
