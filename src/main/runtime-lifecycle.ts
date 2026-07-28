export interface ManagerRetentionState {
  proxyEnabled: boolean;
  runtimeActive: boolean;
  isQuitting: boolean;
}

export function shouldKeepManagerAlive(state: ManagerRetentionState): boolean {
  return !state.isQuitting && (state.proxyEnabled || state.runtimeActive);
}

export function isThemeRuntimeActive(theme: AppSnapshot['theme']): boolean {
  return theme === 'applied';
}
import type { AppSnapshot } from '../shared/contracts/app-snapshot';
