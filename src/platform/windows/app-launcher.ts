import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppLauncherPort } from '../../core/runtime/themed-launch-coordinator';

const execFileAsync = promisify(execFile);

export class WindowsAppLauncher implements AppLauncherPort {
  async launch(appId: string, args: readonly string[]): Promise<void> {
    if (!/^OpenAI\.Codex_[a-z0-9]+!App$/i.test(appId)) throw new Error('APP_ID_INVALID');
    if (args.length !== 2 || args[0] !== '--remote-debugging-address=127.0.0.1' || !/^--remote-debugging-port=\d+$/.test(args[1]!)) {
      throw new Error('APP_LAUNCH_ARGS_INVALID');
    }
    await execFileAsync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process 'shell:AppsFolder\\${appId}' -ArgumentList '${args.join("','")}'`,
    ], { windowsHide: true });
  }
}
