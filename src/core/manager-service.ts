import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { importThemePackage, type InstalledTheme } from './theme-package/import-theme';
import { ThemeStorage } from './storage/theme-storage';
import { parseThemeManifest } from '../shared/contracts/theme-manifest';
import type { CompileThemeInput } from './theme-runtime/compiler';
import type { AppSnapshot } from '../shared/contracts/app-snapshot';
import type { ManagerSnapshot, ThemeView } from '../shared/contracts/manager';
import type { CreateImageThemeInput, ImageThemeDraft } from '../shared/contracts/manager';
import { ImageThemeCreator } from './image-theme/image-theme-creator';

export class ManagerService {
  private readonly storage: ThemeStorage;
  private readonly imageThemeCreator: ImageThemeCreator;
  private state: AppSnapshot = {
    theme: 'native',
    cdp: 'disconnected',
    proxy: 'disabled',
    recovery: 'idle',
    runtimeRunId: null,
    runtimeErrorCode: null,
    runtimeAdapterId: null,
  };

  constructor(private readonly dataRoot: string) {
    this.storage = new ThemeStorage(dataRoot);
    this.imageThemeCreator = new ImageThemeCreator(path.join(path.dirname(dataRoot), 'drafts'), this);
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    const config = await this.storage.readConfig();
    this.state = {
      ...this.state,
      theme: config.currentThemeId ? 'pending' : 'native',
      proxy: config.proxyEnabled ? 'watching' : 'disabled',
    };
  }

  async snapshot(): Promise<ManagerSnapshot> {
    const config = await this.storage.readConfig();
    const themes = await Promise.all((await this.storage.listThemes()).map((theme) => this.toView(theme, config.currentThemeId, config.currentThemeVersion)));
    return {
      ...this.state,
      themes,
      diagnostic: this.diagnosticText(config.currentThemeId, config.currentThemeVersion),
    };
  }

  async activeThemeInput(): Promise<Omit<CompileThemeInput, 'runId'> | null> {
    const config = await this.storage.readConfig();
    if (!config.currentThemeId || !config.currentThemeVersion) return null;
    const theme = await this.findTheme(config.currentThemeId, config.currentThemeVersion);
    const manifest = parseThemeManifest(JSON.parse(await readFile(path.join(theme.installPath, 'manifest.json'), 'utf8')) as unknown);
    const background = manifest.background
      ? await this.readBackgroundInput(theme.installPath, manifest.background, manifest.assets)
      : undefined;
    return {
      variables: manifest.variables,
      slots: manifest.slots,
      motion: manifest.motion,
      copy: manifest.copy,
      ...(manifest.appearance ? { appearance: manifest.appearance } : {}),
      ...(manifest.shell ? { shell: manifest.shell } : {}),
      ...(background ? { background } : {}),
    };
  }

  runtimeSnapshot(): AppSnapshot {
    return { ...this.state };
  }

  setRuntimeState(state: Partial<AppSnapshot>): void {
    this.state = { ...this.state, ...state };
  }

  async importTheme(archivePath: string): Promise<ManagerSnapshot> {
    await importThemePackage(archivePath, this.dataRoot);
    return this.snapshot();
  }

  async beginImageTheme(imagePath: string): Promise<ImageThemeDraft> {
    return this.imageThemeCreator.begin(imagePath);
  }

  async createImageTheme(input: CreateImageThemeInput): Promise<ManagerSnapshot> {
    return this.imageThemeCreator.create(input);
  }

  async enableTheme(id: string, version: string): Promise<ManagerSnapshot> {
    const theme = await this.findTheme(id, version);
    await this.storage.setCurrentTheme(theme);
    this.state.theme = 'pending';
    return this.snapshot();
  }

  async disableTheme(): Promise<ManagerSnapshot> {
    await this.storage.setCurrentTheme(null);
    this.state.theme = 'native';
    return this.snapshot();
  }

  async deleteTheme(id: string, version: string): Promise<ManagerSnapshot> {
    await this.storage.deleteTheme(await this.findTheme(id, version));
    return this.snapshot();
  }

  async renameTheme(id: string, version: string, name: string): Promise<ManagerSnapshot> {
    await this.storage.renameTheme(await this.findTheme(id, version), name);
    return this.snapshot();
  }

  async exportTheme(id: string, version: string, destination: string): Promise<void> {
    const theme = await this.findTheme(id, version);
    await copyFile(path.join(theme.installPath, 'package.codextheme'), destination);
  }

  async setProxyEnabled(enabled: boolean): Promise<ManagerSnapshot> {
    await this.storage.setProxyEnabled(enabled);
    this.state.proxy = enabled ? 'watching' : 'disabled';
    return this.snapshot();
  }

  async restoreDefaults(recovery: 'restored' | 'partial' | 'manual-action' = 'restored'): Promise<ManagerSnapshot> {
    this.state.theme = 'recovering';
    this.state.recovery = 'running';
    await this.storage.setCurrentTheme(null);
    await this.storage.setProxyEnabled(false);
    this.state = { theme: 'native', cdp: 'disconnected', proxy: 'disabled', recovery, runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null };
    return this.snapshot();
  }

  private async findTheme(id: string, version: string): Promise<InstalledTheme> {
    const theme = (await this.storage.listThemes()).find((candidate) => candidate.id === id && candidate.version === version);
    if (!theme) throw new Error('THEME_NOT_FOUND');
    return theme;
  }

  private async toView(theme: InstalledTheme, currentId: string | null, currentVersion: string | null): Promise<ThemeView> {
    const manifest = parseThemeManifest(JSON.parse(await readFile(path.join(theme.installPath, 'manifest.json'), 'utf8')) as unknown);
    const preview = await readFile(path.join(theme.installPath, ...manifest.preview.path.split('/')));
    return {
      id: theme.id,
      version: theme.version,
      name: theme.name,
      source: 'unknown',
      active: theme.id === currentId && theme.version === currentVersion,
      accent: manifest.variables.accent,
      previewDataUrl: `data:${manifest.preview.mime};base64,${preview.toString('base64')}`,
    };
  }

  private async readBackgroundInput(
    installPath: string,
    background: NonNullable<ReturnType<typeof parseThemeManifest>['background']>,
    assets: ReturnType<typeof parseThemeManifest>['assets'],
  ): Promise<NonNullable<CompileThemeInput['background']>> {
    const asset = assets.find((candidate) => candidate.path === background.assetPath);
    if (!asset) throw new Error('THEME_BACKGROUND_INVALID');
    const data = await readFile(path.join(installPath, ...asset.path.split('/')));
    return {
      dataUrl: `data:${asset.mime};base64,${data.toString('base64')}`,
      placement: background.placement,
      focusX: background.focusX,
      focusY: background.focusY,
      readability: background.readability,
      ...(background.imageLayout ? { imageLayout: background.imageLayout } : {}),
      ...(background.safeArea ? { safeArea: background.safeArea } : {}),
      ...(background.taskMode ? { taskMode: background.taskMode } : {}),
    };
  }

  private diagnosticText(themeId: string | null, themeVersion: string | null): string {
    return [
      `主题状态: ${this.state.theme}`,
      `CDP: ${this.state.cdp}`,
      `代理: ${this.state.proxy}`,
      `恢复: ${this.state.recovery}`,
      `注入运行 ID: ${this.state.runtimeRunId ?? '无'}`,
      `版本适配器: ${this.state.runtimeAdapterId ?? '无'}`,
      `运行时错误: ${this.state.runtimeErrorCode ?? '无'}`,
      `当前主题: ${themeId ? `${themeId}@${themeVersion}` : '无'}`,
    ].join('\n');
  }
}
