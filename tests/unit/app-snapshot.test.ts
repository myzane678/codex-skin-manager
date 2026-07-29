import { describe, expect, it } from 'vitest';
import { AppSnapshotSchema, validateAppSnapshot } from '../../src/shared/contracts/app-snapshot';

describe('AppSnapshotSchema', () => {
  it('accepts independent runtime dimensions', () => {
    expect(
      validateAppSnapshot({
        theme: 'pending',
        cdp: 'disconnected',
        proxy: 'disabled',
        recovery: 'idle',
      }),
    ).toBe(true);
  });

  it('accepts the verified Codex adapter identifier in runtime diagnostics', () => {
    expect(
      validateAppSnapshot({
        theme: 'applied',
        cdp: 'connected',
        proxy: 'disabled',
        recovery: 'idle',
        runtimeAdapterId: 'codex-26.715.4045',
      }),
    ).toBe(true);
  });

  it('accepts an unverified runtime compatibility warning', () => {
    expect(
      validateAppSnapshot({
        theme: 'applied',
        cdp: 'connected',
        proxy: 'disabled',
        recovery: 'idle',
        runtimeCompatibility: 'unverified',
      }),
    ).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(
      validateAppSnapshot({
        theme: 'native',
        cdp: 'disconnected',
        proxy: 'disabled',
        recovery: 'idle',
        secret: 'unexpected',
      }),
    ).toBe(false);
  });

  it('publishes the five theme runtime states', () => {
    expect(AppSnapshotSchema.properties.theme.anyOf.map((item) => item.const)).toEqual([
      'native',
      'pending',
      'applied',
      'compatibility-degraded',
      'recovering',
    ]);
  });
});
