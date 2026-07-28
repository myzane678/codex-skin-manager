# 当前主题侧栏提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 在所有管理器视图的侧栏持续显示当前主题名称、主题强调色及准确运行状态。

**Architecture:** 沿用现有 `ManagerSnapshot` 数据流，在 `ThemeView` 中暴露已解析 manifest 的强调色，并由一个无副作用的展示组件渲染侧栏状态。业务状态机、IPC 与主题操作保持不变。

**Tech Stack:** React 19、TypeScript 6、Vitest 4、Electron Forge、CSS

---

### Task 1: 暴露主题强调色

**Files:**
- Modify: `src/shared/contracts/manager.ts`
- Modify: `src/core/manager-service.ts`
- Test: `tests/unit/manager-service.test.ts`

- [ ] **Step 1: 写失败测试**

新增 `ManagerService.snapshot()` 测试，安装一个 `variables.accent` 为 `#c89d45` 的主题并断言返回的 `ThemeView.accent` 等于该值。

- [ ] **Step 2: 验证测试按预期失败**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: FAIL，主题视图中缺少 `accent`。

- [ ] **Step 3: 最小实现**

为 `ThemeView` 增加 `accent: string`，并在 `ManagerService.toView()` 返回 `manifest.variables.accent`。

- [ ] **Step 4: 验证测试通过**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: PASS。

### Task 2: 渲染侧栏当前主题块

**Files:**
- Create: `src/renderer/CurrentThemeStatus.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/current-theme-status.test.tsx`

- [ ] **Step 1: 写失败测试**

用 `renderToStaticMarkup` 验证：当前主题存在时显示 `CURRENT THEME`、主题名、“待启动 · CDP 已连接”和强调色；当前主题不存在时显示“当前主题”“原生模式”和“CDP 未连接”。

- [ ] **Step 2: 验证测试按预期失败**

Run: `npm test -- tests/unit/current-theme-status.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 最小实现**

创建纯展示 `CurrentThemeStatus` 组件；`App` 查找活动主题并替换原 `.sidebar-status`；CSS 增加固定尺寸、主题色左边框和三行文本样式。

- [ ] **Step 4: 验证测试通过**

Run: `npm test -- tests/unit/current-theme-status.test.tsx`

Expected: PASS。

### Task 3: 完整验证

**Files:**
- Verify only

- [ ] **Step 1: 运行静态检查与全部测试**

Run: `npm run typecheck`, `npm run lint`, `npm test -- --run`

Expected: 全部通过且无新增错误。

- [ ] **Step 2: 打包验证**

Run: `npm run package`

Expected: Windows x64 打包成功。

- [ ] **Step 3: 启动并目视验收**

Run: `npm run start`

Expected: 主题库、启动与代理、恢复与诊断三个视图均显示同一侧栏主题块，文本不溢出且操作区不被遮挡。
