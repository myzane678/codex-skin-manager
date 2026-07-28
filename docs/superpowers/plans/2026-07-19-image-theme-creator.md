# 本地图片主题创建器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 在主题管理器中从本地图片离线生成、安装、启用和导出受控背景主题。

**Architecture:** `sharp` 在 Electron 主进程分析并规范化图片；`ImageThemeCreator` 管理受限暂存令牌、色彩建议和 ZIP 主题生成。`ManagerService` 调用现有安全导入器安装生成包，预加载层仅暴露受控 IPC，React 表单只编辑草稿参数。

**Tech Stack:** Electron 43、React 19、TypeScript 6、Sharp、Yazl、AJV、Vitest 4

---

### Task 1: 安装并封装离线图片处理依赖

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/core/image-theme/image-analysis.ts`
- Test: `tests/unit/image-analysis.test.ts`

- [ ] **Step 1: 添加失败测试**

测试 `analyzeImage(buffer)` 返回三枚 `#RRGGBB` 候选色、合法默认色、`light | dark` 和 `previewDataUrl`；用内嵌 1×1 PNG 夹具断言透明/无色像素仍返回合法回退色。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/image-analysis.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 添加依赖和最小分析器**

Run: `npm install sharp@0.35.3`

实现 `analyzeImage(buffer)`：读取 metadata，拒绝非 PNG/JPEG/WebP 与超过 36M 像素；缩放 96×96、读取 raw RGBA；量化候选色；返回三个候选、对比度最优默认色、亮度建议和 640×360 WebP data URL。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/image-analysis.test.ts`

Expected: PASS。

### Task 2: 创建受控主题包并复用导入安装

**Files:**
- Create: `src/core/image-theme/image-theme-creator.ts`
- Modify: `src/core/manager-service.ts`
- Test: `tests/unit/image-theme-creator.test.ts`

- [ ] **Step 1: 写失败测试**

使用临时 PNG 文件，调用 `begin(imagePath)` 后调用 `create({ token, name: '海岸夜色', accent: '#236A90', readability: 'dark', focusX: 70, focusY: 35 })`。断言生成主题可列出，manifest 的背景路径为 `assets/background.webp`，并且 `activeThemeInput()` 给出 WebP data URL。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/image-theme-creator.test.ts`

Expected: FAIL，创建器不存在。

- [ ] **Step 3: 实现令牌、主题包和安装**

`ImageThemeCreator.begin()` 校验文件大小 20 MiB、调用分析器，将 2560×1440 WebP 写入仅应用数据的 `drafts/<token>.webp`。`create()` 重新校验参数与 token，生成 `manifest.json`、`assets/background.webp`、`preview.webp`，计算 SHA-256，以 `yazl` 创建 ZIP，并调用 `importThemePackage()`；成功/失败均清理 token 临时资产。

`ManagerService` 增加 `beginImageTheme()` 和 `createImageTheme()`，不改现有导入与启用语义。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/image-theme-creator.test.ts tests/unit/manager-service.test.ts`

Expected: PASS。

### Task 3: 导出已安装主题

**Files:**
- Modify: `src/core/manager-service.ts`
- Modify: `src/main.ts`
- Modify: `src/preload.ts`
- Test: `tests/unit/manager-service.test.ts`

- [ ] **Step 1: 写失败测试**

为已安装主题调用 `exportTheme(id, version, destination)`，断言目标文件存在且能由 `importThemePackage()` 安装到第二个临时目录。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: FAIL，方法不存在。

- [ ] **Step 3: 最小实现与 IPC**

服务层仅复制安装目录 `package.codextheme` 到已由主进程保存对话框选定的 `.codextheme` 目标；主进程验证身份、打开 `showSaveDialog`，取消时返回当前 snapshot。预加载层增加 `exportTheme(identity)`。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: PASS。

### Task 4: 暴露图片草稿 IPC 与创建表单

**Files:**
- Modify: `src/shared/contracts/manager.ts`
- Modify: `src/main.ts`
- Modify: `src/preload.ts`
- Create: `src/renderer/ImageThemeCreator.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/ThemeCard.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/unit/image-theme-creator-ui.test.tsx`

- [ ] **Step 1: 写失败渲染测试**

以 `ImageThemeDraft` 夹具渲染创建器，断言显示预览、三个色板、名称输入、明暗选择、焦点滑块与创建按钮；点击候选色后断言创建回调接收该颜色。

- [ ] **Step 2: 确认 RED**

Run: `npm test -- tests/unit/image-theme-creator-ui.test.tsx`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现受控 UI 与 IPC**

定义 `ImageThemeDraft`、`CreateImageThemeInput`，主进程的 `theme:analyze-image` 打开仅位图筛选的文件对话框，`theme:create-from-image` 严格验证 token、名称长度、十六进制颜色、明暗枚举与 0–100 整数焦点。主题库标题栏添加“从图片创建主题”；分析成功显示表单，创建成功回主题库，取消不创建条目。主题卡添加导出按钮。

- [ ] **Step 4: 确认 GREEN**

Run: `npm test -- tests/unit/image-theme-creator-ui.test.tsx`

Expected: PASS。

### Task 5: 全量验证与人工流程

**Files:**
- Verify only

- [ ] **Step 1: 静态与自动验证**

Run: `npm run typecheck`; `npm run lint`; `npm test -- --run`

Expected: 全部通过。

- [ ] **Step 2: Windows 打包**

Run: `npm run package`

Expected: x64 打包成功；记录既有 Vite 弃用警告。

- [ ] **Step 3: 人工验收**

Run: `npm run start`

Expected: 选择本地图片后可编辑推荐项、创建并启用主题、启动主题版验证欢迎页背景、导出 `.codextheme` 并重新导入；原图未被复制到应用主题目录。
