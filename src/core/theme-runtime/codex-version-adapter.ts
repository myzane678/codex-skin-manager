export interface CodexShellSelectors {
  header: string;
  navigation: string;
  sidebar: string;
  main: string;
  routeMain: string;
  homeMarker: string;
  projectSelector: string;
  composer: string;
}

export interface CodexVersionAdapter {
  id: string;
  packageVersion: string;
  shell: CodexShellSelectors;
}

export interface CodexVersionAdapterSelection {
  adapter: CodexVersionAdapter;
  compatibility: 'verified' | 'unverified';
}

const CODEX_26_715_4045: CodexVersionAdapter = {
  id: 'codex-26.715.4045',
  packageVersion: '26.715.4045.0',
  shell: {
    header: '[data-testid="app-shell-header-context-menu-surface"]',
    navigation: 'aside.app-shell-left-panel [role="navigation"], aside.app-shell-left-panel nav',
    sidebar: 'aside.app-shell-left-panel',
    main: 'main.main-surface',
    routeMain: '[role="main"]',
    homeMarker: '[data-testid="home-icon"]',
    projectSelector: '[data-testid="project-selector"], [aria-label*="project" i], [aria-label*="项目"]',
    composer: 'textarea, [contenteditable="true"][role="textbox"]',
  },
};

const CODEX_26_721_4979: CodexVersionAdapter = {
  id: 'codex-26.721.4979',
  packageVersion: '26.721.4979.0',
  shell: {
    header: '[data-testid="app-shell-header-context-menu-surface"]',
    navigation: 'aside.app-shell-left-panel [role="navigation"], aside.app-shell-left-panel nav',
    sidebar: 'aside.app-shell-left-panel',
    main: 'main.main-surface',
    routeMain: '[role="main"]',
    homeMarker: '[data-testid="home-icon"]',
    projectSelector: '[data-testid="project-selector"], [aria-label*="project" i], [aria-label*="项目"]',
    composer: 'textarea, [contenteditable="true"][role="textbox"]',
  },
};

const ADAPTERS = new Map<string, CodexVersionAdapter>([
  [CODEX_26_715_4045.packageVersion, CODEX_26_715_4045],
  [CODEX_26_721_4979.packageVersion, CODEX_26_721_4979],
]);
const LATEST_ADAPTER = CODEX_26_721_4979;

export function getCodexVersionAdapter(packageVersion: string): CodexVersionAdapter | null {
  return ADAPTERS.get(packageVersion) ?? null;
}

export function selectCodexVersionAdapter(packageVersion: string): CodexVersionAdapterSelection {
  const adapter = getCodexVersionAdapter(packageVersion);
  return adapter
    ? { adapter, compatibility: 'verified' }
    : { adapter: LATEST_ADAPTER, compatibility: 'unverified' };
}

export function buildCodexProbeScript(adapter: CodexVersionAdapter): string {
  return `(() => {
    const visible = (selector) => Array.from(document.querySelectorAll(selector)).some((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const shell = ${JSON.stringify(adapter.shell)};
    const routeMains = Array.from(document.querySelectorAll(shell.routeMain));
    return {
      adapterId: ${JSON.stringify(adapter.id)},
      isCompatibleShell: Boolean(document.querySelector(shell.header)
        && document.querySelector(shell.navigation)
        && document.querySelector(shell.sidebar)
        && document.querySelector(shell.main)),
      isWelcomePage: routeMains.length === 0
        || routeMains.some((routeMain) => Boolean(routeMain.querySelector(shell.homeMarker))),
      nativeControlsVisible: visible('button, input, textarea, [role="button"]'),
      composerVisible: visible(shell.composer),
      projectSelectorVisible: visible(shell.projectSelector),
    };
  })()`;
}
