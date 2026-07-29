import type { CdpPageSession, CdpPort, CdpTarget } from '../ports/runtime-ports';
import { compileInjectionPlan, type CompileThemeInput, type InjectionPlan } from '../theme-runtime/compiler';
import { buildCodexProbeScript, selectCodexVersionAdapter, type CodexVersionAdapter, type CodexVersionAdapterSelection } from '../theme-runtime/codex-version-adapter';

export interface InjectionPort {
  apply(session: CdpPageSession, plan: InjectionPlan): Promise<void>;
  rollback(session: CdpPageSession, runId: string): Promise<void>;
  isApplied?(session: CdpPageSession, runId: string): Promise<boolean>;
  installEarly?(session: CdpPageSession, plan: InjectionPlan): Promise<string>;
  removeEarly?(session: CdpPageSession, identifier: string): Promise<void>;
}

export interface ThemeRuntimeStatus {
  phase: 'connecting' | 'applied' | 'pending' | 'compatibility-degraded' | 'disconnected' | 'failed';
  browserId?: string;
  targetId?: string;
  runId?: string;
  errorCode?: string;
  adapterId?: string;
  compatibility?: CodexVersionAdapterSelection['compatibility'];
}

interface WelcomeProbe {
  adapterId: string;
  isCompatibleShell: boolean;
  isWelcomePage: boolean;
  nativeControlsVisible: boolean;
  composerVisible: boolean;
  projectSelectorVisible: boolean;
}

interface ActiveRun {
  runId: string;
  targetId: string;
  session: CdpPageSession;
  hasWelcomeDecoration: boolean;
  earlyScriptId: string | null;
  plan: InjectionPlan;
}

export const WELCOME_PROBE = `(() => ({
  isCompatibleShell: Boolean(
    document.querySelector('[data-testid="header-shell-slot"], [data-testid="app-shell-header-context-menu-surface"]')
      && document.querySelector('main,[role="main"]')
      && document.querySelector('nav,[role="navigation"]'),
  ),
  isWelcomePage: document.querySelectorAll('[role="main"]').length === 0
    || Boolean(document.querySelector('[role="main"] [data-testid="home-icon"]')),
  nativeControlsVisible: Array.from(document.querySelectorAll('button, input, textarea, [role="button"]')).some((element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }),
}))()`;

export class ThemeRuntimeCoordinator {
  private activeRun: ActiveRun | null = null;
  private session: CdpPageSession | null = null;
  private browserId: string | null = null;
  private target: CdpTarget | null = null;
  private theme: Omit<CompileThemeInput, 'runId'> | null = null;
  private onState: ((status: ThemeRuntimeStatus) => void) | null = null;
  private port: number | null = null;
  private generation = 0;
  private heartbeat: NodeJS.Timeout | null = null;
  private refreshing: Promise<void> | null = null;
  private refreshQueued = false;
  private adapter: CodexVersionAdapter | null = null;
  private compatibility: CodexVersionAdapterSelection['compatibility'] | null = null;

  constructor(
    private readonly cdp: CdpPort,
    private readonly injector: InjectionPort,
    private readonly createRunId: () => string,
  ) {}

  async start(port: number, theme: Omit<CompileThemeInput, 'runId'>, onState: (status: ThemeRuntimeStatus) => void, packageVersion = '26.715.4045.0'): Promise<void> {
    const generation = ++this.generation;
    await this.disposeCurrent();
    if (generation !== this.generation) return;
    this.port = port;
    this.theme = theme;
    this.onState = onState;
    const selection = selectCodexVersionAdapter(packageVersion);
    this.adapter = selection.adapter;
    this.compatibility = selection.compatibility;
    this.report({ phase: 'connecting' });
    let probeFailed = false;

    for (let attempt = 0; attempt < 16 && generation === this.generation; attempt += 1) {
      try {
        const identity = await this.cdp.readBrowserIdentity(port);
        if (generation !== this.generation) return;
        const selected = await this.openWelcomeSession(port, identity.browserId, generation);
        if (selected === 'adapter-mismatch') {
          this.report({ phase: 'compatibility-degraded', errorCode: 'CODEX_ADAPTER_MISMATCH', adapterId: this.adapter.id });
          return;
        }
        if (selected === 'probe-failed') {
          probeFailed = true;
          await delay(500);
          continue;
        }
        if (!selected) {
          await delay(500);
          continue;
        }
        this.browserId = identity.browserId;
        this.adoptSession(selected, generation);
        this.heartbeat = setInterval(() => { void this.refresh(); }, 2_000);
        await this.refresh();
        return;
      } catch {
        if (attempt < 15) await delay(500);
      }
    }
    if (generation === this.generation) {
      this.report(probeFailed
        ? { phase: 'compatibility-degraded', errorCode: 'CODEX_PROBE_FAILED', adapterId: this.adapter.id }
        : { phase: 'failed', errorCode: 'CDP_READY_TIMEOUT' });
    }
  }

