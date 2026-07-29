import type { ThemeRuntimeStatus } from '../core/runtime/theme-runtime-coordinator';
import type { AppSnapshot } from '../shared/contracts/app-snapshot';

type RuntimeState = Pick<AppSnapshot, 'theme' | 'cdp' | 'runtimeRunId' | 'runtimeErrorCode' | 'runtimeAdapterId' | 'runtimeCompatibility'>;

export interface RuntimePresentation {
  runtimeActive: boolean;
  state: RuntimeState;
}

export function toRuntimePresentation(status: ThemeRuntimeStatus): RuntimePresentation {
  switch (status.phase) {
    case 'connecting':
      return { runtimeActive: false, state: { theme: 'pending', cdp: 'connecting', runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null, runtimeCompatibility: null } };
    case 'applied':
      return { runtimeActive: true, state: { theme: 'applied', cdp: 'connected', runtimeRunId: status.runId ?? null, runtimeErrorCode: null, runtimeAdapterId: status.adapterId ?? null, runtimeCompatibility: status.compatibility ?? null } };
    case 'pending':
      return { runtimeActive: false, state: { theme: 'pending', cdp: 'connected', runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null, runtimeCompatibility: null } };
    case 'compatibility-degraded':
      return { runtimeActive: false, state: { theme: 'compatibility-degraded', cdp: 'connected', runtimeRunId: null, runtimeErrorCode: status.errorCode ?? null, runtimeAdapterId: status.adapterId ?? null, runtimeCompatibility: null } };
    case 'disconnected':
    case 'failed':
      return { runtimeActive: false, state: { theme: 'pending', cdp: 'disconnected', runtimeRunId: null, runtimeErrorCode: status.errorCode ?? null, runtimeAdapterId: null, runtimeCompatibility: null } };
  }
}
