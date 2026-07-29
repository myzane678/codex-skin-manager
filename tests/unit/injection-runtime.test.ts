/* eslint-disable @typescript-eslint/no-implied-eval -- JSDOM 夹具需执行注入函数源码。 */
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import type { CdpPageSession } from '../../src/core/ports/runtime-ports';
import { APPLY_FUNCTION, EARLY_APPLY_FUNCTION, InjectionRuntime, ROLLBACK_FUNCTION } from '../../src/core/theme-runtime/injection-runtime';

function execute<TArgs extends unknown[]>(source: string, window: { Function: FunctionConstructor }, ...args: TArgs): unknown {
  const factory = window.Function(`return (${source})`) as () => unknown;
  const candidate = factory();
  if (typeof candidate !== 'function') throw new Error('Injection fixture is not callable');
  return Reflect.apply(candidate, undefined, args);
}

function plan(runId: string) {
  return {
    runId,
    styleText: `[data-codex-skin="${runId}"]{color:#000}`,
    shell: {
      header: '[data-testid="app-shell-header-context-menu-surface"]',
      navigation: 'aside.app-shell-left-panel [role="navigation"], aside.app-shell-left-panel nav',
      sidebar: 'aside.app-shell-left-panel',
      main: 'main.main-surface',
      routeMain: '[role="main"]',
      homeMarker: '[data-testid="home-icon"]',
      projectSelector: '[data-testid="project-selector"]',
      composer: 'textarea',
    },
    presentation: { appearance: 'light' as const, imageLayout: 'wide' as const, safeArea: 'left' as const, taskMode: 'ambient' as const },
    decoration: { className: 'codex-skin-decoration', text: 'Welcome' },
  };
}

function legacyPlan(runId: string) {
  return {
    ...plan(runId),
    shell: {
      ...plan(runId).shell,
      header: '[data-testid="app-shell-header-context-menu-surface"]',
      navigation: 'nav',
      sidebar: 'body',
      main: '[role="main"]',
    },
  };
}

const shell = '<!doctype html><html><head></head><body><header data-testid="app-shell-header-context-menu-surface"></header><nav><button>Native nav</button></nav><main role="main"><button>Native action</button><input value="Native input"></main></body></html>';
const currentCodexShell = '<!doctype html><html><head></head><body><aside class="app-shell-left-panel"><nav role="navigation"><button>Native nav</button></nav></aside><main class="main-surface"><header data-testid="app-shell-header-context-menu-surface"></header><button>Native action</button><input value="Native input"></main></body></html>';

