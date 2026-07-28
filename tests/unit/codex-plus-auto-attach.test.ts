import { describe, expect, it, vi } from 'vitest';
import { CodexPlusAutoAttachCoordinator } from '../../src/core/runtime/codex-plus-auto-attach';
import type { AppSnapshot } from '../../src/shared/contracts/app-snapshot';

const theme = {
  variables: { accent: '#2f6f63' },
  slots: { header: 'compact' as const },
  motion: { enabled: false },
  copy: { greeting: 'Welcome' },
};

function runtimeState(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    theme: 'pending', cdp: 'disconnected', proxy: 'disabled', recovery: 'idle',
    runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null,
    ...overrides,
  };
}

function createFixture(options?: { theme?: typeof theme | null; state?: AppSnapshot; version?: string | null; available?: boolean }) {
  let observe: (() => void) | undefined;
  const attach = vi.fn(() => Promise.resolve());
  const clearInterval = vi.fn();
  const coordinator = new CodexPlusAutoAttachCoordinator({
    activeTheme: () => Promise.resolve(options?.theme === undefined ? theme : options.theme),
    runtimeState: () => options?.state ?? runtimeState(),
    packageVersion: () => Promise.resolve(options?.version === undefined ? '26.721.4979.0' : options.version),
    isAvailable: () => Promise.resolve(options?.available ?? true),
    attach,
    setInterval: (callback) => { observe = callback; return 7; },
    clearInterval,
  });
  return { coordinator, attach, clearInterval, observe: () => observe };
}

describe('CodexPlusAutoAttachCoordinator', () => {
  it('immediately attaches a pending theme to the Codex++ loopback CDP port', async () => {
    const fixture = createFixture();

    fixture.coordinator.start();

    await vi.waitFor(() => expect(fixture.attach).toHaveBeenCalledOnce());
    expect(fixture.attach).toHaveBeenCalledWith(9229, theme, '26.721.4979.0');
  });

  it.each([
    { name: 'no selected theme', theme: null, state: runtimeState(), version: '26.721.4979.0', available: true },
    { name: 'an active CDP session', theme, state: runtimeState({ cdp: 'connected' }), version: '26.721.4979.0', available: true },
    { name: 'an unsupported package version', theme, state: runtimeState(), version: '99.0.0.0', available: true },
    { name: 'a closed Codex++ CDP port', theme, state: runtimeState(), version: '26.721.4979.0', available: false },
  ])('does not attach with $name', async ({ theme: selectedTheme, state, version, available }) => {
    const fixture = createFixture({ theme: selectedTheme, state, version, available });

    fixture.coordinator.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.attach).not.toHaveBeenCalled();
  });

  it('clears its polling interval when stopped', () => {
    const fixture = createFixture();

    fixture.coordinator.start();
    fixture.coordinator.stop();

    expect(fixture.clearInterval).toHaveBeenCalledWith(7);
  });
});
