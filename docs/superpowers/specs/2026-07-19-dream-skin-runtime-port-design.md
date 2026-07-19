# Dream Skin 完整运行时移植设计

## 摘要

将 Codex Dream Skin Windows 版的完整视觉能力直接移植到现有 Codex Skin Builder，并针对当前机器安装的 Codex 版本完成适配。保留现有 Electron 管理界面、`.codextheme` 主题库、启动协调器和恢复机制，不再维持“主题仅负责背景”的旧限制。

第一版只承诺当前已安装 Codex 版本可用。后续 Codex 更新通过独立兼容适配层处理，不要求首版维护多版本规则。

## 目标

- 移植 Dream Skin 的共享视觉 CSS、DOM 集成、早期注入和持续重应用能力。
- 支持 `appearance: auto | light | dark`。
- 支持图片焦点、安全区、图片布局和首页/任务页显示模式。
- 保留真实 Codex 侧栏、项目选择器、建议卡、任务内容和输入框的交互。
- 主题切换、暂停、重新应用、路由变化和页面重载后状态正确。
- 完整恢复后不残留样式、类名、属性、观察器、计时器或早期注入脚本。
- 保留 Dream Skin 的 MIT 许可、NOTICE 和明确来源说明。

## 非目标

- 第一版不保证其他 Codex 版本兼容。
- 不修改 WindowsApps、`app.asar`、官方二进制或签名。
- 不改变模型、API Key、Base URL、登录状态或用户任务数据。
- 不兼容 Dream Skin 原生主题目录作为新的公开导入格式；Skin Builder 继续使用 `.codextheme`。
- 不把带 Codex UI 的效果截图当作背景资源。

## 选定方案

采用“直接移植上游运行时 + 当前版本适配层”的方式：

1. 从 Codex Dream Skin 移植 `dream-skin.css` 的视觉规则与 `renderer-inject.js` 的页面集成行为。
2. 将移植内容改造成当前 TypeScript 编译器和 `InjectionRuntime` 可管理的受控载荷。
3. 使用独立适配器描述当前 Codex 版本的壳层、侧栏、顶部栏、首页、任务页、项目选择器和 composer 定位规则。
4. 将 Dream Skin 主题语义映射到现有 `.codextheme` manifest。
5. 继续由现有 CDP 协调器负责启动、连接、早期注入、验证和回滚。

不采用只复制 CSS 的方案，因为它无法稳定处理路由、页面重载和真实控件定位；也不重写等效视觉引擎，因为这会丢失上游已经验证过的视觉细节。

## 架构

### 主题包层

现有 `manifest.json` 扩展以下受控字段：

- `appearance`: `auto | light | dark`
- `background.focusX` / `background.focusY`
- `background.safeArea`: `auto | left | center | right`
- `background.imageLayout`: `wide | standard`
- `background.taskMode`: `auto | ambient | banner | off`
- Dream Skin 所需的受控 palette 和文案字段

旧主题继续可读取。缺失字段使用与 Dream Skin 一致的默认值；旧 `background.readability` 只作为迁移输入，不再强制改变用户的官方浅深色选择。

### 主题编译层

`compiler.ts` 将 manifest 编译为纯数据 `InjectionPlan`：

- 主题图片 data URL
- 外观策略
- 构图和任务页策略
- palette/CSS 变量
- 当前适配器版本
- 唯一运行 ID

编译器不拼接未经验证的任意 CSS。所有可变值必须通过枚举、数字范围、颜色格式和 data URL 校验。

### 当前版本适配层

新增一个聚焦当前 Codex 版本的适配模块，集中管理：

- 兼容的 Codex 版本标识
- 根壳层、侧栏、顶部栏和主区域探针
- 首页和任务页判定
- 项目选择器与 composer 定位
- 原生控件可见性和可交互性检查

Dream Skin 视觉引擎不直接散布当前版本选择器。Codex 更新后优先修改适配器和探针。

若版本或 DOM 探针不匹配，运行时进入 `compatibility-degraded`，停止应用新主题并清理部分注入，不在未知结构上继续强制改写。

### 视觉层

移植后的共享 CSS负责：

- 单张连续 16:9 全窗背景
- 浅色、深色和自动模式
- 首页的完整氛围层
- 任务页的低干扰模式
- 侧栏、顶部栏、主区、建议卡和 composer 的协调表面
- 对比度渐变、透明度、边框、阴影和模糊
- 宽图/标准图与安全区布局

