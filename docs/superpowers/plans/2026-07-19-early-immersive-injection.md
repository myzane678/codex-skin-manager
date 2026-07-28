# 早期沉浸式注入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** 在不开放任意主题脚本或选择器的前提下，让受控图片主题在 Codex 新文档创建前注入，并让宽图作为跨侧栏和主区的连续背景。

**Architecture:** 保持现有 Browser ID、loopback WebSocket 和固定 CSS 编译边界。CDP 页面会话仅新增 `Page.addScriptToEvaluateOnNewDocument` 与 `Page.removeScriptToEvaluateOnNewDocument` 两个受控方法；注入运行时把已验证的同一 `InjectionPlan` 序列化为早期脚本。页内状态保存 run ID、observer、timer 与 cleanup，DOM 变化时防抖恢复自身 style/装饰，协调器在路由导致欢迎页状态变化时先移除旧早期脚本和旧 run，再登记新 plan。

**Tech Stack:** TypeScript、Electron、Chrome DevTools Protocol、Vitest、JSDOM。

---

### Task 1: 锁定页内受控自愈契约

**Files:**
- Modify: `tests/unit/injection-runtime.test.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`

- [ ] **Step 1: 写失败测试**

在 JSDOM 中调用 `APPLY_FUNCTION` 后移除该 run 的 `<style>`，调用保存的受控状态 `ensure()`，断言同一 run 的 style 被重建；调用 `ROLLBACK_FUNCTION` 后断言状态、style、装饰均被清理。

- [ ] **Step 2: 运行目标测试，确认失败**

Run: `npm test -- --run tests/unit/injection-runtime.test.ts`

Expected: FAIL，因为当前注入器没有页内状态或 `ensure()`。

- [ ] **Step 3: 实现最小自愈状态**

在 `APPLY_FUNCTION` 中仅对已验证的 header/nav/main 创建或更新同 run 的 style 和可选 decoration；使用固定状态 key、180ms 防抖 `MutationObserver` 和 5 秒 `window.setInterval` 调用 `ensure()`。旧状态先执行 cleanup；rollback 仅清理匹配 run ID 的状态及其 DOM。

- [ ] **Step 4: 运行目标测试，确认通过**

Run: `npm test -- --run tests/unit/injection-runtime.test.ts`

Expected: PASS。

### Task 2: 锁定新文档预注入与回滚生命周期

**Files:**
- Modify: `src/core/ports/runtime-ports.ts`
- Modify: `src/platform/cdp/loopback-cdp-client.ts`
- Modify: `src/core/theme-runtime/injection-runtime.ts`
- Modify: `src/core/runtime/theme-runtime-coordinator.ts`
- Modify: `tests/unit/theme-runtime-coordinator.test.ts`

- [ ] **Step 1: 写失败测试**

扩展测试 injector double，使它记录 `installEarly` 与 `removeEarly`。断言已验证页面首次注入后登记同一 plan 的早期脚本；欢迎页变为任务页时，先移除旧登记、精确回滚旧 run，再登记无 decoration 的新 plan。

- [ ] **Step 2: 运行目标测试，确认失败**

Run: `npm test -- --run tests/unit/theme-runtime-coordinator.test.ts`

Expected: FAIL，因为 `InjectionPort` 与协调器目前没有早期脚本生命周期。

- [ ] **Step 3: 扩展受控 CDP 和协调器**

将两个 CDP Page 方法加入白名单；让 `InjectionRuntime.installEarly` 将 `APPLY_FUNCTION(plan)` 包装为仅等待已验证 shell 的新文档脚本，返回协议 identifier，`removeEarly` 精确移除 identifier。`ActiveRun` 保存 identifier；页面 load 不清空 active run，路由状态变化、rollback、dispose 和断连时移除早期脚本。

- [ ] **Step 4: 运行目标测试，确认通过**

Run: `npm test -- --run tests/unit/theme-runtime-coordinator.test.ts tests/unit/injection-runtime.test.ts`

Expected: PASS。

### Task 3: 锁定宽图连续背景 CSS

**Files:**
- Modify: `tests/unit/compiler.test.ts`
- Modify: `src/core/theme-runtime/compiler.ts`

- [ ] **Step 1: 写失败测试**

为 `placement: 'cover'` 的图片主题断言固定 scoped CSS 将背景图应用到 `body`，使用 `background-attachment:fixed`，并对 header、aside、nav、main 生成透明的受控可读性层；断言没有任意控件选择器。

- [ ] **Step 2: 运行目标测试，确认失败**

Run: `npm test -- --run tests/unit/compiler.test.ts`

Expected: FAIL，因为当前仅在根元素设置背景，壳层背景仍是统一实色层。

- [ ] **Step 3: 实现最小连续背景层**

仅在有图片背景时生成固定的 `body` 连续背景规则；主壳层继续使用现有 `shell` 与浅色分层 token。不得引入 Dream Skin 的内部 class、`button`、`input`、消息内容或 DOM 重排选择器。

- [ ] **Step 4: 运行目标测试，确认通过**

Run: `npm test -- --run tests/unit/compiler.test.ts`

Expected: PASS。

### Task 4: 完整验证

**Files:**
- Verify: `src/core/theme-runtime/injection-runtime.ts`
- Verify: `src/core/runtime/theme-runtime-coordinator.ts`
- Verify: `src/platform/cdp/loopback-cdp-client.ts`
- Verify: `src/core/theme-runtime/compiler.ts`

- [ ] **Step 1: 执行静态检查与完整测试**

Run: `npm run typecheck; npm run lint; npm test -- --run`

Expected: 全部成功。

- [ ] **Step 2: 打包并检查补丁格式**

Run: `npm run package; git diff --check`

Expected: Windows x64 打包成功，`git diff --check` 无输出。

- [ ] **Step 3: 真实重启验收**

用户正常退出旧管理器和主题版后，从 `E:\MyProject\codex-skin\start-debug-manager.bat` 启动更新版本，再启动主题版。通过只读 CDP 核验根标记、style、连续 body 背景与 main/nav/header 的计算背景；不得只以构建输出或截图声称成功。