describe('injection DOM functions', () => {
  it('keeps the early bootstrap alive until the Codex shell is ready without waiting for body', () => {
    expect(EARLY_APPLY_FUNCTION).not.toContain('!document.body');
    expect(EARLY_APPLY_FUNCTION).toContain('function(plan, revision)');
    expect(EARLY_APPLY_FUNCTION).toContain('const generation = revision || plan.runId');
    expect(EARLY_APPLY_FUNCTION).toContain('window[generationKey] !== generation');
    expect(EARLY_APPLY_FUNCTION).toContain('DOMContentLoaded');
    expect(EARLY_APPLY_FUNCTION).toContain('setInterval(install, 250)');
    expect(EARLY_APPLY_FUNCTION).toContain('setTimeout(stop, 10000)');
  });

  it('audits the matching renderer runtime and style node before reporting an active run', async () => {
    const call = vi.fn<(method: string, params: { expression: string; returnByValue: boolean }) => Promise<unknown>>(
      () => Promise.resolve({ result: { value: true } }),
    );
    const session = { call } as unknown as CdpPageSession;

    await expect(new InjectionRuntime().isApplied(session, 'audit-run')).resolves.toBe(true);

    const invocation = call.mock.calls[0];
    if (!invocation) throw new Error('CDP_CALL_NOT_RECORDED');
    expect(invocation[0]).toBe('Runtime.evaluate');
    expect(invocation[1].returnByValue).toBe(true);
    expect(invocation[1].expression).toContain('window.__CODEX_SKIN_RUNTIME__');
    expect(invocation[1].expression).toContain('style[data-codex-skin=\\"audit-run\\"]');
  });

  it('adds its decoration inside the verified main shell without changing native controls', () => {
    const dom = new JSDOM(shell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, legacyPlan('run-1'));

    const decoration = dom.window.document.querySelector('.codex-skin-decoration[data-codex-skin="run-1"]');
    expect(dom.window.document.documentElement.isConnected).toBe(true);
    expect(dom.window.document.querySelector('button')?.textContent).toBe('Native nav');
    expect(dom.window.document.querySelector('input')?.getAttribute('value')).toBe('Native input');
    expect(decoration?.parentElement).toBe(dom.window.document.querySelector('[role="main"]'));
    expect(decoration?.getAttribute('aria-hidden')).toBe('true');
    expect((decoration as HTMLElement).style.pointerEvents).toBe('none');
  });

  it('does not leave a run behind when the verified shell is missing', () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body><main role="main"></main></body></html>', { runScripts: 'outside-only', url: 'https://codex.local/' });

    expect(() => execute(APPLY_FUNCTION, dom.window, plan('run-1'))).toThrow('CODEX_SHELL_NOT_COMPATIBLE');
    expect(dom.window.document.querySelectorAll('[data-codex-skin="run-1"]')).toHaveLength(0);
  });

  it('rejects a generic shell that does not satisfy the verified adapter selectors', () => {
    const dom = new JSDOM(shell, { runScripts: 'outside-only', url: 'https://codex.local/' });

    expect(() => execute(APPLY_FUNCTION, dom.window, plan('adapter-only'))).toThrow('CODEX_SHELL_NOT_COMPATIBLE');
    expect(dom.window.document.querySelectorAll('[data-codex-skin="adapter-only"]')).toHaveLength(0);
  });

  it('rolls back only the requested run and remains idempotent', () => {
    const dom = new JSDOM(shell.replace('<head>', '<head><style data-codex-skin="other"></style>'), { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, legacyPlan('run-1'));
    execute(ROLLBACK_FUNCTION, dom.window, 'run-1');
    execute(ROLLBACK_FUNCTION, dom.window, 'run-1');

    expect(dom.window.document.querySelectorAll('[data-codex-skin="run-1"]')).toHaveLength(0);
    expect(dom.window.document.querySelectorAll('[data-codex-skin="other"]')).toHaveLength(1);
    expect(dom.window.document.documentElement.isConnected).toBe(true);
  });

  it('applies a shell-only plan without adding a welcome-page decoration', () => {
    const dom = new JSDOM(shell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, { ...legacyPlan('shell-run'), decoration: null });

    expect(dom.window.document.querySelector('style[data-codex-skin="shell-run"]')).not.toBeNull();
    expect(dom.window.document.querySelector('.codex-skin-decoration')).toBeNull();
  });

  it('accepts the current Codex semantic main shell without a main role', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('current-codex'));

    expect(dom.window.document.querySelector('style[data-codex-skin="current-codex"]')).not.toBeNull();
    expect(dom.window.document.querySelector('.codex-skin-decoration')?.parentElement).toBe(dom.window.document.querySelector('main.main-surface'));
  });

  it('marks the current route and image presentation without changing native controls', () => {
    const dom = new JSDOM(currentCodexShell.replace('<main class="main-surface">', '<main class="main-surface"><div role="main"><div data-testid="home-icon"></div></div>'), { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('semantic-run'));

    const root = dom.window.document.documentElement;
    expect(root.getAttribute('data-codex-skin-page')).toBe('home');
    expect(root.getAttribute('data-codex-skin-image')).toBe('wide');
    expect(root.getAttribute('data-codex-skin-safe-area')).toBe('left');
    expect(root.getAttribute('data-codex-skin-task-mode')).toBe('ambient');
    expect(dom.window.document.querySelector('button')?.textContent).toBe('Native nav');
  });

  it('marks the composer sticky ancestor as an adaptive transparent dock', () => {
    const taskShell = currentCodexShell.replace(
      '<button>Native action</button>',
      '<div role="main"><div class="sticky-shell"><div><textarea></textarea></div></div></div><button>Native action</button>',
    );
    const dom = new JSDOM(taskShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    Object.defineProperty(dom.window, 'getComputedStyle', {
      value: (element: Element) => ({
        colorScheme: 'light',
        position: element.classList.contains('sticky-shell') ? 'sticky' : 'static',
      }),
    });

    execute(APPLY_FUNCTION, dom.window, plan('adaptive-composer-dock'));

    const dock = dom.window.document.querySelector('.sticky-shell');
    expect(dock?.classList.contains('codex-skin-composer-dock')).toBe(true);

    execute(ROLLBACK_FUNCTION, dom.window, 'adaptive-composer-dock');

    expect(dock?.classList.contains('codex-skin-composer-dock')).toBe(false);
  });

  it('treats the current shell without a legacy home icon or route main as the home page', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('current-home'));

    const root = dom.window.document.documentElement;
    const main = dom.window.document.querySelector('main.main-surface');
    expect(root.getAttribute('data-codex-skin-page')).toBe('home');
    expect(main?.classList.contains('dream-home-shell')).toBe(true);

    execute(ROLLBACK_FUNCTION, dom.window, 'current-home');

    expect(root.getAttribute('data-codex-skin-page')).toBeNull();
    expect(main?.classList.contains('dream-home-shell')).toBe(false);
  });

  it('uses stable root attributes and removes them with the observed Codex route state', () => {
    const dom = new JSDOM(currentCodexShell.replace('<main class="main-surface">', '<main class="main-surface"><div role="main"><div data-testid="home-icon"></div></div>'), { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('dream-classes'));

    const root = dom.window.document.documentElement;
    const main = dom.window.document.querySelector('main.main-surface');
    const route = dom.window.document.querySelector('[role="main"]');
    expect(root.getAttribute('data-codex-skin-appearance')).toBe('light');
    expect(root.getAttribute('data-codex-skin-image')).toBe('wide');
    expect(root.getAttribute('data-codex-skin-task-mode')).toBe('ambient');
    expect(root.classList.contains('codex-dream-skin')).toBe(false);
    expect(main?.classList.contains('dream-home-shell')).toBe(true);
    expect(route?.classList.contains('dream-home')).toBe(true);

    execute(ROLLBACK_FUNCTION, dom.window, 'dream-classes');

    expect(root.getAttribute('data-codex-skin-appearance')).toBeNull();
    expect(main?.classList.contains('dream-home-shell')).toBe(false);
    expect(route?.classList.contains('dream-home')).toBe(false);
  });

  it('preserves the root state and style node when the same run refreshes its SPA route', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('persistent-run'));

    const root = dom.window.document.documentElement;
    const state = (dom.window as unknown as { __CODEX_SKIN_RUNTIME__?: unknown }).__CODEX_SKIN_RUNTIME__;
    const style = dom.window.document.querySelector('style[data-codex-skin="persistent-run"]');
    const route = dom.window.document.createElement('div');
    route.setAttribute('role', 'main');
    dom.window.document.querySelector('main.main-surface')?.appendChild(route);
    route.replaceChildren(dom.window.document.createElement('article'));

    execute(APPLY_FUNCTION, dom.window, { ...plan('persistent-run'), decoration: null });

    expect((dom.window as unknown as { __CODEX_SKIN_RUNTIME__?: unknown }).__CODEX_SKIN_RUNTIME__).toBe(state);
    expect(dom.window.document.querySelector('style[data-codex-skin="persistent-run"]')).toBe(style);
    expect(root.getAttribute('data-codex-skin-appearance')).toBe('light');
    expect(root.getAttribute('data-codex-skin')).toBe('persistent-run');
  });

  it('resolves automatic appearance from the native Codex color scheme', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    Object.defineProperty(dom.window, 'getComputedStyle', {
      value: () => ({ display: 'block', visibility: 'visible', colorScheme: 'dark' }),
    });
    execute(APPLY_FUNCTION, dom.window, {
      ...plan('auto-appearance'),
      presentation: { appearance: 'auto', imageLayout: 'wide', safeArea: 'auto', taskMode: 'auto' },
    });

    expect(dom.window.document.documentElement.getAttribute('data-codex-skin-appearance')).toBe('dark');
    expect(dom.window.document.documentElement.getAttribute('data-codex-skin-safe-area')).toBe('center');
    expect(dom.window.document.documentElement.getAttribute('data-codex-skin-task-mode')).toBe('ambient');
  });

  it('keeps theme state active when Codex replaces the root class list', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('class-reconciliation'));

    const root = dom.window.document.documentElement;
    root.className = 'electron-light';

    expect(root.className).toBe('electron-light');
    expect(root.getAttribute('data-codex-skin')).toBe('class-reconciliation');
    expect(root.getAttribute('data-codex-skin-appearance')).toBe('light');
    expect(root.getAttribute('data-codex-skin-image')).toBe('wide');
    expect(root.getAttribute('data-codex-skin-task-mode')).toBe('ambient');
  });

  it('restores its own style after a verified shell rerenders and removes its runtime state on rollback', () => {
    const dom = new JSDOM(currentCodexShell, { runScripts: 'outside-only', url: 'https://codex.local/' });
    execute(APPLY_FUNCTION, dom.window, plan('self-healing'));

    const state = (dom.window as unknown as { __CODEX_SKIN_RUNTIME__?: { ensure(): void } }).__CODEX_SKIN_RUNTIME__;
    dom.window.document.querySelector('style[data-codex-skin="self-healing"]')?.remove();
    state?.ensure();

    expect(state).toBeDefined();
    expect(dom.window.document.querySelector('style[data-codex-skin="self-healing"]')).not.toBeNull();

    execute(ROLLBACK_FUNCTION, dom.window, 'self-healing');

    expect((dom.window as unknown as { __CODEX_SKIN_RUNTIME__?: unknown }).__CODEX_SKIN_RUNTIME__).toBeUndefined();
    expect(dom.window.document.querySelectorAll('[data-codex-skin="self-healing"]')).toHaveLength(0);
    expect(dom.window.document.documentElement.getAttribute('data-codex-skin-page')).toBeNull();
  });
});
