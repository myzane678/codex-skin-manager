import type { CompileThemeInput } from '../theme-runtime/compiler';
import type { AppSnapshot } from '../../shared/contracts/app-snapshot';
import type { ManagerSnapshot, ThemeIdentity } from '../../shared/contracts/manager';

export interface LiveThemeManager {
  snapshot(): Promise<ManagerSnapshot>;
  enableTheme(id: string, version: string): Promise<ManagerSnapshot>;
  disableTheme(): Promise<ManagerSnapshot>;
  activeThemeInput(): Promise<Omit<CompileThemeInput, 'runId'> | null>;
  setRuntimeState(state: Partial<AppSnapshot>): void;
}

export interface LiveThemeRuntime {
  switchTheme(theme: Omit<CompileThemeInput, 'runId'>): Promise<boolean>;
  clearTheme(): Promise<boolean>;
}

export class LiveThemeSwitcher {
  constructor(
    private readonly manager: LiveThemeManager,
    private readonly runtime: LiveThemeRuntime,
  ) {}

  async switchTo(identity: ThemeIdentity): Promise<ManagerSnapshot> {
    const previous = await this.manager.snapshot();
    const previousTheme = activeIdentity(previous);
    await this.manager.enableTheme(identity.id, identity.version);

    if (previous.cdp !== 'connected') {
      this.manager.setRuntimeState({ theme: 'pending' });
      return this.manager.snapshot();
    }

    try {
      const theme = await this.manager.activeThemeInput();
      if (!theme || !(await this.runtime.switchTheme(theme))) {
        this.manager.setRuntimeState({ theme: 'pending' });
        return this.manager.snapshot();
      }
      return this.manager.snapshot();
    } catch (error) {
      await this.restoreSelection(previousTheme);
      this.manager.setRuntimeState({ theme: previous.theme });
      throw error;
    }
  }

  async switchToNative(): Promise<ManagerSnapshot> {
    const previous = await this.manager.snapshot();
    if (previous.cdp === 'connected') await this.runtime.clearTheme();
    return this.manager.disableTheme();
  }

  private async restoreSelection(previousTheme: ThemeIdentity | null): Promise<void> {
    if (previousTheme) {
      await this.manager.enableTheme(previousTheme.id, previousTheme.version);
    } else {
      await this.manager.disableTheme();
    }
  }
}

function activeIdentity(snapshot: ManagerSnapshot): ThemeIdentity | null {
  const active = snapshot.themes.find((theme) => theme.active);
  return active ? { id: active.id, version: active.version } : null;
}
