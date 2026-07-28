# 沉浸式背景主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 让经过校验的本地主题背景图在 Codex 欢迎页形成可读的沉浸式背景，并保持旧主题和原生回滚行为不变。

**Architecture:** 在 schema 中添加可选、严格受限的背景声明；导入器验证其引用的已校验资产；`ManagerService` 将该资产转换为 data URL 并传给编译器。编译器只根据固定枚举、数值和 data URL 生成既有欢迎页锚点上的固定 CSS，注入和回滚机制保持不变。

**Tech Stack:** TypeScript 6、TypeBox、AJV、Node.js 文件系统、Vitest 4、Electron Forge

---

### Task 1: 定义并验证背景 manifest

**Files:**
- Modify: `src/shared/contracts/theme-manifest.ts`
- Modify: `src/core/theme-package/import-theme.ts`
- Modify: `tests/unit/import-theme.test.ts`

- [ ] **Step 1: 写失败的合法背景包导入测试**

扩展 `manifest()` 辅助函数，使其可接收 `background`，并增加 PNG 背景条目。测试清单：

```ts
background: {
  assetPath: 'assets/background.png',
  placement: 'cover',
  focusX: 70,
  focusY: 35,
  readability: 'dark',
}
```

断言 `importThemePackage()` 返回 `installed`，且解压目录有 `assets/background.png`。

- [ ] **Step 2: 运行合法背景包测试，确认当前 schema 拒绝它**

Run: `npm test -- tests/unit/import-theme.test.ts`

Expected: FAIL，错误码为 `THEME_MANIFEST_INVALID`。

- [ ] **Step 3: 编写背景 schema 与资源关联校验**

在 `theme-manifest.ts` 添加可选对象：

```ts
background: Type.Optional(Type.Object({
  assetPath: Type.String({ minLength: 1, maxLength: 240 }),
  placement: Type.Union([Type.Literal('cover'), Type.Literal('ambient')]),
  focusX: Type.Integer({ minimum: 0, maximum: 100 }),
  focusY: Type.Integer({ minimum: 0, maximum: 100 }),
  readability: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
}, { additionalProperties: false }))
```

在 `validateFiles()` 中，在已验证 `assets` 后校验：`background.assetPath` 必须匹配 `manifest.assets` 的一项，且该项 MIME 是 `image/png`、`image/jpeg` 或 `image/webp`。不匹配时抛出 `ThemePackageError('THEME_BACKGROUND_INVALID', '主题背景资源无效')`。

- [ ] **Step 4: 写边界失败测试**

分别用以下清单断言导入拒绝：

```ts
{ background: { assetPath: 'preview.png', placement: 'cover', focusX: 50, focusY: 50, readability: 'dark' } }
{ background: { assetPath: 'assets/mark.png', placement: 'cover', focusX: 101, focusY: 50, readability: 'dark' } }
```

第一项预期 `THEME_BACKGROUND_INVALID`，第二项预期 `THEME_MANIFEST_INVALID`。再添加一个背景 MIME 为 `image/svg+xml` 的 `assets` 项，预期 `THEME_BACKGROUND_INVALID`。

- [ ] **Step 5: 运行导入测试，确认通过**

Run: `npm test -- tests/unit/import-theme.test.ts`

Expected: PASS，合法背景包、原有包和所有非法背景包都有预期结果。

### Task 2: 将受控背景资源传入运行时

**Files:**
- Modify: `src/core/theme-runtime/compiler.ts`
- Modify: `src/core/manager-service.ts`
- Modify: `tests/unit/manager-service.test.ts`

- [ ] **Step 1: 写活动主题运行时输入的失败测试**

在 `tests/unit/manager-service.test.ts` 内创建最小 `.codextheme` ZIP 夹具，其中含 `assets/background.png` 和合法背景声明；安装并启用后断言：

```ts
const theme = await manager.activeThemeInput();
expect(theme?.background).toEqual({
  dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==',
  placement: 'cover',
  focusX: 70,
  focusY: 35,
  readability: 'dark',
});
```

同时断言无背景的 `amber-workbench` 返回 `background: undefined`。

- [ ] **Step 2: 运行管理器服务测试，确认失败**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: FAIL，`background` 尚未在运行时输入中定义。

- [ ] **Step 3: 定义背景运行时输入并读取已安装资源**

在 `compiler.ts` 导出：

```ts
export interface BackgroundThemeInput {
  dataUrl: string;
  placement: 'cover' | 'ambient';
  focusX: number;
  focusY: number;
  readability: 'light' | 'dark';
}
```

为 `CompileThemeInput` 增加 `background?: BackgroundThemeInput`。在 `ManagerService.activeThemeInput()` 中，查找 `manifest.assets` 内与 `manifest.background.assetPath` 匹配的资源，读取二进制文件，生成 `data:${asset.mime};base64,${data.toString('base64')}`；`background` 缺失时不添加该字段。找不到资源时抛出 `THEME_BACKGROUND_INVALID`。

