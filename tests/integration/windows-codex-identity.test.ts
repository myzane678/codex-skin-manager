import { describe, expect, it } from 'vitest';
import { WindowsCodexIdentity } from '../../src/platform/windows/codex-identity';

describe.runIf(process.platform === 'win32')('WindowsCodexIdentity', () => {
  it('discovers only the registered official AppX installation', async () => {
    const identity = new WindowsCodexIdentity();
    const installation = await identity.findInstallation();

    expect(installation).toMatchObject({
      packageName: 'OpenAI.Codex',
      packageFamilyName: 'OpenAI.Codex_2p2nqsd0c76g0',
      publisher: 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B',
    });
    expect(installation?.executablePath.toLowerCase()).toContain('windowsapps');
  });

  it('does not classify unrelated Codex processes as owned', async () => {
    const identity = new WindowsCodexIdentity();
    const installation = await identity.findInstallation();
    expect(installation).not.toBeNull();

    const processes = await identity.listOwnedProcesses(installation!);
    expect(processes.every((process) => process.executablePath.toLowerCase().startsWith(installation!.installLocation.toLowerCase()))).toBe(true);
    expect(processes.some((process) => process.executablePath.toLowerCase().includes('codexbridge'))).toBe(false);
    expect(processes.some((process) => process.executablePath.toLowerCase().includes('.vscode\\extensions'))).toBe(false);
  });
});
