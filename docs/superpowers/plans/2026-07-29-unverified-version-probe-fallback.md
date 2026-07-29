# 未验证 Codex 版本探针回退实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 让未知 Codex 版本在实时 DOM 探针通过后继续注入主题，并在客户端常驻提示未验证状态。

**Architecture:** 保留现有版本适配器和单一注入协调器。版本选择返回最新适配器及验证标记，CDP 探针继续承担注入准入；运行时快照独立传播兼容性状态供客户端展示。

**Tech Stack:** TypeScript、Electron、React、CDP、Vitest。

---

### Task 1: 版本回退选择

**Files:**
- Modify: `src/core/theme-runtime/codex-version-adapter.ts`
- Test: `tests/unit/codex-version-adapter.test.ts`

- [ ] 添加失败测试：精确版本返回 `verified`，未知版本返回最新适配器和 `unverified`。
- [ ] 运行 `npm test -- tests/unit/codex-version-adapter.test.ts`，确认新断言失败。
- [ ] 添加最小版本选择函数，不改变现有选择器。
- [ ] 重跑目标测试并确认通过。

### Task 2: 运行时与自动附加

**Files:**
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Modify: `src/core/runtime/codex-plus-auto-attach.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`
- Test: `tests/unit/codex-plus-auto-attach.test.ts`

- [ ] 添加失败测试：未知版本仍探针、注入，并上报 `compatibility: unverified`。
- [ ] 添加失败测试：未知版本仍触发 9229 自动附加。
- [ ] 运行两份目标测试并确认失败原因来自旧版白名单门槛。
- [ ] 协调器采用回退选择结果，自动附加移除版本前置拒绝。
- [ ] 重跑两份目标测试并确认通过。

### Task 3: 客户端兼容提示

**Files:**
- Modify: `src/shared/contracts/app-snapshot.ts`
- Modify: `src/main/runtime-status.ts`
- Modify: `src/core/manager-service.ts`
- Modify: `src/renderer/CurrentThemeStatus.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/runtime-status.test.ts`
- Test: `tests/unit/current-theme-status.test.tsx`
- Test: `tests/unit/app-live-theme-switch.test.tsx`

- [ ] 添加失败测试：快照传播 `unverified`，侧栏显示“未验证版本”，启动页显示常驻提醒。
- [ ] 运行目标测试并确认失败。
- [ ] 添加兼容性快照字段与最小黄色提醒样式。
- [ ] 重跑目标测试并确认通过。

### Task 4: 全量与实机验证

**Files:**
- Verify only.

- [ ] 运行 `npm test`。
- [ ] 运行 `npm run typecheck`。
- [ ] 运行 `npm run lint`。
- [ ] 打包管理器并通过真实 9229 CDP 确认样式节点、运行 ID及未验证提示。
- [ ] 检查 `git diff --check` 与工作树，确认未触碰无关文件。
