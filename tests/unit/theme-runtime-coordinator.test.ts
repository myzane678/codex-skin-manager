import { describe, expect, it, vi } from 'vitest';
import type { CdpBrowserIdentity, CdpPageSession, CdpPort, CdpTarget } from '../../src/core/ports/runtime-ports';
import { ThemeRuntimeCoordinator, WELCOME_PROBE, type InjectionPort } from '../../src/core/runtime/theme-runtime-coordinator';

const target: CdpTarget = {
  id: 'target-1',
  type: 'page',
  title: 'Codex',
  url: 'app://codex',
  webSocketDebuggerUrl: 'ws://127.0.0.1:9335/devtools/page/target-1',
};

const theme = {
  variables: { accent: '#2f6f63' },
  slots: { header: 'compact' as const },
  motion: { enabled: false },
  copy: { greeting: 'Welcome' },
};

const alternateTheme = {
  ...theme,
  variables: { accent: '#a6422d' },
  background: {
    dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==',
    placement: 'cover' as const,
    focusX: 50,
    focusY: 50,
    readability: 'dark' as const,
  },
};

function createSession(probes: unknown[]) {
  let index = 0;
  const loads = new Set<() => void>();
  const disconnects = new Set<() => void>();
  let calls = 0;
  function call<T>(method: string, _params?: Record<string, unknown>): Promise<T> {
    void _params;
    calls += 1;
    if (method === 'Runtime.evaluate') return Promise.resolve(probes[Math.min(index++, probes.length - 1)] as T);
    return Promise.resolve({} as T);
  }
  const session: CdpPageSession = {
    call,
    onLoad: (listener) => { loads.add(listener); return () => loads.delete(listener); },
    onDisconnect: (listener) => { disconnects.add(listener); return () => disconnects.delete(listener); },
    isOpen: () => true,
    close: vi.fn(),
  };
  return {
    session,
    callCount: () => calls,
    fireLoad: () => loads.forEach((listener) => listener()),
    fireDisconnect: () => disconnects.forEach((listener) => listener()),
  };
}

function createCdp(session: CdpPageSession): CdpPort {
  const identity: CdpBrowserIdentity = { browserId: 'browser-1' };
  return {
    readBrowserIdentity: vi.fn(() => Promise.resolve(identity)),
    listTargets: vi.fn(() => Promise.resolve([target])),
    openPageSession: vi.fn(() => Promise.resolve(session)),
    call: vi.fn(),
  };
}

const welcome = { result: { value: { adapterId: 'codex-26.715.4045', isCompatibleShell: true, isWelcomePage: true, nativeControlsVisible: true, composerVisible: true, projectSelectorVisible: true } } };
const latestWelcome = { result: { value: { ...welcome.result.value, adapterId: 'codex-26.721.4979' } } };
const task = { result: { value: { adapterId: 'codex-26.715.4045', isCompatibleShell: true, isWelcomePage: false, nativeControlsVisible: true, composerVisible: true, projectSelectorVisible: true } } };
const incompatible = { result: { value: { adapterId: 'codex-26.715.4045', isCompatibleShell: false, isWelcomePage: false, nativeControlsVisible: true, composerVisible: true, projectSelectorVisible: true } } };

