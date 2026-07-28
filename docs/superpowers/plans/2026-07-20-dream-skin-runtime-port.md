# Dream Skin Runtime Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 将 Dream Skin 的完整主题语义和视觉运行时移植到当前 Codex Skin Builder，并锁定适配 Codex `26.715.4045.0`。

**Architecture:** 保留现有 `.codextheme`、`ManagerService`、CDP 协调器和恢复链；在 manifest 到 `InjectionPlan` 之间加入受控 Dream Skin 参数，在 CDP 注入器上集中管理当前版本选择器、首页/任务页识别和可逆清理。视觉 CSS 继续作为受控共享载荷，不允许主题包携带任意脚本或任意 CSS。

**Tech Stack:** TypeScript, Electron, React, CDP, Vitest, JSDOM, TypeBox/Ajv。

---

### Task 1: 记录当前版本适配基线

**Files:**
- Create: `src/core/theme-runtime/codex-version-adapter.ts`
- Test: `tests/unit/codex-version-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

覆盖 `26.715.4045.0` 的适配标识、壳层选择器、首页/任务页选择器和原生控件探针；未知版本必须返回不兼容结果。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/codex-version-adapter.test.ts`
Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Write minimal implementation**

定义 `CodexVersionAdapter`，集中保存当前版本的 `header`, `navigation`, `main`, `sidebar`, `homeRoute`, `taskRoute`, `projectSelector`, `composer` 选择器，并提供 `getAdapter(version)` 与 `buildProbeScript(adapter)`。适配器只返回已验证版本，未知版本不猜测选择器。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/codex-version-adapter.test.ts`
Expected: PASS。

### Task 2: 扩展主题契约并保持旧包兼容

**Files:**
- Modify: `src/shared/contracts/theme-manifest.ts`
- Modify: `src/core/theme-runtime/compiler.ts`
- Modify: `src/core/manager-service.ts`
- Modify: `src/core/image-theme/image-theme-creator.ts`
- Modify: `src/renderer/ImageThemeCreator.tsx`
- Modify: `src/shared/contracts/manager.ts`
- Test: `tests/unit/compiler.test.ts`
- Test: `tests/unit/image-theme-creator.test.ts`

- [ ] **Step 1: Write the failing tests**

增加 `appearance: auto | light | dark`、`safeArea: auto | left | center | right`、`taskMode: auto | ambient | banner | off` 的解析、默认值和编译测试；旧的 `readability` 主题仍能导入并映射为显式外观。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/compiler.test.ts tests/unit/image-theme-creator.test.ts`
Expected: FAIL on the new fields and `auto` values。

- [ ] **Step 3: Write minimal implementation**

在 manifest 中增加受控可选字段；在 `ManagerService.activeThemeInput()` 中只读取声明字段并给旧主题补默认值；在图片创建流程和 React 表单中暴露自动外观、安全区和任务模式；编译器将旧 `readability` 迁移为 `appearance`，不反向改变 Codex 的官方 `color-scheme`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/compiler.test.ts tests/unit/image-theme-creator.test.ts`
Expected: PASS。

### Task 3: 移植完整 Dream Skin 视觉载荷

**Files:**
- Modify: `src/core/theme-runtime/dream-skin-css.ts`
- Modify: `src/core/theme-runtime/compiler.ts`
- Test: `tests/unit/compiler.test.ts`

- [ ] **Step 1: Write the failing tests**

验证 CSS 包含连续全窗背景、首页/任务页层级、宽图渐变、自动外观变量、可读性层和真实 composer/project selector 的适配类；验证 CSS 不接受主题包携带的任意脚本、远程 URL 或未验证选择器。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/compiler.test.ts`
Expected: FAIL on the missing full-runtime markers。

- [ ] **Step 3: Write minimal implementation**

把上游 Dream Skin CSS 中与当前版本适配器匹配的视觉规则合并到共享载荷；由 `InjectionPlan` 提供受控 CSS 变量和外观类，不把 `theme.json` 或 `.codextheme` 中的 CSS 当作可执行输入。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/compiler.test.ts`
Expected: PASS。

### Task 4: 接入当前版本适配探针和 DOM 生命周期

**Files:**
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`
- Test: `tests/unit/theme-runtime-coordinator.test.ts`
- Test: `tests/unit/injection-runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

验证探针返回版本、壳层、首页/任务页、project selector、composer 和原生控件状态；验证注入器在路由切换、DOM 重渲染、重复 apply 和 rollback 后只留下当前 run 的 style/class/attribute。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/theme-runtime-coordinator.test.ts tests/unit/injection-runtime.test.ts`
Expected: FAIL on adapter-aware probe fields and full cleanup assertions。

- [ ] **Step 3: Write minimal implementation**

让协调器根据当前 Codex 版本选择适配器；让注入器只使用适配器确认的节点，并在 apply/rollback 中清理 observer、timer、早期脚本、装饰节点、根类和 data 属性。保留真实控件在装饰层之上并设置 `pointer-events: none`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/theme-runtime-coordinator.test.ts tests/unit/injection-runtime.test.ts`
Expected: PASS。

### Task 5: 补齐界面控制和诊断信息

**Files:**
- Modify: `src/renderer/ImageThemeCreator.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/shared/contracts/manager.ts`
- Modify: `src/main.ts`
- Test: `tests/unit/image-theme-creator-ui.test.tsx`
- Test: `tests/unit/app-snapshot.test.ts`

- [ ] **Step 1: Write the failing tests**

验证图片主题表单可选择自动/浅色/深色、安全区、图片布局和任务模式；诊断快照显示适配器版本和兼容状态。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/image-theme-creator-ui.test.tsx tests/unit/app-snapshot.test.ts`
Expected: FAIL because the controls and snapshot fields are absent。

- [ ] **Step 3: Write minimal implementation**

扩展 IPC 输入校验、共享 manager 类型和表单控件；保持原生模式和恢复默认入口不变。所有新增控制只写入受控 manifest 字段。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/image-theme-creator-ui.test.tsx tests/unit/app-snapshot.test.ts`
Expected: PASS。

### Task 6: 更新第三方声明并运行全量静态验证

**Files:**
- Modify: `NOTICE.md`
- Modify: `docs/superpowers/plans/2026-07-20-dream-skin-runtime-port.md`

- [ ] **Step 1: Run complete automated verification**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all commands exit 0。

- [ ] **Step 2: Inspect third-party attribution**

确认移植的 CSS/注入逻辑注明 Codex Dream Skin 来源、MIT 许可、上游提交和不包含第三方图片/官方二进制。

- [ ] **Step 3: Commit implementation slices**

提交时只包含本任务修改的源码、测试和声明文件，不操作大都督其他未提交文件。

### Task 7: 当前 Codex 版本实机验收

**Files:**
- Create: `docs/superpowers/verification/2026-07-20-dream-skin-runtime-port.md`

- [ ] **Step 1: Launch current Codex with the themed runtime**

使用现有 Electron Builder 的主题启动入口，记录 `OpenAI.Codex 26.715.4045.0`、CDP 端口、适配器版本和运行 ID。

- [ ] **Step 2: Verify visual and interaction states**

分别检查首页/任务页、官方浅色/深色/auto、宽图/标准图、项目选择、composer 输入、路由切换、页面重载和主题切换，并保存桌面截图。

- [ ] **Step 3: Verify restore**

执行“恢复默认 Codex”，确认主题样式、根类、data 属性、早期脚本和 CDP 会话均被清除，普通 Codex 可重新启动。

- [ ] **Step 4: Record results**

将实际版本、通过项、已知兼容边界和失败日志写入验证文档；未通过项不得宣称移植完成。
