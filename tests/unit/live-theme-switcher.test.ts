import { describe, expect, it, vi } from 'vitest';
import type { ManagerSnapshot, ThemeIdentity } from '../../src/shared/contracts/manager';
import { LiveThemeSwitcher } from '../../src/core/runtime/live-theme-switcher';

const first: ThemeIdentity = { id: 'first', version: '1.0.0' };
const second: ThemeIdentity = { id: 'second', version: '1.0.0' };
const themeInput = { variables: { accent: '#2f6f63' }, slots: { header: 'compact' as const }, motion: { enabled: false }, copy: { greeting: 'Welcome' } };

function snapshot(active: ThemeIdentity | null, cdp: ManagerSnapshot['cdp'] = 'connected'): ManagerSnapshot {
  return {
    theme: active ? 'pending' : 'native', cdp, proxy: 'disabled', recovery: 'idle',
    runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null, diagnostic: '',
    themes: [first, second].map((theme) => ({ ...theme, name: theme.id, source: 'unknown' as const, active: theme.id === active?.id, accent: '#2f6f63', previewDataUrl: '' })),
  };
}

function createFixture(options?: { cdp?: ManagerSnapshot['cdp']; switchError?: Error }) {
  let active: ThemeIdentity | null = first;
  let themeState: ManagerSnapshot['theme'] = (options?.cdp ?? 'connected') === 'connected' ? 'applied' : 'pending';
  const manager = {
    snapshot: vi.fn(() => Promise.resolve({ ...snapshot(active, options?.cdp ?? 'connected'), theme: themeState })),
    enableTheme: vi.fn((id: string, version: string) => { active = { id, version }; return Promise.resolve(snapshot(active, options?.cdp ?? 'connected')); }),
    disableTheme: vi.fn(() => { active = null; return Promise.resolve(snapshot(active, options?.cdp ?? 'connected')); }),
    activeThemeInput: vi.fn(() => Promise.resolve(themeInput)),
    setRuntimeState: vi.fn((state: Partial<ManagerSnapshot>) => { if (state.theme) themeState = state.theme; }),
  };
  const runtime = {
    switchTheme: options?.switchError ? vi.fn(() => Promise.reject(new Error(options.switchError?.message))) : vi.fn(() => { themeState = 'applied'; return Promise.resolve(true); }),
    clearTheme: vi.fn(() => Promise.resolve(true)),
  };
  return { manager, runtime, switcher: new LiveThemeSwitcher(manager, runtime) };
}

describe('LiveThemeSwitcher', () => {
  it('persists and applies a selected theme through the connected runtime', async () => {
    const fixture = createFixture();

    const result = await fixture.switcher.switchTo(second);

    expect(fixture.manager.enableTheme).toHaveBeenCalledWith('second', '1.0.0');
    expect(fixture.runtime.switchTheme).toHaveBeenCalledWith(themeInput);
    expect(result.themes.find((theme) => theme.id === 'second')?.active).toBe(true);
    expect(result.theme).toBe('applied');
  });

  it('persists a theme for the next launch when CDP is disconnected', async () => {
    const fixture = createFixture({ cdp: 'disconnected' });

    const result = await fixture.switcher.switchTo(second);

    expect(fixture.runtime.switchTheme).not.toHaveBeenCalled();
    expect(fixture.manager.setRuntimeState).toHaveBeenCalledWith({ theme: 'pending' });
    expect(result.theme).toBe('pending');
  });

  it('restores the previous selection when a live switch fails', async () => {
    const fixture = createFixture({ switchError: new Error('NEW_THEME_FAILED') });

    await expect(fixture.switcher.switchTo(second)).rejects.toThrow('NEW_THEME_FAILED');

    expect(fixture.manager.enableTheme).toHaveBeenLastCalledWith('first', '1.0.0');
    expect(fixture.manager.setRuntimeState).toHaveBeenLastCalledWith({ theme: 'applied' });
  });

  it('restores native appearance through the connected runtime', async () => {
    const fixture = createFixture();

    const result = await fixture.switcher.switchToNative();

    expect(fixture.runtime.clearTheme).toHaveBeenCalledOnce();
    expect(fixture.manager.disableTheme).toHaveBeenCalledOnce();
    expect(result.theme).toBe('native');
  });
});
