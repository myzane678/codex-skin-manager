import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppSnapshot } from './shared/contracts/app-snapshot';
import type { CreateImageThemeInput, ImageThemeDraft, ManagerSnapshot, ThemeIdentity } from './shared/contracts/manager';

export interface CodexSkinApi {
  getSnapshot(): Promise<ManagerSnapshot>;
  getRuntimeSnapshot(): Promise<AppSnapshot>;
  importTheme(): Promise<ManagerSnapshot>;
  analyzeImageTheme(): Promise<ImageThemeDraft | null>;
  analyzeImageThemeFile(file: File): Promise<ImageThemeDraft>;
  createImageTheme(input: CreateImageThemeInput): Promise<ManagerSnapshot>;
  enableTheme(identity: ThemeIdentity): Promise<ManagerSnapshot>;
  disableTheme(): Promise<ManagerSnapshot>;
  deleteTheme(identity: ThemeIdentity): Promise<ManagerSnapshot>;
  renameTheme(identity: ThemeIdentity, name: string): Promise<ManagerSnapshot>;
  exportTheme(identity: ThemeIdentity): Promise<ManagerSnapshot>;
  setProxyEnabled(enabled: boolean): Promise<ManagerSnapshot>;
  launchThemedCodex(): Promise<ManagerSnapshot>;
  createThemedShortcut(): Promise<string>;
  copyDiagnostic(): Promise<void>;
  restoreDefaults(): Promise<ManagerSnapshot>;
  onSnapshotChanged(listener: (snapshot: ManagerSnapshot) => void): () => void;
}

const api: CodexSkinApi = {
  getSnapshot: () => ipcRenderer.invoke('manager:snapshot') as Promise<ManagerSnapshot>,
  getRuntimeSnapshot: () => ipcRenderer.invoke('manager:runtime-snapshot') as Promise<AppSnapshot>,
  importTheme: () => ipcRenderer.invoke('theme:import') as Promise<ManagerSnapshot>,
  analyzeImageTheme: () => ipcRenderer.invoke('theme:analyze-image') as Promise<ImageThemeDraft | null>,
  analyzeImageThemeFile: (file) => ipcRenderer.invoke('theme:analyze-image-path', webUtils.getPathForFile(file)) as Promise<ImageThemeDraft>,
  createImageTheme: (input) => ipcRenderer.invoke('theme:create-from-image', input) as Promise<ManagerSnapshot>,
  enableTheme: (identity) => ipcRenderer.invoke('theme:enable', identity) as Promise<ManagerSnapshot>,
  disableTheme: () => ipcRenderer.invoke('theme:disable') as Promise<ManagerSnapshot>,
  deleteTheme: (identity) => ipcRenderer.invoke('theme:delete', identity) as Promise<ManagerSnapshot>,
  renameTheme: (identity, name) => ipcRenderer.invoke('theme:rename', identity, name) as Promise<ManagerSnapshot>,
  exportTheme: (identity) => ipcRenderer.invoke('theme:export', identity) as Promise<ManagerSnapshot>,
  setProxyEnabled: (enabled) => ipcRenderer.invoke('proxy:set', enabled) as Promise<ManagerSnapshot>,
  launchThemedCodex: () => ipcRenderer.invoke('codex:launch-themed') as Promise<ManagerSnapshot>,
  createThemedShortcut: () => ipcRenderer.invoke('shortcut:create') as Promise<string>,
  copyDiagnostic: () => ipcRenderer.invoke('diagnostic:copy') as Promise<void>,
  restoreDefaults: () => ipcRenderer.invoke('manager:restore') as Promise<ManagerSnapshot>,
  onSnapshotChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: ManagerSnapshot) => listener(snapshot);
    ipcRenderer.on('manager:snapshot-changed', handler);
    return () => ipcRenderer.removeListener('manager:snapshot-changed', handler);
  },
};

contextBridge.exposeInMainWorld('codexSkin', api);

declare global {
  interface Window {
    codexSkin: CodexSkinApi;
  }
}
