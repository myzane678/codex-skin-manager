# 沉浸式背景主题设计

## 目标

在不修改 Codex 官方安装文件、不会接管原生交互且仅作用于已探测欢迎页的前提下，让主题可以使用已校验的本地纯背景图形成连续视觉背景，并在其上提供受控的可读性分层。

目标是借鉴 Codex Dream Skin 的视觉层级，而不是复制其依赖内部 DOM 结构的大范围 CSS。

## 范围

本阶段包含：

- 主题 manifest 可选声明一个已列入 `assets` 的本地背景图片。
- 背景声明支持固定枚举和数值：显示模式、焦点坐标、明暗可读性策略。
- 欢迎页在现有 `header`、导航和 `main` 锚点范围内应用连续背景与半透明分层。
- 未声明背景的主题继续使用现有强调色样式，不改变行为。
- 进入会话、结构探测失败、停用主题或运行时回滚时，删除全部注入节点和样式，恢复原生界面。

本阶段不包含：

- 自动从图片计算颜色、亮暗、主体位置或安全区。
- 改造欢迎页卡片、项目选择器、输入框、发送按钮或其他未验证的内部节点。
- 在任务会话中保留背景、图片 URL、远程资源、任意 CSS 或脚本。

## 主题清单

保持 `schemaVersion: 1`。新增可选 `background`：

```ts
{
  assetPath: string;
  placement: 'cover' | 'ambient';
  focusX: number;
  focusY: number;
  readability: 'light' | 'dark';
}
```

约束：

- `assetPath` 必须精确匹配 `assets` 中的一项路径，不能指向 `preview`，不能是 URL 或本地绝对路径。
- 被引用的资源 MIME 类型仅允许 `image/png`、`image/jpeg` 或 `image/webp`。
- `focusX` 与 `focusY` 为闭区间 `[0, 100]` 的整数，分别对应 CSS `background-position` 的百分比坐标。
- `placement: 'cover'` 使用整窗裁切背景；`ambient` 使用完整图片并降低视觉强度。
- `readability` 只选择固定浅色或深色分层 token，主题不能提供颜色、透明度或 CSS 文本。

导入校验在 manifest schema 通过后执行资源关联校验；背景未声明或旧主题不进入该分支。若引用不存在、引用 preview、MIME 不允许或路径不匹配，整个主题包导入失败。

## 数据流

1. 导入器校验背景引用仍位于已声明并通过哈希校验的 `assets` 中。
2. `ManagerService.activeThemeInput()` 读取当前主题 manifest；背景存在时，将安装目录下的背景资源读取为 data URL，并连同受控背景参数传给编译器。
3. 编译器只接受已约束的输入，生成固定选择器、固定属性和值。背景图片只以 data URL 进入 `background-image`，不从主题包接受 CSS 文本、URL 或选择器。
4. 注入运行时沿用当前运行 ID 标记和精确回滚逻辑。现有欢迎页探测失败时不注入；离开欢迎页或停止时移除本次全部 style 与装饰节点。

## 固定视觉策略

- 基础层：`html` 与 `body` 仅在当前运行 ID 作用域下获得同一张背景；`cover` 使用 `background-size: cover`，`ambient` 使用 `contain`，并分别采用固定背景透明度。
- 区域层：`header`、导航和 `main` 使用由 `readability` 选择的固定半透明 surface token，不改尺寸、定位、显示模式或原生事件。
- 强调层：保留现有 header 色带、导航分隔线和 main 内装饰文字，继续从 `variables.accent` 取色。
- 不针对 `button`、`input`、`textarea`、`[role="button"]` 和任何未验证 class 生成 CSS。

## 兼容与安全

- 所有资源仍需通过 ZIP 条目、路径、大小、MIME、哈希和额外文件校验。
- 编译器应再次校验背景 data URL 前缀、MIME、焦点和枚举，避免业务层调用绕过 schema 后产出任意 CSS。
- 主题无背景、加载背景失败或 CSS 编译失败时，运行时按当前失败路径回滚，不改变 Codex 原生 DOM。
- 本阶段不扩展 `WELCOME_PROBE` 的锚点，不降低原有原生控件可见性检查。

## 测试与验收

- manifest：接受合规背景；拒绝路径不在 assets、引用 preview、SVG/GIF 背景、越界焦点和未知枚举。
- 导入：具有合法背景的包可安装；背景引用不匹配时在导入阶段拒绝。
- 管理器服务：激活有背景主题时，将资源编成 data URL 并传递受控背景；旧主题的背景字段保持缺失。
- 编译器：背景主题仅生成固定已验证锚点的 CSS，包含 data URL、受控定位和分层 token；不包含任意外部 URL、控件选择器或主题输入的任意 CSS。
- 注入运行时：沿用当前 apply/rollback 标记测试，确认背景样式归属当前 runId 并可精确删除。
- 全量验证：`npm run typecheck`、`npm run lint`、`npm test -- --run` 与 `npm run package`。
- 人工验收：仅启动管理器或主题版 Codex，确认欢迎页呈现连续背景与可读性层；进入会话后恢复原生外观，且原生导航、输入与窗口控制保持可用。
