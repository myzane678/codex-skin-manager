# Theme Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Allow every installed theme to be renamed while keeping its manifest, installed metadata, and exported package consistent.

**Architecture:** Add a storage operation that validates the existing installed theme, rebuilds a ZIP from only its manifest-declared resources, and atomically replaces all name-bearing files. Expose it through a validated IPC method and a compact inline editor in each theme card. IDs, versions, resources and enablement remain unchanged.

**Tech Stack:** Electron IPC, TypeScript, React, Vitest, `yazl`, `yauzl`, Node.js filesystem promises.

---

### Task 1: Add verified service-level theme rename persistence

**Files:**
- Modify: `src/core/storage/theme-storage.ts`
- Modify: `src/core/manager-service.ts`
- Modify: `src/core/theme-package/import-theme.ts`
- Test: `tests/unit/manager-service.test.ts`

- [ ] **Step 1: Write the failing rename persistence test**

Add a test that imports `themes/amber-workbench.codextheme`, enables it, calls `manager.renameTheme('amber-workbench', '1.0.0', 'Evening Workbench')`, and asserts the snapshot is active with the new name. Read the installed `manifest.json` and `.installed.json`, export the package, import it into a second manager, and assert all three surfaces use `Evening Workbench`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: FAIL because `renameTheme` does not exist.

- [ ] **Step 3: Add a ZIP rebuild helper for declared theme resources**

In `import-theme.ts`, export a helper that receives an already parsed manifest and a map of declared resource buffers, writes only `manifest.json`, `manifest.preview.path`, and each declared asset path through `yazl`, and resolves only once the output stream closes. This helper must not add unlisted files.

- [ ] **Step 4: Implement atomic storage rename**

Add `ThemeStorage.renameTheme(theme, name)`. Reject a trimmed empty or over-80-character name with `THEME_NAME_INVALID`; read and parse `manifest.json`, confirm its `id` and `version` match `theme`, clone it with the trimmed name, and read exactly the declared preview and assets. Build a temporary archive and temporary manifest/metadata files. Replace `manifest.json`, `.installed.json`, and `package.codextheme` only after preparation succeeds; restore original bytes if any replacement fails. Return updated `InstalledTheme` with the new name and new archive hash.

- [ ] **Step 5: Implement the manager boundary**

Add `ManagerService.renameTheme(id, version, name)`, locate the installed theme with `findTheme`, delegate to storage, and return `snapshot()`. Do not change current theme config or runtime state.

- [ ] **Step 6: Run the focused test to verify it passes**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: PASS, including export/import assertion.

### Task 2: Add validation and the renderer-to-main rename IPC

**Files:**
- Modify: `src/main.ts`
- Modify: `src/preload.ts`
- Test: `tests/unit/main-image-ipc.test.ts`

- [ ] **Step 1: Write failing IPC tests**

Add tests that load the main IPC registration with a mocked `ManagerService`, invoke `theme:rename` with `{ id: 'amber-workbench', version: '1.0.0' }` and `Evening Workbench`, and assert `manager.renameTheme` gets those values. Add invalid cases for missing identity, whitespace-only name, and 81-character name, each expecting `IPC_ARGUMENT_INVALID`.

- [ ] **Step 2: Run focused IPC tests to verify RED**

Run: `npm test -- tests/unit/main-image-ipc.test.ts`

Expected: FAIL because `theme:rename` is not registered.

- [ ] **Step 3: Implement the narrow IPC bridge**

Add `isThemeName(value)` in `main.ts` that accepts only strings whose trimmed length is 1 through 80. Register `theme:rename`, validate identity and name, and call `manager.renameTheme(identity.id, identity.version, name)`. Add `renameTheme(identity, name)` to `CodexSkinApi` and invoke `theme:rename` from preload.

- [ ] **Step 4: Run focused IPC tests to verify GREEN**

Run: `npm test -- tests/unit/main-image-ipc.test.ts`

Expected: PASS.

### Task 3: Add the card-level inline rename interaction

**Files:**
- Modify: `src/renderer/ThemeCard.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/theme-card.test.tsx`

- [ ] **Step 1: Write the failing theme-card test**

Create `theme-card.test.tsx` that renders a theme card, opens the rename editor through its labelled icon button, confirms the name field starts at the current name, rejects a whitespace-only submission, calls `onRename('Evening Workbench')` on valid save, and confirms Escape cancels without calling it.

- [ ] **Step 2: Run the card test to verify RED**

Run: `npm test -- tests/unit/theme-card.test.tsx`

Expected: FAIL because the rename action and inline editor do not exist.

- [ ] **Step 3: Implement the smallest inline editor**

Add an `Edit3` icon action and internal editing state to `ThemeCard`. Prepopulate the input, disable save when `trim()` is empty or over 80 characters or the card is busy, use a form submit handler to call `onRename(trimmedName)`, make cancel and Escape restore display mode, and keep existing enable, export, and delete behavior unchanged. In `App.tsx`, pass `onRename={(name) => void run(() => window.codexSkin.renameTheme(identity(theme), name))}`. Add scoped CSS for the inline input and Save/Cancel controls.

- [ ] **Step 4: Run the card test to verify GREEN**

Run: `npm test -- tests/unit/theme-card.test.tsx`

Expected: PASS.

### Task 4: Validate the whole change

**Files:**
- Verify: all changed files

- [ ] **Step 1: Run targeted test set**

Run: `npm test -- tests/unit/manager-service.test.ts tests/unit/main-image-ipc.test.ts tests/unit/theme-card.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run static validation and full tests**

Run: `npm run typecheck; npm run lint; npm test -- --run`

Expected: all commands exit 0.

- [ ] **Step 3: Run package build and diff check**

Run: `npm run package; git diff --check`

Expected: package succeeds and diff check emits no whitespace errors.
