// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { CodexSkinApi } from '../../src/preload';
import type { ManagerSnapshot } from '../../src/shared/contracts/manager';

const nativeSnapshot: ManagerSnapshot = {
  theme: 'native', cdp: 'connected', proxy: 'watching', recovery: 'idle', runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null, themes: [], diagnostic: '',
};
const appliedSnapshot: ManagerSnapshot = {
  ...nativeSnapshot, theme: 'applied', themes: [{ id: 'night', version: '1.0.0', name: 'Night', source: 'unknown', active: true, accent: '#2f6f63', previewDataUrl: 'data:image/png;base64,' }],
};

function api(onSnapshotChanged: CodexSkinApi['onSnapshotChanged']): CodexSkinApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(nativeSnapshot), getRuntimeSnapshot: vi.fn(), importTheme: vi.fn(), analyzeImageTheme: vi.fn(), analyzeImageThemeFile: vi.fn(), createImageTheme: vi.fn(), enableTheme: vi.fn(), disableTheme: vi.fn(), deleteTheme: vi.fn(), renameTheme: vi.fn(), exportTheme: vi.fn(), setProxyEnabled: vi.fn(), launchThemedCodex: vi.fn(), createThemedShortcut: vi.fn(), copyDiagnostic: vi.fn(), restoreDefaults: vi.fn(), onSnapshotChanged,
  };
}

describe('App live theme snapshot', () => {
  it('updates the current theme when the main process pushes a snapshot', async () => {
    let listener: ((snapshot: ManagerSnapshot) => void) | null = null;
    const unsubscribe = vi.fn();
    const { container, root } = await (async () => {
      window.codexSkin = api((next) => { listener = next; return unsubscribe; });
      const host = document.createElement('div');
      const appRoot = createRoot(host);
      act(() => appRoot.render(<App />));
      await act(async () => { await Promise.resolve(); });
      return { container: host, root: appRoot };
    })();

    expect(container.textContent).toContain('主题库');
    act(() => listener?.(appliedSnapshot));
    expect(container.textContent).toContain('Night');
    expect(container.textContent).toContain('已应用');

    root.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
