# Codex Skin Manager

Windows 上的 Codex 主题管理器。它通过本机 Chrome DevTools Protocol (CDP) 将选定主题实时应用到 Codex 界面，并提供主题库、图片建主题、托盘切换和状态诊断。

> 仅支持 Windows。目前面向已验证的 Codex 桌面版结构和 Codex++ 启动时暴露的本地调试端口。

## 功能

- 导入、导出、启用、停用、重命名和删除 `.codextheme` 主题包。
- 内置琥珀工作台、莓果信号、森林控制台、霓虹回路四套主题。
- 从本地图片创建主题，设置可读性、视觉焦点、布局和任务页显示方式。
- 应用运行期间实时切换主题，不需要重启 Codex。
- 使用 Codex++ 启动 Codex 时，自动检测 `127.0.0.1:9229` 并附加当前主题。
- CDP 页面重载或短暂断开后自动重连；管理器使用单实例锁，避免重复注入互相覆盖。
- 托盘菜单可快速切换原生外观或已安装主题。

## 安装与运行

从 [Releases](https://github.com/myzane678/codex-skin-manager/releases) 下载最新的 Windows 安装程序并运行。

启动管理器后，选择一个主题即可应用。若 Codex 由 Codex++ 启动并开放本机 `9229` 端口，管理器会自动附加，不需要点击“启动主题版”。

重复启动管理器会自动唤醒已有窗口，不会再创建第二个注入进程。

## 使用图片创建主题

选择“从图片创建主题”后，建议使用主体位于一侧、另一侧留出低细节空间的横向图片。这样侧边栏、对话内容和输入区仍有足够对比度，不会被背景遮挡。

主题库旁提供了中文提示词范例，可直接用于生成适合作为 Codex 背景的图片。

## 主题与数据

- 主题包格式为 `.codextheme`，可在管理器内导入、导出。
- 管理器的主题和配置保存在 Windows 用户数据目录中，不会修改 Codex 安装目录。
- 选择“恢复默认”会停止注入、关闭代理模式并恢复管理器创建的快捷方式。

## 从源码运行

环境要求：Node.js `24.15.0` 或更高版本、npm。

```powershell
npm install
npm test
npm run typecheck
npm run lint
npm run start
```

生成 Windows 安装包：

```powershell
npm run make
```

安装包会生成在 `out/make/squirrel.windows/x64/`。

## 验证范围与限制

- 本项目只连接本机回环地址，不会向远程服务器发送主题或图片。
- CDP 接口和 Codex DOM 结构会随应用版本变化。未验证版本会保持兼容性降级状态，不会盲目注入。
- 主题注入依赖目标 Codex 进程已启用本地调试端口；普通启动方式不保证可以自动附加。

## 致谢与许可

部分视觉规则和 Windows DOM 集成参考了 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的 MIT 许可实现。完整第三方声明见 [NOTICE.md](NOTICE.md)。

本项目以 [MIT License](LICENSE) 发布。版本变更见 [CHANGELOG.md](CHANGELOG.md)。
