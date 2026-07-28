import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, Tray, Menu, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ManagerService } from './core/manager-service';
import { InjectionRuntime } from './core/theme-runtime/injection-runtime';
import { ThemeRuntimeCoordinator, type ThemeRuntimeStatus } from './core/runtime/theme-runtime-coordinator';
import { LiveThemeSwitcher } from './core/runtime/live-theme-switcher';
import { CodexPlusAutoAttachCoordinator } from './core/runtime/codex-plus-auto-attach';
import { TrayProxyCoordinator } from './core/runtime/tray-proxy-coordinator';
import { ThemedLaunchCoordinator } from './core/runtime/themed-launch-coordinator';
import { LoopbackCdpClient } from './platform/cdp/loopback-cdp-client';
import { WindowsAppLauncher } from './platform/windows/app-launcher';
import { WindowsCodexIdentity } from './platform/windows/codex-identity';
import { WindowsThemeShortcut } from './platform/windows/theme-shortcut';
import { allocateLoopbackPort } from './platform/windows/port-allocator';
import { createWindowOptions } from './main/window-options';
import { buildTrayMenuTemplate, type TrayMenuAction } from './main/tray-menu';
import { isThemeRuntimeActive, shouldKeepManagerAlive } from './main/runtime-lifecycle';
import { toRuntimePresentation } from './main/runtime-status';
import { acquireSingleInstanceLock, revealManagerWindow } from './main/single-instance';
import { isValidImagePath } from './main/image-input';
import { isValidThemeRenameInput } from './main/theme-rename-input';
import type { ThemeIdentity } from './shared/contracts/manager';
import type { CreateImageThemeInput } from './shared/contracts/manager';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let manager: ManagerService;
let proxyEnabled = false;
let isQuitting = false;
let shutdownInProgress = false;
let runtimeActive = false;
let runtime: ThemeRuntimeCoordinator;
let liveThemeSwitcher: LiveThemeSwitcher;
let codexPlusAutoAttach: CodexPlusAutoAttachCoordinator;
let themedLauncher: ThemedLaunchCoordinator;
let trayProxy: TrayProxyCoordinator;
let themeShortcut: WindowsThemeShortcut;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow(createWindowOptions(path.join(__dirname, 'preload.js')));

  window.on('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (shouldKeepManagerAlive({ proxyEnabled, runtimeActive, isQuitting })) {
      event.preventDefault();
      window.hide();
    }
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load (${errorCode}): ${errorDescription}`);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

function refreshTrayMenu(): void {
  if (!tray) return;
  void manager.snapshot().then((snapshot) => {
    publishSnapshot(snapshot);
  });
}

function publishSnapshot(snapshot: Awaited<ReturnType<ManagerService['snapshot']>>): void {
  mainWindow?.webContents.send('manager:snapshot-changed', snapshot);
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate(snapshot, handleTrayAction)));
}

function handleTrayAction(action: TrayMenuAction): void {
  if (action.kind === 'open-manager') {
    mainWindow?.show();
    return;
  }
  if (action.kind === 'quit') {
    isQuitting = true;
    app.quit();
    return;
  }
  void (action.kind === 'native'
    ? liveThemeSwitcher.switchToNative()
    : liveThemeSwitcher.switchTo(action.identity))
    .then((snapshot) => {
      runtimeActive = isThemeRuntimeActive(snapshot.theme);
      publishSnapshot(snapshot);
    })
    .catch(() => refreshTrayMenu());
}

function createTray(): void {
  if (tray) return;
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Codex Skin Manager');
  refreshTrayMenu();
}

function isIdentity(value: unknown): value is ThemeIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.version === 'string';
}

function isImageThemeInput(value: unknown): value is CreateImageThemeInput {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === 'string'
    && typeof candidate.name === 'string'
    && /^#[0-9a-fA-F]{6}$/.test(String(candidate.accent))
    && (candidate.readability === 'light' || candidate.readability === 'dark')
    && (candidate.appearance === 'auto' || candidate.appearance === 'light' || candidate.appearance === 'dark')
    && (candidate.safeArea === 'auto' || candidate.safeArea === 'left' || candidate.safeArea === 'center' || candidate.safeArea === 'right')
    && (candidate.imageLayout === 'wide' || candidate.imageLayout === 'standard')
    && (candidate.taskMode === 'auto' || candidate.taskMode === 'ambient' || candidate.taskMode === 'banner' || candidate.taskMode === 'off')
    && Number.isInteger(candidate.focusX) && Number.isInteger(candidate.focusY)
    && Number(candidate.focusX) >= 0 && Number(candidate.focusX) <= 100
    && Number(candidate.focusY) >= 0 && Number(candidate.focusY) <= 100;
}

function applyRuntimeStatus(status: ThemeRuntimeStatus): void {
  const presentation = toRuntimePresentation(status);
  runtimeActive = presentation.runtimeActive;
  manager.setRuntimeState(presentation.state);
}

async function startThemeRuntime(
  port: number,
  theme: NonNullable<Awaited<ReturnType<ManagerService['activeThemeInput']>>>,
  packageVersion = '26.715.4045.0',
): Promise<void> {
  runtimeActive = true;
  await runtime.start(port, theme, applyRuntimeStatus, packageVersion);
}

async function launchThemed(): Promise<void> {
  const theme = await manager.activeThemeInput();
  if (!theme) throw new Error('THEME_NOT_ENABLED');
  const launch = await themedLauncher.launch();
  if (launch.status === 'missing-installation') throw new Error('CODEX_INSTALLATION_MISSING');
  if (launch.status === 'pending-existing-process') {
    manager.setRuntimeState({ theme: 'pending', cdp: 'disconnected' });
    return;
  }
  manager.setRuntimeState({ theme: 'pending', cdp: 'connecting' });
  await startThemeRuntime(launch.port, theme, launch.packageVersion);
}

const isPrimaryInstance = acquireSingleInstanceLock(app);

if (isPrimaryInstance) {
  app.on('second-instance', () => revealManagerWindow(mainWindow));

  void app.whenReady().then(async () => {
  manager = new ManagerService(path.join(app.getPath('userData'), 'themes'));
  await manager.initialize();
  const cdp = new LoopbackCdpClient();
  runtime = new ThemeRuntimeCoordinator(cdp, new InjectionRuntime(), randomUUID);
  liveThemeSwitcher = new LiveThemeSwitcher(manager, runtime);
  const identity = new WindowsCodexIdentity();
  codexPlusAutoAttach = new CodexPlusAutoAttachCoordinator({
    activeTheme: () => manager.activeThemeInput(),
    runtimeState: () => manager.runtimeSnapshot(),
    packageVersion: async () => (await identity.findInstallation())?.version ?? null,
    isAvailable: (port) => cdp.isAvailable(port),
    attach: startThemeRuntime,
    setInterval,
    clearInterval,
  });
  themedLauncher = new ThemedLaunchCoordinator(
    identity,
    new WindowsAppLauncher(),
    () => allocateLoopbackPort(),
  );
  trayProxy = new TrayProxyCoordinator({
    identity,
    themedLauncher,
    activeTheme: () => manager.activeThemeInput(),
    applyTheme: startThemeRuntime,
    setRuntimeState: (state) => manager.setRuntimeState(state),
    setInterval,
    clearInterval,
    sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  });
  themeShortcut = new WindowsThemeShortcut(app.getPath('desktop'), shell);
  proxyEnabled = (await manager.snapshot()).proxy !== 'disabled';
  if (proxyEnabled) {
    createTray();
    await trayProxy.start();
  }
  codexPlusAutoAttach.start();

  ipcMain.handle('manager:snapshot', () => manager.snapshot());
  ipcMain.handle('manager:runtime-snapshot', () => manager.runtimeSnapshot());
  ipcMain.handle('theme:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入 Codex 主题包',
      properties: ['openFile'],
      filters: [{ name: 'Codex 主题包', extensions: ['codextheme'] }],
    });
    if (result.canceled || !result.filePaths[0]) return manager.snapshot();
    const snapshot = await manager.importTheme(result.filePaths[0]);
    publishSnapshot(snapshot);
    return snapshot;
  });
  ipcMain.handle('theme:analyze-image', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择主题背景图片', properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return manager.beginImageTheme(result.filePaths[0]);
  });
  ipcMain.handle('theme:analyze-image-path', (_event, imagePath: unknown) => {
    if (!isValidImagePath(imagePath)) throw new Error('IPC_ARGUMENT_INVALID');
    return manager.beginImageTheme(imagePath);
  });
  ipcMain.handle('theme:create-from-image', async (_event, input: unknown) => {
    if (!isImageThemeInput(input)) throw new Error('IPC_ARGUMENT_INVALID');
    const snapshot = await manager.createImageTheme(input);
    publishSnapshot(snapshot);
    return snapshot;
  });
  ipcMain.handle('theme:enable', async (_event, identity: unknown) => {
    if (!isIdentity(identity)) throw new Error('IPC_ARGUMENT_INVALID');
    const snapshot = await liveThemeSwitcher.switchTo(identity);
    runtimeActive = isThemeRuntimeActive(snapshot.theme);
    publishSnapshot(snapshot);
    codexPlusAutoAttach.start();
    return snapshot;
  });
  ipcMain.handle('theme:disable', async () => {
    const snapshot = await liveThemeSwitcher.switchToNative();
    runtimeActive = isThemeRuntimeActive(snapshot.theme);
    publishSnapshot(snapshot);
    return snapshot;
  });
  ipcMain.handle('theme:delete', (_event, identity: unknown) => {
    if (!isIdentity(identity)) throw new Error('IPC_ARGUMENT_INVALID');
    return manager.deleteTheme(identity.id, identity.version).then((snapshot) => { publishSnapshot(snapshot); return snapshot; });
  });
  ipcMain.handle('theme:rename', (_event, identity: unknown, name: unknown) => {
    if (!isValidThemeRenameInput(identity, name)) throw new Error('IPC_ARGUMENT_INVALID');
    return manager.renameTheme(identity.id, identity.version, String(name)).then((snapshot) => { publishSnapshot(snapshot); return snapshot; });
  });
  ipcMain.handle('theme:export', async (_event, identity: unknown) => {
    if (!isIdentity(identity)) throw new Error('IPC_ARGUMENT_INVALID');
    const result = await dialog.showSaveDialog({
      title: '导出 Codex 主题包',
      defaultPath: `${identity.id}-${identity.version}.codextheme`,
      filters: [{ name: 'Codex 主题包', extensions: ['codextheme'] }],
    });
    if (result.canceled || !result.filePath) return manager.snapshot();
    await manager.exportTheme(identity.id, identity.version, result.filePath);
    return manager.snapshot();
  });
  ipcMain.handle('proxy:set', async (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('IPC_ARGUMENT_INVALID');
    if (enabled) {
      createTray();
      try {
        await trayProxy.start();
        const snapshot = await manager.snapshot();
        if (snapshot.proxy === 'failed') throw new Error('CODEX_PROXY_UNAVAILABLE');
      } catch (error) {
        tray?.destroy();
        tray = null;
        throw error;
      }
      proxyEnabled = true;
      const result = await manager.setProxyEnabled(true);
      refreshTrayMenu();
      return result;
    }
    proxyEnabled = false;
    trayProxy.stop();
    const result = await manager.setProxyEnabled(false);
    refreshTrayMenu();
    return result;
  });
  ipcMain.handle('codex:launch-themed', async () => {
    await launchThemed();
    return manager.snapshot();
  });
  ipcMain.handle('shortcut:create', async () => {
    return themeShortcut.create(process.execPath);
  });
  ipcMain.handle('diagnostic:copy', async () => {
    const snapshot = await manager.snapshot();
    clipboard.writeText(snapshot.diagnostic);
  });
  ipcMain.handle('manager:restore', async () => {
    proxyEnabled = false;
    runtimeActive = false;
    codexPlusAutoAttach.stop();
    trayProxy.stop();
    let recovery: 'restored' | 'partial' = 'restored';
    try {
      await runtime.stop();
    } catch {
      recovery = 'partial';
    }
    try {
      await themeShortcut.removeOwned(process.execPath);
    } catch {
      recovery = 'partial';
    }
    const snapshot = await manager.restoreDefaults(recovery);
    tray?.destroy();
    tray = null;
    return snapshot;
  });

  mainWindow = createMainWindow();
  if (process.argv.includes('--launch-themed')) {
    void launchThemed().catch(() => manager.setRuntimeState({ theme: 'compatibility-degraded', cdp: 'failed' }));
  }
  });

  app.on('window-all-closed', () => {
    if (!shouldKeepManagerAlive({ proxyEnabled, runtimeActive, isQuitting })) app.quit();
  });

  app.on('before-quit', (event) => {
    isQuitting = true;
    codexPlusAutoAttach?.stop();
    trayProxy?.stop();
    if (shutdownInProgress || !runtime) return;
    shutdownInProgress = true;
    event.preventDefault();
    void runtime.stop().catch(() => undefined).finally(() => app.quit());
  });
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
