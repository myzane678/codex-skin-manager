import { describe, expect, it } from 'vitest';
import { toRuntimePresentation } from '../../src/main/runtime-status';

describe('toRuntimePresentation', () => {
  it('keeps an unverified compatibility warning on an applied runtime', () => {
    expect(toRuntimePresentation({
      phase: 'applied',
      runId: 'run-1',
      adapterId: 'codex-26.721.4979',
      compatibility: 'unverified',
    })).toEqual({
      runtimeActive: true,
      state: {
        theme: 'applied',
        cdp: 'connected',
        runtimeRunId: 'run-1',
        runtimeErrorCode: null,
        runtimeAdapterId: 'codex-26.721.4979',
        runtimeCompatibility: 'unverified',
      },
    });
  });

  it('returns a transient CDP failure to the pending state so automatic attachment can retry', () => {
    expect(toRuntimePresentation({ phase: 'failed', errorCode: 'CDP_READY_TIMEOUT' })).toEqual({
      runtimeActive: false,
      state: {
        theme: 'pending',
        cdp: 'disconnected',
        runtimeRunId: null,
        runtimeErrorCode: 'CDP_READY_TIMEOUT',
        runtimeAdapterId: null,
        runtimeCompatibility: null,
      },
    });
  });

  it('keeps a verified compatibility failure visible without scheduling an attachment retry', () => {
    expect(toRuntimePresentation({ phase: 'compatibility-degraded', errorCode: 'CODEX_VERSION_UNSUPPORTED' })).toEqual({
      runtimeActive: false,
      state: {
        theme: 'compatibility-degraded',
        cdp: 'connected',
        runtimeRunId: null,
        runtimeErrorCode: 'CODEX_VERSION_UNSUPPORTED',
        runtimeAdapterId: null,
        runtimeCompatibility: null,
      },
    });
  });
});