describe('ThemeRuntimeCoordinator', () => {
  it('probes the observed Codex welcome-page structural sentinels', () => {
    expect(WELCOME_PROBE).toContain('header-shell-slot');
    expect(WELCOME_PROBE).toContain('app-shell-header-context-menu-surface');
    expect(WELCOME_PROBE).toContain('main,[role="main"]');
    expect(WELCOME_PROBE).toContain('[role="navigation"]');
    expect(WELCOME_PROBE).toContain('[data-testid="home-icon"]');
    expect(WELCOME_PROBE).toContain("document.querySelectorAll('[role=\"main\"]')");
  });

  it('injects an unverified Codex version after the latest adapter probe passes', async () => {
    const fixture = createSession([latestWelcome, latestWelcome]);
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const state = vi.fn();
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, state, '26.721.11231.0');

    expect(injector.apply).toHaveBeenCalledOnce();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({
      phase: 'applied',
      adapterId: 'codex-26.721.4979',
      compatibility: 'unverified',
    }));
  });

  it('reports compatibility degradation when an unverified-version probe fails', async () => {
    vi.useFakeTimers();
    const fixture = createSession([{
      result: { value: { ...incompatible.result.value, adapterId: 'codex-26.721.4979' } },
    }]);
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const state = vi.fn();
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    const started = coordinator.start(9335, theme, state, '26.721.11231.0');
    await vi.runAllTimersAsync();
    await started;

    expect(injector.apply).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({
      phase: 'compatibility-degraded',
      errorCode: 'CODEX_PROBE_FAILED',
      adapterId: 'codex-26.721.4979',
    }));
    vi.useRealTimers();
  });

  it('fails closed when the CDP probe identifies a different adapter', async () => {
    const wrongAdapter = { result: { value: { ...welcome.result.value, adapterId: 'codex-99.0.0' } } };
    const fixture = createSession([wrongAdapter]);
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const state = vi.fn();
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, state);

    expect(injector.apply).not.toHaveBeenCalled();
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'compatibility-degraded', errorCode: 'CODEX_ADAPTER_MISMATCH' }));
  });

  it('treats the observed current shell without a route main as the welcome page', () => {
    expect(WELCOME_PROBE).toContain("document.querySelectorAll('[role=\"main\"]').length === 0");
  });

  it('injects on a verified welcome page and keeps the shell theme after entering a task', async () => {
    const fixture = createSession([welcome, welcome, task]);
    const injector = {
      apply: vi.fn<InjectionPort['apply']>(),
      rollback: vi.fn<InjectionPort['rollback']>(() => Promise.resolve()),
      installEarly: vi.fn().mockResolvedValueOnce('early-1').mockResolvedValueOnce('early-2'),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());
    const firstPlan = injector.apply.mock.calls[0]?.[1];
    expect(firstPlan?.runId).toBe('run-1');
    expect(firstPlan?.shell).toMatchObject({ main: 'main.main-surface', composer: 'textarea, [contenteditable="true"][role="textbox"]' });
    expect(firstPlan?.decoration).toBeNull();
    expect(injector.installEarly).toHaveBeenCalledWith(fixture.session, firstPlan);

    await coordinator.refresh();
    expect(injector.removeEarly).not.toHaveBeenCalled();
    expect(injector.installEarly).toHaveBeenCalledTimes(1);
    expect(injector.rollback).not.toHaveBeenCalled();
    expect(injector.apply).toHaveBeenCalledTimes(1);
  });

  it('keeps the active runtime mounted when a route switch changes only page scope', async () => {
    const fixture = createSession([welcome, welcome, task]);
    const injector = {
      apply: vi.fn<InjectionPort['apply']>(),
      rollback: vi.fn<InjectionPort['rollback']>(),
      installEarly: vi.fn().mockResolvedValueOnce('early-1').mockResolvedValueOnce('early-2'),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());
    await coordinator.refresh();

    expect(injector.rollback).not.toHaveBeenCalled();
    expect(injector.apply).toHaveBeenCalledTimes(1);
    expect(injector.removeEarly).not.toHaveBeenCalled();
    expect(injector.installEarly).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the verified Codex shell disappears', async () => {
    const fixture = createSession([welcome, welcome, incompatible]);
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());
    await coordinator.refresh();

    expect(injector.rollback).toHaveBeenCalledWith(fixture.session, 'run-1');
  });

  it('rechecks the current page after a load event without duplicating the active run', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const injector = {
      apply: vi.fn(() => Promise.resolve()),
      rollback: vi.fn(() => Promise.resolve()),
      installEarly: vi.fn(() => Promise.resolve('early-1')),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());
    fixture.fireLoad();
    await vi.waitFor(() => expect(fixture.callCount()).toBe(4));

    expect(injector.apply).toHaveBeenCalledTimes(1);
    expect(injector.installEarly).toHaveBeenCalledTimes(1);
    expect(injector.removeEarly).not.toHaveBeenCalled();
  });

  it('keeps the live injection active when early-script registration is unavailable', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const injector = {
      apply: vi.fn(() => Promise.resolve()),
      rollback: vi.fn(() => Promise.resolve()),
      installEarly: vi.fn(() => Promise.reject(new Error('CDP_EARLY_UNAVAILABLE'))),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());

    expect(injector.apply).toHaveBeenCalledTimes(1);
    fixture.fireLoad();
    await vi.waitFor(() => expect(injector.apply).toHaveBeenCalledTimes(2));
  });

  it('reapplies the active plan when the renderer audit reports it missing', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const injector = {
      apply: vi.fn(() => Promise.resolve()),
      rollback: vi.fn(() => Promise.resolve()),
      isApplied: vi.fn(() => Promise.resolve(false)),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, vi.fn());
    await coordinator.refresh();

    expect(injector.isApplied).toHaveBeenCalledWith(fixture.session, 'run-1');
    expect(injector.apply).toHaveBeenCalledTimes(2);
  });

  it('reconnects to a replacement verified target after the active target disconnects', async () => {
    const replacementTarget = { ...target, id: 'target-2', webSocketDebuggerUrl: 'ws://127.0.0.1:9335/devtools/page/target-2' };
    const first = createSession([welcome, welcome]);
    const second = createSession([welcome, welcome]);
    const cdp: CdpPort = {
      readBrowserIdentity: vi.fn(() => Promise.resolve({ browserId: 'browser-1' })),
      listTargets: vi.fn()
        .mockResolvedValueOnce([target])
        .mockResolvedValueOnce([target])
        .mockResolvedValueOnce([replacementTarget])
        .mockResolvedValue([replacementTarget]),
      openPageSession: vi.fn()
        .mockResolvedValueOnce(first.session)
        .mockResolvedValueOnce(second.session),
      call: vi.fn(),
    };
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const coordinator = new ThemeRuntimeCoordinator(cdp, injector, vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('run-2'));

    await coordinator.start(9335, theme, vi.fn());
    first.fireDisconnect();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    await vi.waitFor(() => expect(cdp.openPageSession).toHaveBeenCalledTimes(2));

    expect(injector.apply).toHaveBeenLastCalledWith(second.session, expect.objectContaining({ runId: 'run-2' }));
  });

  it('clears local state without rolling back through a disconnected session', async () => {
    const fixture = createSession([welcome]);
    const injector = { apply: vi.fn(() => Promise.resolve()), rollback: vi.fn(() => Promise.resolve()) };
    const state = vi.fn();
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, () => 'run-1');

    await coordinator.start(9335, theme, state);
    fixture.fireDisconnect();
    await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'disconnected' })));

    expect(injector.rollback).not.toHaveBeenCalled();
  });

  it('switches themes through the existing page session without reconnecting', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const cdp = createCdp(fixture.session);
    const injector = {
      apply: vi.fn<InjectionPort['apply']>(),
      rollback: vi.fn<InjectionPort['rollback']>(),
      installEarly: vi.fn().mockResolvedValueOnce('early-1').mockResolvedValueOnce('early-2'),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(cdp, injector, vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('run-2'));

    await coordinator.start(9335, theme, vi.fn());
    await expect(coordinator.switchTheme(alternateTheme)).resolves.toBe(true);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(cdp.openPageSession).toHaveBeenCalledTimes(1);
    expect(injector.apply).toHaveBeenLastCalledWith(fixture.session, expect.objectContaining({
      runId: 'run-2',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      styleText: expect.stringContaining('#a6422d'),
    }));
    expect(injector.removeEarly).toHaveBeenCalledWith(fixture.session, 'early-1');
    expect(injector.rollback).not.toHaveBeenCalled();
  });

  it('restores the previous theme when a live switch fails', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const injector = {
      apply: vi.fn<InjectionPort['apply']>()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('NEW_THEME_FAILED'))
        .mockResolvedValueOnce(undefined),
      rollback: vi.fn<InjectionPort['rollback']>(() => Promise.resolve()),
      installEarly: vi.fn().mockResolvedValueOnce('early-1').mockResolvedValueOnce('early-2'),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(createCdp(fixture.session), injector, vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('run-2'));

    await coordinator.start(9335, theme, vi.fn());
    await expect(coordinator.switchTheme(alternateTheme)).rejects.toThrow('NEW_THEME_FAILED');

    expect(injector.removeEarly).toHaveBeenCalledWith(fixture.session, 'early-2');
    expect(injector.apply).toHaveBeenLastCalledWith(fixture.session, expect.objectContaining({ runId: 'run-1' }));
  });

  it('clears the current theme while retaining the connected page session', async () => {
    const fixture = createSession([welcome, welcome, welcome]);
    const cdp = createCdp(fixture.session);
    const injector = {
      apply: vi.fn<InjectionPort['apply']>(),
      rollback: vi.fn<InjectionPort['rollback']>(),
      installEarly: vi.fn().mockResolvedValueOnce('early-1').mockResolvedValueOnce('early-2'),
      removeEarly: vi.fn(() => Promise.resolve()),
    };
    const coordinator = new ThemeRuntimeCoordinator(cdp, injector, vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('run-2'));

    await coordinator.start(9335, theme, vi.fn());
    await expect(coordinator.clearTheme()).resolves.toBe(true);
    await expect(coordinator.switchTheme(alternateTheme)).resolves.toBe(true);

    expect(injector.rollback).toHaveBeenCalledWith(fixture.session, 'run-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fixture.session.close).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(cdp.openPageSession).toHaveBeenCalledTimes(1);
  });
});
