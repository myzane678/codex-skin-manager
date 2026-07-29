import type { CompileThemeInput } from '../theme-runtime/compiler';
import type { AppSnapshot } from '../../shared/contracts/app-snapshot';

export interface CodexPlusAutoAttachOptions {
  activeTheme(): Promise<Omit<CompileThemeInput, 'runId'> | null>;
  runtimeState(): AppSnapshot;
  packageVersion(): Promise<string | null>;
  isAvailable(port: number): Promise<boolean>;
  attach(port: number, theme: Omit<CompileThemeInput, 'runId'>, packageVersion: string): Promise<void>;
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export class CodexPlusAutoAttachCoordinator {
  private interval: unknown = null;
  private attaching = false;
  private generation = 0;

  constructor(private readonly options: CodexPlusAutoAttachOptions) {}

  start(): void {
    this.stop();
    const generation = this.generation;
    void this.observe(generation);
    this.interval = this.options.setInterval(() => { void this.observe(this.generation); }, 2_000);
  }

  stop(): void {
    this.generation += 1;
    if (this.interval !== null) this.options.clearInterval(this.interval);
    this.interval = null;
    this.attaching = false;
  }

  private async observe(generation: number): Promise<void> {
    if (generation !== this.generation || this.attaching) return;
    const state = this.options.runtimeState();
    if (state.theme !== 'pending' || (state.cdp !== 'disconnected' && state.cdp !== 'failed')) return;
    const [theme, packageVersion, available] = await Promise.all([
      this.options.activeTheme(),
      this.options.packageVersion(),
      this.options.isAvailable(9229),
    ]);
    if (generation !== this.generation || !theme || !packageVersion || !available) return;

    this.attaching = true;
    try {
      await this.options.attach(9229, theme, packageVersion);
    } catch {
      // 下一轮轮询会在运行时状态允许时重试。
    } finally {
      if (generation === this.generation) this.attaching = false;
    }
  }
}