- [ ] **Step 4: 运行管理器服务测试，确认通过**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: PASS，运行时输入包含精确 data URL 与受控参数，旧主题仍无背景字段。

### Task 3: 编译固定的沉浸背景 CSS

**Files:**
- Modify: `src/core/theme-runtime/compiler.ts`
- Modify: `tests/unit/compiler.test.ts`

- [ ] **Step 1: 写背景 CSS 的失败测试**

调用：

```ts
compileInjectionPlan({
  runId: 'run-123',
  variables: { accent: '#2f6f63' },
  slots: { header: 'compact' },
  motion: { enabled: false },
  copy: { greeting: 'Welcome' },
  background: {
    dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==',
    placement: 'cover', focusX: 70, focusY: 35, readability: 'dark',
  },
});
```

断言 CSS 包含 data URL、`background-position:70% 35%`、`background-size:cover` 和固定深色 surface token；仍包含 `[role="main"]`、不包含 `button|input|textarea|@import|javascript:`。

- [ ] **Step 2: 运行编译器测试，确认失败**

Run: `npm test -- tests/unit/compiler.test.ts`

Expected: FAIL，尚未输出背景样式。

- [ ] **Step 3: 最小实现固定模板**

在 `compileInjectionPlan()` 中验证可选背景：

```ts
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PERCENT = /^(?:0|[1-9]\d?|100)$/;
```

不符合 data URL、placement、readability 或整数坐标范围时抛 `THEME_VALUE_INVALID`。合法背景时追加固定样式：

```ts
${scope}{background-image:linear-gradient(${veil},${veil}),url("${dataUrl}");background-position:${focusX}% ${focusY}%;background-repeat:no-repeat;background-size:${size};}
${scope} :is([data-testid="header-shell-slot"],[data-testid="app-shell-header-context-menu-surface"],nav,[role="navigation"],[role="main"]){background-color:${surface};}
```

其中 `size` 由 `cover`/`ambient` 映射为固定 `cover`/`contain`，`veil` 与 `surface` 由 `light`/`dark` 映射为模块常量；不接收主题提供的 CSS 片段。

- [ ] **Step 4: 写无效背景输入测试**

对 `data:image/svg+xml;base64,PHN2Zy8+`、`data:image/png;base64,evil);color:red`、`focusX: 101` 各断言抛出 `THEME_VALUE_INVALID`。

- [ ] **Step 5: 运行编译器测试，确认通过**

Run: `npm test -- tests/unit/compiler.test.ts`

Expected: PASS，带背景、无背景及非法背景输入均满足预期。

### Task 4: 加入可运行的示例背景主题

**Files:**
- Modify: `themes/amber-workbench.codextheme`
- Test: `tests/unit/manager-service.test.ts`

- [ ] **Step 1: 扩展现有主题包**

为 `amber-workbench` 添加一张无 UI、无文字、无内嵌侧栏或输入框的 PNG/JPEG/WebP 背景图；更新 `manifest.json` 的 `assets` 与 SHA-256，并以：

```json
"background": {
  "assetPath": "assets/background.webp",
  "placement": "cover",
  "focusX": 70,
  "focusY": 35,
  "readability": "dark"
}
```

声明它。保持已有 preview 不变。

- [ ] **Step 2: 运行管理器服务测试，确认真实主题可读取背景**

Run: `npm test -- tests/unit/manager-service.test.ts`

Expected: PASS，`amber-workbench` 的 `activeThemeInput().background` 有 `data:image/webp;base64,` 前缀并保留声明参数。

### Task 5: 完整验证与人工验收

**Files:**
- Verify only

- [ ] **Step 1: 运行静态检查与完整自动测试**

Run: `npm run typecheck`; `npm run lint`; `npm test -- --run`

Expected: 命令全部成功，所有 Vitest 测试通过。

- [ ] **Step 2: 打包应用**

Run: `npm run package`

Expected: Windows x64 Electron Forge package 成功；记录但不因已有 Vite `inlineDynamicImports` 弃用警告失败。

- [ ] **Step 3: 人工验收欢迎页与回滚**

Run: `npm run start` 或 `start-debug-manager.bat`

Expected: 管理器能显示背景主题；仅从主题版链路启动的 Codex 欢迎页显示连续背景、header/导航/main 仍清晰可读；进入会话或停用主题后恢复原生外观；不关闭、附着或干预未知官方 Codex 实例。

- [ ] **Step 4: 核对最终改动范围**

Run: `git status --short` 和按文件查看 diff。

Expected: 只包含本功能的 schema、导入、服务、编译器、主题包、测试、设计与计划文件；保留并不修改既有暂存内容。
