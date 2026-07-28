# Image Prompt Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Give theme-library users copyable image-generation prompts that preserve Codex UI readability.

**Architecture:** A self-contained renderer component owns the four static prompts and clipboard feedback. `App` places it beside the theme grid, while CSS makes the panel stack below the grid at narrower widths.

**Tech Stack:** React, TypeScript, Lucide React, Vitest, JSDOM.

---

### Task 1: Prove prompt list and copy interaction

**Files:**
- Create: `tests/unit/image-prompt-examples.test.tsx`
- Create: `src/renderer/ImagePromptExamples.tsx`

- [ ] **Step 1: Write the failing test**

Render `ImagePromptExamples`, assert all four prompt labels exist, click the first copy icon, and assert `navigator.clipboard.writeText` receives a prompt containing `16:9`.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/unit/image-prompt-examples.test.tsx`
Expected: FAIL because the component does not exist.

### Task 2: Add the bounded prompt panel

**Files:**
- Create: `src/renderer/ImagePromptExamples.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/image-prompt-examples.test.tsx`

- [ ] **Step 1: Implement the prompt component**

Keep the prompts static and local. Use an icon-only button with a tooltip, clipboard write call, and temporary success icon.

- [ ] **Step 2: Place the panel beside the theme grid**

Wrap the grid and prompt panel in one layout container shown only while image-source and image-editor flows are closed.

- [ ] **Step 3: Add responsive layout rules**

Use a fixed, constrained panel column on wide windows and a single column below 1180px.

- [ ] **Step 4: Run focused test**

Run: `npm test -- tests/unit/image-prompt-examples.test.tsx`
Expected: PASS.

### Task 3: Verify renderer and package

**Files:**
- Verify: `src/renderer/App.tsx`
- Verify: `src/renderer/ImagePromptExamples.tsx`

- [ ] **Step 1: Run full verification**

Run: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run package`.

- [ ] **Step 2: Launch the packaged manager**

Confirm the executable starts after packaging.