CSS 只操作适配器确认过的真实 Codex 元素。装饰层必须 `pointer-events: none`，真实控件维持更高交互层级。

### 注入生命周期

沿用当前 `InjectionRuntime` 的 CDP 管理方式并补齐 Dream Skin 行为：

1. 连接经过身份验证的本机 Codex CDP 页面。
2. 在新文档注册带 generation/run ID 的早期载荷。
3. DOM 就绪后应用根类名、语义属性、共享样式和必要装饰节点。
4. MutationObserver 与低频兜底检查维持路由和重载后的主题状态。
5. 主题切换前精确清理上一运行 ID。
6. 暂停时卸下实时皮肤但保留主题选择。
7. 恢复默认时同时移除实时载荷和早期脚本，并以普通方式重启 Codex。

所有 observer、timer、临时节点、class、data attribute 和 style 元素都由单一 cleanup 所有。

## 管理界面

保留现有主题库和图片主题创建流程，增加：

- 外观：自动、浅色、深色
- 图片焦点
- 安全区
- 图片布局
- 任务页模式
- 暂停/继续主题
- 重新应用主题
- 当前 Codex 版本与适配状态

“原生模式”继续表示无外部主题；“恢复默认 Codex”继续作为完整回滚入口。

## 数据流

```text
.codextheme
  -> manifest 校验与资源哈希校验
  -> ManagerService 读取活动主题
  -> compiler 生成受控 InjectionPlan
  -> 当前 Codex 版本适配探针
  -> CDP 早期注入和实时注入
  -> Dream Skin 视觉层应用到真实 Codex DOM
  -> 验证探针和截图检查
```

## 错误与恢复

- 主题字段无效：拒绝导入或编译，不启动注入。
- Codex 版本不匹配：显示兼容性降级，不猜测选择器。
- 壳层探针失败：清理当前运行 ID 并保留诊断信息。
- 注入器启动失败：撤销早期脚本；由现有启动协调器恢复普通 Codex。
- 主题切换失败：不删除已安装主题；回滚到原生或上一份已验证计划。
- 完整恢复：清空活动主题、暂停标记、实时注入和早期注入，关闭受管 CDP 会话。

## 许可证和来源

- 保留仓库现有 `NOTICE.md`，补充移植文件、上游仓库 URL、上游提交 SHA 和 MIT 许可说明。
- 对直接移植或实质派生的文件保留原作者版权与许可头。
- 不将上游图片预设默认为可再分发素材；仅在权利明确时打包。

## 测试与验收

### 自动测试

- manifest 新旧字段解析和默认值。
- `appearance: auto | light | dark` 编译。
- 构图、安全区、任务页模式的合法/非法输入。
- 当前版本适配器探针成功与失败。
- 重复应用幂等性。
- 切换主题后旧运行 ID 完整清理。
- 暂停、继续、重载和路由切换。
- 完整恢复不残留 style、class、attribute、timer 或 observer。
- 兼容性失败不会隐藏或阻断原生控件。

### 当前版本实机验收

- 记录当前 Codex 包版本和被验证的 DOM 标记。
- 分别验证首页和普通任务页。
- 分别验证官方浅色和深色外观，`auto` 跟随 computed `color-scheme`。
- 检查侧栏、项目选择器、建议卡和 composer 均可点击/输入。
- 检查全窗背景连续、无横向溢出、无文字重叠、无明显对比度问题。
- 检查主题切换、暂停/继续、重新应用和页面重载。
- 截图验证桌面窗口的典型窄宽与宽屏尺寸。
- 执行“恢复默认 Codex”，确认重启后完全恢复官方外观。

## 开放风险

- 当前 Codex DOM 可能没有稳定公开契约；选择器需要随版本维护。
- 原版 Dream Skin CSS 可能包含针对其旧版 DOM 的规则，必须逐段映射，不能假设复制后直接工作。
- 自动视觉验证不能替代真实输入、项目菜单和任务页的手动交互检查。
- CDP 仅绑定回环地址，但调试端口没有同用户认证；主题运行期间仍应只运行可信本地程序。

## 完成定义

只有当完整自动测试通过，并在当前安装的 Codex 版本上完成首页、任务页、浅色、深色、切换、暂停、重载和恢复实机验收后，才视为移植完成。
