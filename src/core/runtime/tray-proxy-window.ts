export interface ProcessCandidate {
  pid: number;
  executablePath: string;
}

export interface ProxyObservation {
  status: 'ignored' | 'candidate' | 'expired';
  candidate?: ProcessCandidate;
}

export class TrayProxyWindow {
  private readonly knownPids = new Set<number>();
  private candidate: ProcessCandidate | null = null;
  private startedAt: number | null = null;

  constructor(
    existingProcesses: readonly ProcessCandidate[],
    private readonly now: () => number,
    private readonly windowMs = 5_000,
  ) {
    for (const process of existingProcesses) this.knownPids.add(process.pid);
  }

  observe(processes: readonly ProcessCandidate[]): ProxyObservation {
    if (this.startedAt !== null && this.now() - this.startedAt >= this.windowMs) {
      this.candidate = null;
      this.startedAt = null;
      return { status: 'expired' };
    }
    for (const process of processes) {
      if (this.knownPids.has(process.pid)) continue;
      this.knownPids.add(process.pid);
      if (this.candidate) continue;
      this.candidate = process;
      this.startedAt = this.now();
      return { status: 'candidate', candidate: process };
    }
    return { status: 'ignored' };
  }

  consumeCandidate(): ProcessCandidate | null {
    const candidate = this.candidate;
    this.candidate = null;
    this.startedAt = null;
    return candidate;
  }
}
