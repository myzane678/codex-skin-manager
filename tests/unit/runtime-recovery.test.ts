import { describe, expect, it, vi } from 'vitest';
import { nativeRuntimeState, reduceRuntimeState } from '../../src/core/runtime/runtime-state';
import { ManualActionRequired, restoreDefaults } from '../../src/core/runtime/recovery';

describe('runtime state', () => {
  it('returns to pending after leaving the welcome page while a theme remains enabled', () => {
    const enabled = reduceRuntimeState(nativeRuntimeState, { type: 'theme-enabled' });
    const applied = reduceRuntimeState(enabled, { type: 'injection-applied' });
    expect(reduceRuntimeState(applied, { type: 'page-left-welcome' }).theme).toBe('pending');
  });

  it('keeps proxy and connection states independent from theme state', () => {
    const proxy = reduceRuntimeState(nativeRuntimeState, { type: 'proxy-enabled' });
    const connected = reduceRuntimeState(proxy, { type: 'cdp-connected' });
    expect(connected).toEqual({ theme: 'native', cdp: 'connected', proxy: 'watching', recovery: 'idle' });
  });
});

describe('restoreDefaults', () => {
  it('continues independent recovery steps after a failure', async () => {
    const clearRuntime = vi.fn(() => Promise.resolve());
    const report = await restoreDefaults({
      rollbackInjection: () => Promise.reject(new Error('ROLLBACK_FAILED')),
      disableTheme: () => Promise.resolve(),
      stopProxy: () => Promise.resolve(),
      removeOwnedShortcut: () => Promise.reject(new ManualActionRequired('SHORTCUT_MANUAL')),
      clearRuntime,
    });

    expect(clearRuntime).toHaveBeenCalledOnce();
    expect(report.status).toBe('manual-action');
    expect(report.steps).toHaveLength(5);
  });
});
