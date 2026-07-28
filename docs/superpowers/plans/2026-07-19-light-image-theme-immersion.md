# 浅色图片主题沉浸感 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 让浅色图片主题的 Codex 主内容区更透明，使背景图片可见，同时保留壳层文字可读性。

**Architecture:** 仅在主题编译器中为“有背景且 `readability: 'light'`”选择固定的分层表面 CSS 值。根背景遮罩降低，顶栏/侧栏/导航保持较高玻璃不透明度，`main` 使用较低不透明度；不增加 manifest 字段或运行时分支。

**Tech Stack:** TypeScript、Vitest、现有受控 CDP CSS 编译器。

---

### Task 1: 锁定浅色图片主题 CSS 契约

**Files:**
- Modify: `tests/unit/compiler.test.ts`

- [ ] **Step 1: 写入失败单测**

```ts
it('uses layered light surfaces for a light readable image background', () => {
  const plan = compileInjectionPlan({
    runId: 'light-image', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    background: { dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light' },
  });

  expect(plan.styleText).toContain('rgba(244,247,250,0.48)');
  expect(plan.styleText).toContain('background-color:rgba(244,247,250,0.76)');
  expect(plan.styleText).toContain(':is(main,[role="main"]){background-color:rgba(244,247,250,0.42)}');
});
```

- [ ] **Step 2: 运行单测并确认失败**

Run: `npm test -- --run tests/unit/compiler.test.ts`

Expected: FAIL，因为编译器当前输出 `rgba(244,247,250,0.72)` 与统一 `0.68` 表面。

### Task 2: 编译固定分层浅色图片表面

**Files:**
- Modify: `src/core/theme-runtime/compiler.ts`
- Test: `tests/unit/compiler.test.ts`

- [ ] **Step 1: 用最小分支定义图片背景 surface token**

在 `compileShell` 前，以 `input.background?.readability === 'light'` 判断是否使用固定的图片浅色 token：根遮罩 `0.48`、壳层 `0.76`、主区 `0.42`。无背景、深色背景和显式 `shell` 继续走现有 token。

- [ ] **Step 2: 让背景和壳层 CSS 使用分层 token**

保持既有受控选择器不变，仅令 `compileBackground` 接收浅色图片的根遮罩与 main 表面值，并让 `compileShell` 对 `main,[role="main"]` 追加固定主区覆盖规则。

- [ ] **Step 3: 运行目标单测并确认通过**

Run: `npm test -- --run tests/unit/compiler.test.ts`

Expected: PASS。

- [ ] **Step 4: 复查 diff 与作用域**

Run: `git diff -- src/core/theme-runtime/compiler.ts tests/unit/compiler.test.ts docs/superpowers/specs/2026-07-19-light-image-theme-immersion-design.md docs/superpowers/plans/2026-07-19-light-image-theme-immersion.md`

Expected: 仅有浅色图片视觉 token、单测及本说明/计划的改动。

### Task 3: 验证编译与回归

**Files:**
- Verify: `src/core/theme-runtime/compiler.ts`
- Verify: `tests/unit/compiler.test.ts`

- [ ] **Step 1: 执行静态检查**

Run: `npm run typecheck && npm run lint`

Expected: 两项命令成功退出。

- [ ] **Step 2: 执行完整测试**

Run: `npm test -- --run`

Expected: 全部测试通过。

- [ ] **Step 3: 检查补丁格式**

Run: `git diff --check`

Expected: 无输出且退出码为 0。

- [ ] **Step 4: 重启后人工验收**

在用户正常退出主题版后，通过更新后的管理器启动主题版；仅用 CDP 读取 `data-codex-skin`、`style[data-codex-skin]` 与 `main`、`nav`、顶栏的 `backgroundColor`。预期 `main` 为 `rgba(244, 247, 250, 0.42)`，导航和顶栏为 `rgba(244, 247, 250, 0.76)`。
