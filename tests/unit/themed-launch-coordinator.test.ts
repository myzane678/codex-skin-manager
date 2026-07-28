import { describe, expect, it, vi } from 'vitest';
import type { CodexIdentityPort, CodexInstallation, CodexProcess } from '../../src/core/ports/runtime-ports';
import { ThemedLaunchCoordinator } from '../../src/core/runtime/themed-launch-coordinator';

const installation: CodexInstallation = {
  packageName: 'OpenAI.Codex',
  packageFamilyName: 'OpenAI.Codex_2p2nqsd0c76g0',
  publisher: 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B',
  version: '26.715.2236.0',
  installLocation: 'C:/Program Files/WindowsApps/OpenAI.Codex',
  executablePath: 'C:/Program Files/WindowsApps/OpenAI.Codex/app/ChatGPT.exe',
};

function identity(processes: CodexProcess[]): CodexIdentityPort {
  return {
    findInstallation: () => Promise.resolve(installation),
    listOwnedProcesses: () => Promise.resolve(processes),
    closeOwnedProcess: () => Promise.resolve(false),
  };
}

describe('ThemedLaunchCoordinator', () => {
  it('keeps an existing official Codex running by default', async () => {
    const launcher = { launch: vi.fn() };
    const coordinator = new ThemedLaunchCoordinator(identity([{ pid: 10, executablePath: installation.executablePath }]), launcher);

    await expect(coordinator.launch()).resolves.toEqual({ status: 'pending-existing-process' });
    expect(launcher.launch).not.toHaveBeenCalled();
  });

  it('launches the registered AppX only with loopback CDP arguments', async () => {
    const launcher = { launch: vi.fn(() => Promise.resolve()) };
    const coordinator = new ThemedLaunchCoordinator(identity([]), launcher, () => 19335);

    await expect(coordinator.launch()).resolves.toEqual({ status: 'started', port: 19335, packageVersion: '26.715.2236.0' });
    expect(launcher.launch).toHaveBeenCalledWith('OpenAI.Codex_2p2nqsd0c76g0!App', [
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=19335',
    ]);
  });
});
