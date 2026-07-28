# Codex Live Theme Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 支持从主题库和托盘菜单在已连接的 Codex 窗口中即时切换完整主题，无需重启或刷新。

**Architecture:** `ThemeRuntimeCoordinator` 在现有 CDP 页面会话内原子替换注入；`LiveThemeSwitcher` 统一处理持久化、待应用与失败恢复；纯函数托盘菜单和 IPC 快照事件让两个入口保持一致。

**Tech Stack:** Electron、TypeScript、React、CDP、Vitest

---

### Task 1: CDP 会话内热切换

**Files:**
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] 新增失败测试：`switchTheme` 不再次调用 `openPageSession`，应用新计划并清理旧 early script。
- [ ] 新增失败测试：新计划应用失败时重新应用旧主题并保持旧主题可用。
- [ ] 新增失败测试：`clearTheme` 回滚当前注入但保留页面会话。
- [ ] 提取单次计划应用方法，实现 `switchTheme` 和 `clearTheme`。
- [ ] 运行 `npm test -- tests/unit/theme-runtime-coordinator.test.ts`，预期全部通过。

### Task 2: 统一主题选择事务

**Files:**
- Create: `src/core/runtime/live-theme-switcher.ts`
- Create: `tests/unit/live-theme-switcher.test.ts`
- Modify: `src/main.ts`

- [ ] 新增失败测试：连接存在时保存并即时应用新主题。
- [ ] 新增失败测试：无连接时保存选择并返回待应用快照。
- [ ] 新增失败测试：热切换失败时恢复旧主题配置。
- [ ] 实现 `LiveThemeSwitcher.switchTo` 与 `switchToNative`，并让主题库 IPC 使用它。
- [ ] 运行 `npm test -- tests/unit/live-theme-switcher.test.ts`，预期全部通过。

### Task 3: 动态托盘主题菜单

**Files:**
- Create: `src/main/tray-menu.ts`
- Create: `tests/unit/tray-menu.test.ts`
- Modify: `src/main.ts`

- [ ] 新增失败测试：菜单包含原生外观与全部主题，并勾选当前项。
- [ ] 新增失败测试：菜单项调用统一切换、打开管理器和退出回调。
- [ ] 实现菜单模板并在主题导入、创建、切换、删除和重命名后刷新托盘。
- [ ] 运行 `npm test -- tests/unit/tray-menu.test.ts`，预期全部通过。

### Task 4: 管理器界面同步

**Files:**
- Modify: `src/preload.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/ThemeCard.tsx`
- Test: `tests/unit/app-live-theme-switch.test.tsx`

- [ ] 新增失败测试：主进程推送快照时主题库更新当前主题。
- [ ] 暴露受控的快照订阅 API，并在 React 卸载时取消监听。
- [ ] 将非当前主题按钮提示改为“立即切换主题”。
- [ ] 运行 `npm test -- tests/unit/app-live-theme-switch.test.tsx`，预期全部通过。

### Task 5: 完整验证

**Files:**
- Verify: all modified files

- [ ] 运行 `npm test`，预期零失败。
- [ ] 运行 `npm run typecheck`，预期退出码 0。
- [ ] 运行 `npm run lint`，预期退出码 0。
- [ ] 运行 `git diff --check`，预期无输出。
- [ ] 运行 `npm run package`，确认 Windows x64 产物生成。
