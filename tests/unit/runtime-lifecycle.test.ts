import { describe, expect, it } from 'vitest';
import { isThemeRuntimeActive, shouldKeepManagerAlive } from '../../src/main/runtime-lifecycle';
import { validateAppSnapshot } from '../../src/shared/contracts/app-snapshot';

describe('manager runtime lifecycle', () => {
  it('keeps the manager alive while a themed runtime is active without proxy mode', () => {
    expect(shouldKeepManagerAlive({ proxyEnabled: false, runtimeActive: true, isQuitting: false })).toBe(true);
  });

  it('allows an explicit quit to stop the active themed runtime', () => {
    expect(shouldKeepManagerAlive({ proxyEnabled: false, runtimeActive: true, isQuitting: true })).toBe(false);
  });

  it('treats only an applied theme as an active runtime', () => {
    expect(isThemeRuntimeActive('applied')).toBe(true);
    expect(isThemeRuntimeActive('pending')).toBe(false);
    expect(isThemeRuntimeActive('native')).toBe(false);
  });
});

describe('runtime diagnostics contract', () => {
  it('accepts the applied run identifier used to verify live injection', () => {
    expect(validateAppSnapshot({
      theme: 'applied',
      cdp: 'connected',
      proxy: 'disabled',
      recovery: 'idle',
      runtimeRunId: 'run-1',
      runtimeErrorCode: null,
    })).toBe(true);
  });

  it('accepts a failed runtime error code when no injection run exists', () => {
    expect(validateAppSnapshot({
      theme: 'compatibility-degraded',
      cdp: 'failed',
      proxy: 'disabled',
      recovery: 'idle',
      runtimeRunId: null,
      runtimeErrorCode: 'CDP_READY_TIMEOUT',
    })).toBe(true);
  });
});
