import { describe, expect, it } from 'vitest';
import { toRuntimePresentation } from '../../src/main/runtime-status';

describe('toRuntimePresentation', () => {
  it('returns a transient CDP failure to the pending state so automatic attachment can retry', () => {
    expect(toRuntimePresentation({ phase: 'failed', errorCode: 'CDP_READY_TIMEOUT' })).toEqual({
      runtimeActive: false,
      state: {
        theme: 'pending',
        cdp: 'disconnected',
        runtimeRunId: null,
        runtimeErrorCode: 'CDP_READY_TIMEOUT',
        runtimeAdapterId: null,
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
      },
    });
  });
});