  refresh(): Promise<void> {
    if (this.refreshing) {
      this.refreshQueued = true;
      return this.refreshing;
    }
    const generation = this.generation;
    this.refreshing = this.refreshLoop(generation).finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  async stop(): Promise<boolean> {
    this.generation += 1;
    await this.disposeCurrent();
    this.port = null;
    this.theme = null;
    this.onState = null;
    this.browserId = null;
    this.adapter = null;
    this.compatibility = null;
    return true;
  }

  async switchTheme(theme: Omit<CompileThemeInput, 'runId'>): Promise<boolean> {
    const session = this.session;
    const target = this.target;
    const adapter = this.adapter;
    if (!session || !target || !adapter || !session.isOpen()) return false;

    const probe = await readProbe(session, adapter);
    if (probe.adapterId !== adapter.id || !probe.isCompatibleShell || !probe.nativeControlsVisible) return false;

    const previousTheme = this.theme;
    const previousRun = this.activeRun;
    const runId = this.createRunId();
    const compiledPlan = compileInjectionPlan({ ...theme, runId }, probe.isWelcomePage);
    const plan: InjectionPlan = { ...compiledPlan, shell: adapter.shell };
    const nextRun: ActiveRun = {
      runId,
      targetId: target.id,
      session,
      hasWelcomeDecoration: probe.isWelcomePage,
      earlyScriptId: await this.installEarly(session, plan),
      plan,
    };

    try {
      await this.injector.apply(session, plan);
      if (previousRun) await this.removeEarly(previousRun);
      this.theme = theme;
      this.activeRun = nextRun;
      this.report(withBrowserId({ phase: 'applied', targetId: target.id, runId, adapterId: adapter.id, ...withCompatibility(this.compatibility) }, this.browserId));
      return true;
    } catch (error) {
      await this.removeEarly(nextRun);
      if (session.isOpen()) await this.injector.rollback(session, runId).catch(() => undefined);
      this.theme = previousTheme;
      this.activeRun = previousRun;
      if (previousRun && session.isOpen()) await this.injector.apply(session, previousRun.plan);
      throw error;
    }
  }

  async clearTheme(): Promise<boolean> {
    const run = this.activeRun;
    this.theme = null;
    if (!run || !run.session.isOpen()) {
      this.activeRun = null;
      return false;
    }
    await this.removeEarly(run);
    await this.injector.rollback(run.session, run.runId);
    this.activeRun = null;
    return true;
  }

  async rollback(): Promise<boolean> {
    const run = this.activeRun;
    if (!run) return false;
    if (!run.session.isOpen()) {
      this.activeRun = null;
      return false;
    }
    await this.removeEarly(run);
    await this.injector.rollback(run.session, run.runId);
    this.activeRun = null;
    this.report(withBrowserId({ phase: 'pending', targetId: run.targetId }, this.browserId));
    return true;
  }

  private async openWelcomeSession(port: number, browserId: string, generation: number): Promise<{ target: CdpTarget; session: CdpPageSession } | 'adapter-mismatch' | 'probe-failed' | null> {
    const targets = await this.cdp.listTargets(port, browserId);
    let probeFailed = false;
    for (const target of targets) {
      if (generation !== this.generation || target.type !== 'page') return null;
      const session = await this.cdp.openPageSession(target, port);
      try {
        await session.call('Page.enable');
        await session.call('Runtime.enable');
        const probe = await readProbe(session, this.adapter);
        if (probe.adapterId !== this.adapter?.id) {
          session.close();
          return 'adapter-mismatch';
        }
        if (probe.isCompatibleShell && probe.nativeControlsVisible) return { target, session };
        probeFailed = true;
      } catch {
        // 仅将暂态页面错误视为当前 target 不可用。
      }
      session.close();
    }
    return probeFailed ? 'probe-failed' : null;
  }

  private async refreshLoop(generation: number): Promise<void> {
    do {
      this.refreshQueued = false;
      await this.performRefresh(generation);
    } while (this.refreshQueued && generation === this.generation);
  }

  private async performRefresh(generation: number): Promise<void> {
    let session = this.session;
    let target = this.target;
    const browserId = this.browserId;
    const theme = this.theme;
    const port = this.port;
    const adapter = this.adapter;
    if (generation !== this.generation || !browserId || !theme || !port || !adapter) return;

    try {
      if (!session || !target || !session.isOpen()) {
        const selected = await this.openWelcomeSession(port, browserId, generation);
        if (selected === 'adapter-mismatch') {
          this.report({ phase: 'compatibility-degraded', errorCode: 'CODEX_ADAPTER_MISMATCH', adapterId: adapter.id });
          return;
        }
        if (selected === 'probe-failed') {
          this.report({ phase: 'compatibility-degraded', errorCode: 'CODEX_PROBE_FAILED', adapterId: adapter.id });
          return;
        }
        if (!selected) return;
        this.adoptSession(selected, generation);
        session = selected.session;
        target = selected.target;
      }
      if (!session || !target) return;
      const activeSession = session;
      const activeTarget = target;
      const targets = await this.cdp.listTargets(port, browserId);
      if (generation !== this.generation) return;
      if (!targets.some((candidate) => candidate.id === activeTarget.id)) {
        this.clearDisconnected(generation);
        this.refreshQueued = true;
        return;
      }
      const probe = await readProbe(activeSession, adapter);
      if (generation !== this.generation) return;
      if (!probe.isCompatibleShell || !probe.nativeControlsVisible) {
        await this.rollback();
        if (generation === this.generation) this.report({ phase: 'pending', browserId, targetId: activeTarget.id });
        return;
      }
      if (this.activeRun) {
        const activeRun = this.activeRun;
        if (activeRun.hasWelcomeDecoration !== probe.isWelcomePage) {
          activeRun.hasWelcomeDecoration = probe.isWelcomePage;
        } else if (this.injector.isApplied && !await this.injector.isApplied(activeSession, activeRun.runId)) {
          await this.injector.apply(activeSession, activeRun.plan);
        }
        this.report({ phase: 'applied', browserId, targetId: activeTarget.id, runId: activeRun.runId, adapterId: adapter.id, ...withCompatibility(this.compatibility) });
        return;
      }
      const runId = this.createRunId();
      const compiledPlan = compileInjectionPlan({ ...theme, runId }, probe.isWelcomePage);
      const plan: InjectionPlan = { ...compiledPlan, shell: adapter.shell };
      const run: ActiveRun = {
        runId,
        targetId: activeTarget.id,
        session: activeSession,
        hasWelcomeDecoration: probe.isWelcomePage,
        earlyScriptId: await this.installEarly(activeSession, plan),
        plan,
      };
      this.activeRun = run;
      try {
        await this.injector.apply(activeSession, plan);
      } catch (error) {
        await this.removeEarly(run);
        if (activeSession.isOpen()) await this.injector.rollback(activeSession, runId).catch(() => undefined);
        if (this.activeRun === run) this.activeRun = null;
        throw error;
      }
      if (generation !== this.generation) {
        if (activeSession.isOpen()) await this.injector.rollback(activeSession, runId).catch(() => undefined);
        if (this.activeRun === run) this.activeRun = null;
        return;
      }
      this.report({ phase: 'applied', browserId, targetId: activeTarget.id, runId, adapterId: adapter.id, ...withCompatibility(this.compatibility) });
    } catch (error) {
      if (generation === this.generation && this.session?.isOpen()) {
        this.report(withBrowserId({
          phase: 'failed',
          errorCode: errorCode(error),
          ...(target ? { targetId: target.id } : {}),
        }, browserId));
      }
    }
  }

  private handleDisconnect(generation: number): void {
    if (generation !== this.generation) return;
    this.clearDisconnected(generation);
    void this.refresh();
  }

  private clearDisconnected(generation: number): void {
    if (generation !== this.generation) return;
    this.session?.close();
    this.activeRun = null;
    this.session = null;
    this.target = null;
    this.report(withBrowserId({ phase: 'disconnected' }, this.browserId));
  }

  private adoptSession(selected: { target: CdpTarget; session: CdpPageSession }, generation: number): void {
    this.target = selected.target;
    this.session = selected.session;
    selected.session.onLoad(() => {
      if (generation !== this.generation) return;
      const run = this.activeRun;
      if (run?.session === selected.session && !run.earlyScriptId) {
        setTimeout(() => {
          if (generation === this.generation && this.activeRun === run && selected.session.isOpen()) {
            void this.injector.apply(selected.session, run.plan).catch(() => undefined);
          }
        }, 250);
        return;
      }
      void this.refresh();
    });
    selected.session.onDisconnect(() => this.handleDisconnect(generation));
  }

  private async installEarly(session: CdpPageSession, plan: InjectionPlan): Promise<string | null> {
    if (!this.injector.installEarly) return null;
    try {
      return await this.injector.installEarly(session, plan);
    } catch {
      return null;
    }
  }

  private async disposeCurrent(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const run = this.activeRun;
    const session = this.session;
    this.activeRun = null;
    this.session = null;
    this.target = null;
    if (run && run.session.isOpen()) {
      await this.removeEarly(run);
      await this.injector.rollback(run.session, run.runId).catch(() => undefined);
    }
    session?.close();
  }

  private async removeEarly(run: ActiveRun): Promise<void> {
    if (!run.earlyScriptId || !run.session.isOpen() || !this.injector.removeEarly) return;
    const identifier = run.earlyScriptId;
    run.earlyScriptId = null;
    await this.injector.removeEarly(run.session, identifier).catch(() => undefined);
  }

  private report(status: ThemeRuntimeStatus): void {
    this.onState?.(status);
  }
}

async function readProbe(session: CdpPageSession, adapter: CodexVersionAdapter | null): Promise<WelcomeProbe> {
  return extractProbe(await session.call('Runtime.evaluate', {
    expression: adapter ? buildCodexProbeScript(adapter) : WELCOME_PROBE,
    returnByValue: true,
  }));
}

function extractProbe(value: unknown): WelcomeProbe {
  if (!value || typeof value !== 'object') throw new Error('CDP_PROBE_INVALID');
  const result = (value as Record<string, unknown>).result;
  if (!result || typeof result !== 'object') throw new Error('CDP_PROBE_INVALID');
  const probe = (result as Record<string, unknown>).value;
  if (!probe || typeof probe !== 'object') throw new Error('CDP_PROBE_INVALID');
  const record = probe as Record<string, unknown>;
  if (typeof record.adapterId !== 'string'
    || typeof record.isCompatibleShell !== 'boolean'
    || typeof record.isWelcomePage !== 'boolean'
    || typeof record.nativeControlsVisible !== 'boolean'
    || typeof record.composerVisible !== 'boolean'
    || typeof record.projectSelectorVisible !== 'boolean') throw new Error('CDP_PROBE_INVALID');
  return {
    adapterId: record.adapterId,
    isCompatibleShell: record.isCompatibleShell,
    isWelcomePage: record.isWelcomePage,
    nativeControlsVisible: record.nativeControlsVisible,
    composerVisible: record.composerVisible,
    projectSelectorVisible: record.projectSelectorVisible,
  };
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function withBrowserId(status: Omit<ThemeRuntimeStatus, 'browserId'>, browserId: string | null): ThemeRuntimeStatus {
  return browserId ? { ...status, browserId } : status;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 80) : 'CDP_RUNTIME_FAILED';
}

function withCompatibility(compatibility: CodexVersionAdapterSelection['compatibility'] | null): Pick<ThemeRuntimeStatus, 'compatibility'> {
  return compatibility ? { compatibility } : {};
}
