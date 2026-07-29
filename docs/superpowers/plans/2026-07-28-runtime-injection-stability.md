# Runtime Injection Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Make the existing CDP theme coordinator recover from early-injection failures, lost renderer state, and replacement page targets.

**Architecture:** Extend the existing coordinator and injection port with a small run audit and a load fallback. Preserve the current single-session ownership model and version-adapter fail-closed checks.

**Tech Stack:** TypeScript, Electron, Vitest, Chrome DevTools Protocol.

---

### Task 1: Prove Recovery Behavior

**Files:**
- Modify: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] **Step 1: Write failing early-script fallback tests**

Add a test where `installEarly` rejects and assert `apply` still runs and a later load event reapplies the plan.

- [ ] **Step 2: Write failing audit and target replacement tests**

Add a test for a missing active run and a test where the original target disappears but a verified replacement target becomes available.

- [ ] **Step 3: Run the focused test file**

Run: `npm test -- tests/unit/theme-runtime-coordinator.test.ts`
Expected: new tests fail because the coordinator treats early-script failure as terminal and clears the heartbeat on disconnect.

### Task 2: Add Minimal Coordinator Recovery

**Files:**
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] **Step 1: Add a non-fatal early-script fallback and audit port**

Make early-script registration optional for a live run. Add audit support that confirms the current run remains installed before reporting `applied`.

- [ ] **Step 2: Keep the heartbeat across target loss**

On target/session loss, retain configured runtime inputs and select a replacement target under the existing browser identity during the next refresh.

- [ ] **Step 3: Run the focused test file**

Run: `npm test -- tests/unit/theme-runtime-coordinator.test.ts`
Expected: all coordinator tests pass.

### Task 3: Verify Regression Surface

**Files:**
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] **Step 1: Run targeted injection tests**

Run: `npm test -- tests/unit/theme-runtime-coordinator.test.ts tests/unit/injection-runtime.test.ts`
Expected: pass.

- [ ] **Step 2: Run full checks**

Run: `npm test; npm run typecheck; npm run lint; git diff --check`
Expected: all commands exit with code 0.
