import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiagnosticLogger } from '../../src/core/logging/diagnostic-logger';
import { ThemeStorage } from '../../src/core/storage/theme-storage';

const theme = {
  id: 'midnight',
  version: '1.0.0',
  name: 'Midnight',
  source: 'unknown' as const,
  installPath: path.join('themes', 'midnight', '1.0.0'),
  archiveHash: 'a'.repeat(64),
};

describe('ThemeStorage', () => {
  it('persists proxy state and prevents deleting the current theme', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-storage-'));
    const storage = new ThemeStorage(root);
    await storage.initialize();
    await storage.setCurrentTheme(theme);
    await storage.setProxyEnabled(true);

    await expect(storage.readConfig()).resolves.toEqual({
      currentThemeId: 'midnight',
      currentThemeVersion: '1.0.0',
      proxyEnabled: true,
    });
    await expect(storage.deleteTheme(theme)).rejects.toThrow('THEME_CURRENT_CANNOT_DELETE');
    await rm(root, { recursive: true, force: true });
  });

  it('clears the current theme before allowing deletion', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-storage-'));
    const storage = new ThemeStorage(root);
    await storage.initialize();
    await storage.setCurrentTheme(theme);
    await storage.setCurrentTheme(null);

    await expect(storage.deleteTheme(theme)).resolves.toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });
});

describe('DiagnosticLogger', () => {
  it('retains ten logs and excludes unapproved sensitive fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-logs-'));
    const logger = new DiagnosticLogger(root);
    for (let index = 0; index < 11; index += 1) {
      await logger.append({ runId: `run-${index}`, phase: 'probe', errorCode: 'TEST', prompt: 'secret' } as never);
    }

    const files = await logger.recent();
    expect(files).toHaveLength(10);
    await expect(logger.readSafe(files[0]!)).resolves.not.toContain('secret');
    await rm(root, { recursive: true, force: true });
  });
});
