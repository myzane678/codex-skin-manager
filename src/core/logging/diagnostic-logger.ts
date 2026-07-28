import { appendFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

export interface LogFields {
  startedAt?: string;
  runId?: string;
  managerVersion?: string;
  themeId?: string;
  themeVersion?: string;
  pid?: number;
  port?: number;
  browserId?: string;
  targetId?: string;
  compatibility?: 'verified' | 'unverified' | 'failed';
  phase?: string;
  errorCode?: string;
  recovery?: string;
}

const ALLOWED_FIELDS = new Set<keyof LogFields>([
  'startedAt', 'runId', 'managerVersion', 'themeId', 'themeVersion', 'pid', 'port', 'browserId', 'targetId',
  'compatibility', 'phase', 'errorCode', 'recovery',
]);

export class DiagnosticLogger {
  constructor(private readonly root: string, private readonly maxFiles = 10) {}

  async append(fields: LogFields): Promise<void> {
    const timestamp = new Date().toISOString();
    const safeFields: Record<string, unknown> = { timestamp };
    for (const [key, value] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.has(key as keyof LogFields)) safeFields[key] = value;
    }
    await mkdir(this.root, { recursive: true });
    const fileKey = typeof safeFields.runId === 'string'
      ? safeFields.runId
      : timestamp.replace(/[:.]/g, '-');
    const logPath = path.join(this.root, `run-${fileKey}.jsonl`);
    await appendFile(logPath, `${JSON.stringify(safeFields)}\n`, 'utf8');
    await this.rotate();
  }

  async recent(): Promise<string[]> {
    return (await readdir(this.root)).filter((name) => name.endsWith('.jsonl')).sort().reverse();
  }

  async readSafe(name: string): Promise<string> {
    if (!/^run-[a-zA-Z0-9-]+\.jsonl$/.test(name)) throw new Error('LOG_NAME_INVALID');
    const resolved = path.resolve(this.root, name);
    if (path.dirname(resolved) !== path.resolve(this.root)) throw new Error('LOG_NAME_INVALID');
    return readFile(resolved, 'utf8');
  }

  private async rotate(): Promise<void> {
    const files = await this.recent();
    for (const name of files.slice(this.maxFiles)) await rm(path.join(this.root, name), { force: true });
  }
}
