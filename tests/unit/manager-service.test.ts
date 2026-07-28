import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ManagerService } from '../../src/core/manager-service';

describe('ManagerService', () => {
  it('reads an active theme background as a controlled data URL', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-manager-'));
    const installPath = path.join(root, 'background-theme', '1.0.0');
    const background = Buffer.from('background');
    await mkdir(path.join(installPath, 'assets'), { recursive: true });
    await writeFile(path.join(installPath, 'assets', 'background.png'), background);

    const manager = new ManagerService(root);
    await manager.initialize();
    await writeFile(path.join(installPath, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, id: 'background-theme', name: 'Background Theme', version: '1.0.0', author: 'Test', description: 'Background test theme', codexCompatibility: '*', license: 'MIT', source: 'unknown',
      variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      preview: { path: 'preview.png', mime: 'image/png', sha256: createHash('sha256').update('preview').digest('hex') },
      assets: [{ path: 'assets/background.png', mime: 'image/png', sha256: createHash('sha256').update(background).digest('hex') }],
      background: { assetPath: 'assets/background.png', placement: 'cover', focusX: 70, focusY: 35, readability: 'dark' },
    }));
    await writeFile(path.join(installPath, 'preview.png'), 'preview');
    await writeFile(path.join(installPath, '.installed.json'), JSON.stringify({
      id: 'background-theme', version: '1.0.0', name: 'Background Theme', source: 'unknown', installPath, archiveHash: 'test',
    }));
    await manager.enableTheme('background-theme', '1.0.0');

    await expect(manager.activeThemeInput()).resolves.toMatchObject({
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 70, focusY: 35, readability: 'dark',
      },
    });
    await rm(root, { recursive: true, force: true });
  });

  it('exposes the manifest accent on the active theme view', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-manager-'));
    const manager = new ManagerService(root);
    await manager.initialize();
    await manager.importTheme(path.resolve('themes/amber-workbench.codextheme'));
    await manager.enableTheme('amber-workbench', '1.0.0');

    const snapshot = await manager.snapshot();

    expect(snapshot.themes.find((theme) => theme.active)?.accent).toBe('#D68A22');
    await rm(root, { recursive: true, force: true });
  });

  it('exports an installed theme package to the chosen destination', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-manager-'));
    const destination = path.join(root, 'amber-workbench.codextheme');
    const manager = new ManagerService(path.join(root, 'themes'));
    await manager.initialize();
    await manager.importTheme(path.resolve('themes/amber-workbench.codextheme'));

    await manager.exportTheme('amber-workbench', '1.0.0', destination);

    expect((await stat(destination)).isFile()).toBe(true);
    const imported = new ManagerService(path.join(root, 'second-themes'));
    await imported.initialize();
    await imported.importTheme(destination);
    await expect(imported.snapshot()).resolves.toMatchObject({ themes: [expect.objectContaining({ id: 'amber-workbench' })] });
    await rm(root, { recursive: true, force: true });
  });

  it('renames an installed active theme consistently across its package surfaces', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-manager-'));
    const destination = path.join(root, 'renamed-theme.codextheme');
    const themesRoot = path.join(root, 'themes');
    const manager = new ManagerService(themesRoot);
    await manager.initialize();
    await manager.importTheme(path.resolve('themes/amber-workbench.codextheme'));
    await manager.enableTheme('amber-workbench', '1.0.0');

    const snapshot = await manager.renameTheme('amber-workbench', '1.0.0', 'Evening Workbench');
    const installPath = path.join(themesRoot, 'amber-workbench', '1.0.0');

    expect(snapshot.themes).toContainEqual(expect.objectContaining({ id: 'amber-workbench', name: 'Evening Workbench', active: true }));
    await expect(readFile(path.join(installPath, 'manifest.json'), 'utf8')).resolves.toContain('"name":"Evening Workbench"');
    await expect(readFile(path.join(installPath, '.installed.json'), 'utf8')).resolves.toContain('"name":"Evening Workbench"');

    await manager.exportTheme('amber-workbench', '1.0.0', destination);
    const imported = new ManagerService(path.join(root, 'second-themes'));
    await imported.initialize();
    await imported.importTheme(destination);
    await expect(imported.snapshot()).resolves.toMatchObject({ themes: [expect.objectContaining({ id: 'amber-workbench', name: 'Evening Workbench' })] });
    await rm(root, { recursive: true, force: true });
  });
});
