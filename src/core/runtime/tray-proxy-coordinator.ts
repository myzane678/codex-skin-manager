import type { CompileThemeInput } from '../theme-runtime/compiler';
import type { CodexIdentityPort, CodexInstallation, CodexProcess } from '../ports/runtime-ports';
import { TrayProxyWindow } from './tray-proxy-window';
import type { ThemedLaunchResult } from './themed-launch-coordinator';

interface ThemedLauncherPort {
  launch(): Promise<ThemedLaunchResult>;
}

interface TrayProxyCoordinatorOptions {
  identity: CodexIdentityPort;
  themedLauncher: ThemedLauncherPort;
  activeTheme(): Promise<Omit<CompileThemeInput, 'runId'> | null>;
  applyTheme(port: number, theme: Omit<CompileThemeInput, 'runId'>, packageVersion: string): Promise<void>;
  setRuntimeState(state: { proxy: 'watching' | 'handling-candidate' | 'failed' }): void;
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
  sleep(delayMs: number): Promise<void>;
}

export class TrayProxyCoordinator {
  private installation: CodexInstallation | null = null;
  private window: TrayProxyWindow | null = null;
  private interval: unknown = null;
  private handling = false;
  private generation = 0;

  constructor(private readonly options: TrayProxyCoordinatorOptions) {}

  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    const installation = await this.options.identity.findInstallation();
    if (generation !== this.generation) return;
    if (!installation) {
      this.options.setRuntimeState({ proxy: 'failed' });
      return;
    }
    const baseline = await this.options.identity.listOwnedProcesses(installation);
    if (generation !== this.generation) return;
    this.installation = installation;
    this.window = new TrayProxyWindow(baseline, Date.now);
    this.options.setRuntimeState({ proxy: 'watching' });
    this.interval = this.options.setInterval(() => { void this.observe(); }, 2_000);
  }

  stop(): void {
    this.generation += 1;
    if (this.interval !== null) this.options.clearInterval(this.interval);
    this.interval = null;
    this.installation = null;
    this.window = null;
    this.handling = false;
  }

  private async observe(): Promise<void> {
    if (this.handling || !this.installation || !this.window) return;
    const generation = this.generation;
    try {
      const observation = this.window.observe(await this.options.identity.listOwnedProcesses(this.installation));
      if (generation !== this.generation || observation.status !== 'candidate' || !observation.candidate) return;
      this.window.consumeCandidate();
      this.handling = true;
      this.options.setRuntimeState({ proxy: 'handling-candidate' });
      await this.handleCandidate(this.installation, observation.candidate, generation);
    } catch {
      if (generation === this.generation) this.options.setRuntimeState({ proxy: 'failed' });
    } finally {
      if (generation === this.generation) {
        this.handling = false;
        if (this.interval !== null) this.options.setRuntimeState({ proxy: 'watching' });
      }
    }
  }

  private async handleCandidate(installation: CodexInstallation, candidate: CodexProcess, generation: number): Promise<void> {
    const theme = await this.options.activeTheme();
    if (generation !== this.generation || !theme) return;
    if (!await this.options.identity.closeOwnedProcess(installation, candidate.pid) || generation !== this.generation) return;
    if (!await this.waitForExit(installation, candidate.pid, generation) || generation !== this.generation) return;

    const launch = await this.options.themedLauncher.launch();
    if (generation !== this.generation || launch.status !== 'started') return;
    await this.options.applyTheme(launch.port, theme, launch.packageVersion);
  }

  private async waitForExit(installation: CodexInstallation, pid: number, generation: number): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (generation !== this.generation) return false;
      if (!(await this.options.identity.listOwnedProcesses(installation)).some((process) => process.pid === pid)) return true;
      await this.options.sleep(250);
    }
    return false;
  }
}
