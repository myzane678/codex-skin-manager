import { describe, expect, it } from 'vitest';
import { buildCodexProbeScript, getCodexVersionAdapter } from '../../src/core/theme-runtime/codex-version-adapter';

describe('Codex version adapter', () => {
  it('returns the verified adapter for the current Codex package', () => {
    const adapter = getCodexVersionAdapter('26.715.4045.0');

    expect(adapter).toMatchObject({
      id: 'codex-26.715.4045',
      packageVersion: '26.715.4045.0',
      shell: {
        header: '[data-testid="app-shell-header-context-menu-surface"]',
        sidebar: 'aside.app-shell-left-panel',
        main: 'main.main-surface',
      },
    });
    expect(adapter?.shell.navigation).toContain('[role="navigation"]');
    expect(adapter?.shell.composer).toContain('textarea');
  });

  it('returns the verified adapter for the Codex++-started Codex package', () => {
    const adapter = getCodexVersionAdapter('26.721.4979.0');

    expect(adapter).toMatchObject({
      id: 'codex-26.721.4979',
      packageVersion: '26.721.4979.0',
      shell: {
        header: '[data-testid="app-shell-header-context-menu-surface"]',
        sidebar: 'aside.app-shell-left-panel',
        main: 'main.main-surface',
      },
    });
    expect(adapter?.shell.composer).toContain('textarea');
    expect(adapter?.shell.projectSelector).toContain('project-selector');
  });

  it('does not select an adapter for an unverified Codex version', () => {
    expect(getCodexVersionAdapter('99.0.0.0')).toBeNull();
  });

  it('builds a version-specific probe for the verified shell and native controls', () => {
    const adapter = getCodexVersionAdapter('26.715.4045.0');
    if (!adapter) throw new Error('当前 Codex 适配器缺失');

    const probe = buildCodexProbeScript(adapter);

    expect(probe).toContain('app-shell-header-context-menu-surface');
    expect(probe).toContain('aside.app-shell-left-panel');
    expect(probe).toContain('main.main-surface');
    expect(probe).toContain('isCompatibleShell');
    expect(probe).toContain('isWelcomePage');
    expect(probe).toContain('nativeControlsVisible');
    expect(probe).toContain('composerVisible');
    expect(probe).toContain('projectSelectorVisible');
  });
});
