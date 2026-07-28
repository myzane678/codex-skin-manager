import type { CodexIdentityPort } from '../ports/runtime-ports';

export interface AppLauncherPort {
  launch(appId: string, args: readonly string[]): Promise<void>;
}

export type ThemedLaunchResult =
  | { status: 'missing-installation' }
  | { status: 'pending-existing-process' }
  | { status: 'started'; port: number; packageVersion: string };

export class ThemedLaunchCoordinator {
  constructor(
    private readonly identity: CodexIdentityPort,
    private readonly launcher: AppLauncherPort,
    private readonly allocatePort: () => number | Promise<number> = () => 9335,
  ) {}

  async launch(): Promise<ThemedLaunchResult> {
    const installation = await this.identity.findInstallation();
    if (!installation) return { status: 'missing-installation' };
    if ((await this.identity.listOwnedProcesses(installation)).length > 0) {
      return { status: 'pending-existing-process' };
    }
    const port = await this.allocatePort();
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CDP_PORT_INVALID');
    await this.launcher.launch(`${installation.packageFamilyName}!App`, [
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
    ]);
    return { status: 'started', port, packageVersion: installation.version };
  }
}
