import { describe, expect, it, vi } from 'vitest';
import type { CodexIdentityPort, CodexInstallation, CodexProcess } from '../../src/core/ports/runtime-ports';
import type { ThemedLaunchResult } from '../../src/core/runtime/themed-launch-coordinator';
import { TrayProxyCoordinator } from '../../src/core/runtime/tray-proxy-coordinator';

const installation: CodexInstallation = {
  packageName: 'OpenAI.Codex',
  packageFamilyName: 'OpenAI.Codex_2p2nqsd0c76g0',
  publisher: 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B',
  version: '26.715.2236.0',
  installLocation: 'C:/Program Files/WindowsApps/OpenAI.Codex',
  executablePath: 'C:/Program Files/WindowsApps/OpenAI.Codex/app/ChatGPT.exe',
};

const candidate: CodexProcess = { pid: 11, executablePath: installation.executablePath };

type ThemedLauncher = { launch(): Promise<ThemedLaunchResult> };

function createIdentity(processes: CodexProcess[][]) {
  let call = 0;
  const findInstallation = vi.fn(() => Promise.resolve(installation));
  const listOwnedProcesses = vi.fn(() => Promise.resolve(processes[Math.min(call++, processes.length - 1)] ?? []));
  const closeOwnedProcess = vi.fn(() => Promise.resolve(true));
  const identity: CodexIdentityPort = { findInstallation, listOwnedProcesses, closeOwnedProcess };
  return { identity, listOwnedProcesses, closeOwnedProcess };
}

function activeTheme() {
  return Promise.resolve({
    variables: { accent: '#2f6f63' },
    slots: { header: 'compact' as const },
    motion: { enabled: false },
    copy: { greeting: 'Welcome' },
  });
}

describe('TrayProxyCoordinator', () => {
  it('only handles a newly observed official process after it exits gently', async () => {
    const fixture = createIdentity([[], [candidate], [], []]);
    const launch = vi.fn(() => Promise.resolve({ status: 'started' as const, port: 19335, packageVersion: installation.version }));
    const applyTheme = vi.fn(() => Promise.resolve());
    let observe: (() => void) | undefined;
    const state = vi.fn();
    const coordinator = new TrayProxyCoordinator({
      identity: fixture.identity,
      themedLauncher: { launch } satisfies ThemedLauncher,
      activeTheme,
      applyTheme,
      setRuntimeState: state,
      setInterval: (callback) => { observe = callback; return 1; },
      clearInterval: vi.fn(),
      sleep: () => Promise.resolve(),
    });

    await coordinator.start();
    observe?.();
    await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());

    expect(fixture.closeOwnedProcess).toHaveBeenCalledWith(installation, candidate.pid);
    expect(applyTheme).toHaveBeenCalledWith(19335, expect.any(Object), installation.version);
    expect(state).toHaveBeenCalledWith({ proxy: 'handling-candidate' });
    expect(state).toHaveBeenLastCalledWith({ proxy: 'watching' });
  });

  it('does not launch when the candidate does not exit during the grace period', async () => {
    const fixture = createIdentity([[], [candidate], ...Array.from({ length: 21 }, () => [candidate])]);
    const launch = vi.fn();
    let observe: (() => void) | undefined;
    const coordinator = new TrayProxyCoordinator({
      identity: fixture.identity,
      themedLauncher: { launch } satisfies ThemedLauncher,
      activeTheme,
      applyTheme: vi.fn(),
      setRuntimeState: vi.fn(),
      setInterval: (callback) => { observe = callback; return 1; },
      clearInterval: vi.fn(),
      sleep: () => Promise.resolve(),
    });

    await coordinator.start();
    observe?.();
    await vi.waitFor(() => expect(fixture.listOwnedProcesses).toHaveBeenCalledTimes(22));

    expect(launch).not.toHaveBeenCalled();
  });

  it('does not restart Codex after the proxy is stopped during a candidate handoff', async () => {
    let resolveClose: ((value: boolean) => void) | undefined;
    const fixture = createIdentity([[], [candidate], []]);
    fixture.closeOwnedProcess.mockImplementation(() => new Promise<boolean>((resolve) => { resolveClose = resolve; }));
    const launch = vi.fn();
    let observe: (() => void) | undefined;
    const coordinator = new TrayProxyCoordinator({
      identity: fixture.identity,
      themedLauncher: { launch } satisfies ThemedLauncher,
      activeTheme,
      applyTheme: vi.fn(),
      setRuntimeState: vi.fn(),
      setInterval: (callback) => { observe = callback; return 1; },
      clearInterval: vi.fn(),
      sleep: vi.fn(),
    });

    await coordinator.start();
    observe?.();
    await vi.waitFor(() => expect(fixture.closeOwnedProcess).toHaveBeenCalledOnce());
    coordinator.stop();
    resolveClose?.(true);
    await vi.waitFor(() => expect(fixture.closeOwnedProcess).toHaveBeenCalledOnce());

    expect(launch).not.toHaveBeenCalled();
  });

  it('stops its low-frequency observer when disabled', async () => {
    const fixture = createIdentity([[]]);
    const clearInterval = vi.fn();
    const coordinator = new TrayProxyCoordinator({
      identity: fixture.identity,
      themedLauncher: { launch: vi.fn() } satisfies ThemedLauncher,
      activeTheme: vi.fn(),
      applyTheme: vi.fn(),
      setRuntimeState: vi.fn(),
      setInterval: () => 7,
      clearInterval,
      sleep: vi.fn(),
    });

    await coordinator.start();
    coordinator.stop();

    expect(clearInterval).toHaveBeenCalledWith(7);
  });
});
