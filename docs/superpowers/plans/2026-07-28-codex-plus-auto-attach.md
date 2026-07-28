# Codex++ Auto Attach Implementation Plan

> For agentic workers: use an implementation workflow task by task and track checkbox progress.

**Goal:** In Codex++-started Codex instances that expose loopback port 9229, automatically attach and inject the selected theme without requiring the Manager themed-launch button.

**Architecture:** A small CodexPlusAutoAttachCoordinator polls only loopback port 9229 while a selected theme is pending and CDP is disconnected. It delegates to the existing ThemeRuntimeCoordinator start path, so attachment, injection, and rollback remain centralized. The verified 26.721.4979.0 package gets a version-specific adapter with the existing, read-only-probed shell anchors.

**Tech Stack:** Electron, TypeScript, CDP, Vitest

---

### Task 1: Verify the current Codex version adapter

**Files:**
- Modify: src/core/theme-runtime/codex-version-adapter.ts
- Modify: tests/unit/codex-version-adapter.test.ts

- [ ] Add a failing test that expects 26.721.4979.0 to resolve to a dedicated adapter ID and verified shell anchors.
- [ ] Run the focused adapter test and verify it fails because the adapter is absent.
- [ ] Add codex-26.721.4979, using the observed header, sidebar, main, composer, and project-selector anchors.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Add the automatic attachment coordinator

**Files:**
- Create: src/core/runtime/codex-plus-auto-attach.ts
- Create: tests/unit/codex-plus-auto-attach.test.ts

- [ ] Add failing tests for an immediate port-9229 attachment when a theme is pending and CDP is disconnected.
- [ ] Add failing tests that no theme, an active CDP session, or an unsupported package version does not trigger attachment.
- [ ] Add a failing test that stopping clears the polling interval.
- [ ] Implement the coordinator with injected theme, runtime-state, package-version, and attach functions. It may only attach while theme is pending and CDP is disconnected, and must serialize concurrent attempts.
- [ ] Run the focused coordinator test and verify it passes.

### Task 3: Wire automatic attachment into the Electron main process

**Files:**
- Modify: src/main.ts

- [ ] Create the coordinator after ManagerService, ThemeRuntimeCoordinator, and WindowsCodexIdentity initialize.
- [ ] Delegate attachment to startThemeRuntime with port 9229 rather than creating a second injection path.
- [ ] Start it once the application is ready; stop it when restoring defaults and before process exit.
- [ ] Run the affected tests and TypeScript type checking.

### Task 4: Verify the complete flow

**Files:**
- Verify: automatic attachment files

- [ ] Run the full tests, type check, lint, and diff check.
- [ ] With Codex++ exposing loopback port 9229, start the Manager and confirm the diagnostic state becomes applied and connected without restarting Codex.
- [ ] Package the application and verify the packaged executable starts.
