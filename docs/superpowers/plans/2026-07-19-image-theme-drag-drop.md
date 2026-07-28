# 图片主题拖放导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 允许用户把单张本地 PNG、JPEG 或 WebP 拖入主题库，复用受控图片分析流程创建图片主题草稿。

**Architecture:** `App` 将拖放事件的首个 `File` 交给 preload；preload 使用 Electron `webUtils.getPathForFile()` 获取本地路径，再调用专用 IPC。主进程验证路径参数后调用现有 `ManagerService.beginImageTheme()`；`ImageThemeCreator` 和图片安全校验不变。

**Tech Stack:** Electron 43、React 19、TypeScript 6、Vitest 4

---

### Task 1: 暴露受控拖放分析 IPC

**Files:**
- Modify: `src/main.ts`
- Modify: `src/preload.ts`
- Test: `tests/unit/main-image-ipc.test.ts`

- [ ] **Step 1: 写失败测试**

为 `theme:analyze-image-path` 注册处理器写测试：传入 `C:\\images\\sample.png` 时调用 `manager.beginImageTheme()`；空字符串和非字符串参数抛出 `IPC_ARGUMENT_INVALID`。另为 preload 写测试，确认拖放文件通过 `webUtils.getPathForFile()` 转换后才调用路径 IPC。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/main-image-ipc.test.ts`

Expected: FAIL，因为拖放路径 IPC 尚未注册。

- [ ] **Step 3: 写最小实现**

在 `src/main.ts` 注册 `theme:analyze-image-path`，仅在参数为非空字符串时调用 `manager.beginImageTheme(imagePath)`；在 `src/preload.ts` 增加接收 `File` 的 `analyzeImageThemeFile(file)`，调用 `webUtils.getPathForFile(file)` 后再调用路径 IPC，不暴露文件系统或二进制 API。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/main-image-ipc.test.ts`

Expected: PASS。

### Task 2: 添加主题库拖放交互

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/app-image-drag-drop.test.tsx`

- [ ] **Step 1: 写失败测试**

渲染 `App` 的主题库后，模拟拖入单个 File，断言调用 `window.codexSkin.analyzeImageThemeFile()`；模拟两张文件时断言不调用该方法并显示错误。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/app-image-drag-drop.test.tsx`

Expected: FAIL，因为拖放处理与预加载 API 尚不存在。

- [ ] **Step 3: 写最小实现**

在主题库工作区添加 `onDragOver`、`onDragLeave` 与 `onDrop`：阻止浏览器默认打开文件行为；仅在未忙碌、未显示草稿且恰有一个 File 时调用 `analyzeImageThemeFile()`；其余情况显示现有错误区域。用 `drag-active` 类控制拖入高亮与文字提示。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/app-image-drag-drop.test.tsx`

Expected: PASS。

### Task 3: 回归验证

**Files:**
- Verify: `src/main.ts`
- Verify: `src/preload.ts`
- Verify: `src/renderer/App.tsx`
- Verify: `src/renderer/styles.css`
- Verify: `tests/unit/main-image-ipc.test.ts`
- Verify: `tests/unit/app-image-drag-drop.test.tsx`

- [ ] **Step 1: 运行完整静态与测试验证**

Run: `npm run typecheck; npm run lint; npm test -- --run; npm run package; git diff --check`

Expected: 全部命令成功；打包仅可出现已知的 Vite `inlineDynamicImports` 弃用警告。

- [ ] **Step 2: 人工验收**

Run: `start-debug-manager.bat`

Expected: 将一张真实 PNG、JPEG 或 WebP 拖入主题库时显示草稿；拖两张、拖非图片或拖入超过限制的图片时显示错误且不创建主题。
