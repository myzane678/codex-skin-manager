export type RecoveryStepName = 'rollback-injection' | 'disable-theme' | 'stop-proxy' | 'remove-shortcut' | 'clear-runtime';
export type RecoveryStepStatus = 'completed' | 'failed' | 'manual-action';

export interface RecoveryStepResult {
  name: RecoveryStepName;
  status: RecoveryStepStatus;
  errorCode?: string;
}

export interface RecoveryReport {
  status: 'restored' | 'partial' | 'manual-action';
  steps: RecoveryStepResult[];
}

export interface RecoveryPorts {
  rollbackInjection(): Promise<void>;
  disableTheme(): Promise<void>;
  stopProxy(): Promise<void>;
  removeOwnedShortcut(): Promise<void>;
  clearRuntime(): Promise<void>;
}

const steps: Array<[RecoveryStepName, keyof RecoveryPorts]> = [
  ['rollback-injection', 'rollbackInjection'],
  ['disable-theme', 'disableTheme'],
  ['stop-proxy', 'stopProxy'],
  ['remove-shortcut', 'removeOwnedShortcut'],
  ['clear-runtime', 'clearRuntime'],
];

export async function restoreDefaults(ports: RecoveryPorts): Promise<RecoveryReport> {
  const results: RecoveryStepResult[] = [];
  for (const [name, method] of steps) {
    try {
      await ports[method]();
      results.push({ name, status: 'completed' });
    } catch (error) {
      const status = error instanceof ManualActionRequired ? 'manual-action' : 'failed';
      results.push({ name, status, errorCode: error instanceof Error ? error.message : 'RECOVERY_UNKNOWN' });
    }
  }
  if (results.some((step) => step.status === 'manual-action')) return { status: 'manual-action', steps: results };
  if (results.some((step) => step.status === 'failed')) return { status: 'partial', steps: results };
  return { status: 'restored', steps: results };
}

export class ManualActionRequired extends Error {}
