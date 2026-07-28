// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { CodexSkinApi } from '../../src/preload';
import type { ImageThemeDraft, ManagerSnapshot } from '../../src/shared/contracts/manager';

const snapshot: ManagerSnapshot = {
  theme: 'native', cdp: 'disconnected', proxy: 'disabled', recovery: 'idle', runtimeRunId: null, runtimeErrorCode: null, themes: [], diagnostic: '',
};
const draft: ImageThemeDraft = {
  token: 'draft-1', candidates: ['#236A90', '#C95F3D', '#34699A'], defaultAccent: '#236A90', readability: 'dark', focusX: 50, focusY: 50, imageLayout: 'standard', safeArea: 'center', previewDataUrl: 'data:image/webp;base64,cHJldmlldw==',
};

function api(analyzeImageThemeFile = vi.fn().mockResolvedValue(draft)): CodexSkinApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    getRuntimeSnapshot: vi.fn(),
    importTheme: vi.fn(),
    analyzeImageTheme: vi.fn(),
    analyzeImageThemeFile,
    createImageTheme: vi.fn(),
    enableTheme: vi.fn(),
    disableTheme: vi.fn(),
    deleteTheme: vi.fn(),
    renameTheme: vi.fn(),
    exportTheme: vi.fn(),
    setProxyEnabled: vi.fn(),
    launchThemedCodex: vi.fn(),
    createThemedShortcut: vi.fn(),
    copyDiagnostic: vi.fn(),
    restoreDefaults: vi.fn(),
    onSnapshotChanged: vi.fn(() => vi.fn()),
  };
}

async function renderApp(codexSkin: CodexSkinApi) {
  window.codexSkin = codexSkin;
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<App />));
  await act(async () => { await Promise.resolve(); });
  return { container, root };
}

function drop(target: Element, files: File[]) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  target.dispatchEvent(event);
}

describe('App image drag and drop', () => {
  beforeEach(() => vi.clearAllMocks());

  it('analyzes one dropped image file', async () => {
    const analyzeImageThemeFile = vi.fn().mockResolvedValue(draft);
    const { container, root } = await renderApp(api(analyzeImageThemeFile));
    const createButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('从图片创建主题'));
    act(() => createButton?.click());
    const target = container.querySelector('[data-image-drop-zone]');

    act(() => drop(target!, [new File(['image'], 'sample.png', { type: 'image/png' })]));
    await act(async () => { await Promise.resolve(); });

    expect(analyzeImageThemeFile).toHaveBeenCalledOnce();
    expect(container.querySelector('.image-theme-creator')).not.toBeNull();
    root.unmount();
  });

  it('rejects multiple dropped files', async () => {
    const analyzeImageThemeFile = vi.fn().mockResolvedValue(draft);
    const { container, root } = await renderApp(api(analyzeImageThemeFile));
    const createButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('从图片创建主题'));
    act(() => createButton?.click());
    const target = container.querySelector('[data-image-drop-zone]');

    act(() => drop(target!, [new File(['a'], 'a.png'), new File(['b'], 'b.png')]));

    expect(analyzeImageThemeFile).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('一次只能拖入一张图片');
    root.unmount();
  });

  it('shows image source choices before opening the native file picker', async () => {
    const analyzeImageTheme = vi.fn().mockResolvedValue(null);
    const codexSkin = { ...api(), analyzeImageTheme };
    const { container, root } = await renderApp(codexSkin);
    const createButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('从图片创建主题'));

    act(() => createButton?.click());

    expect(analyzeImageTheme).not.toHaveBeenCalled();
    expect(container.querySelector('[data-image-drop-zone]')?.textContent).toContain('拖入图片');
    const chooseFileButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('选择文件'));
    act(() => chooseFileButton?.click());
    expect(analyzeImageTheme).toHaveBeenCalledOnce();
    root.unmount();
  });
});
