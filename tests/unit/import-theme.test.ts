import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import yazl from 'yazl';
import { describe, expect, it } from 'vitest';
import { importThemePackage } from '../../src/core/theme-package/import-theme';

function zip(files: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new yazl.ZipFile();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    archive.outputStream.pipe(output);
    archive.outputStream.on('error', reject);
    for (const [name, contents] of Object.entries(files)) {
      archive.addBuffer(Buffer.from(contents), name);
    }
    archive.end();
  });
}

const asset = 'fake-image-data';
const background = 'background-image-data';
const preview = 'preview';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const manifest = (assetHash = digest(asset), backgroundConfig?: Record<string, unknown>, backgroundMime = 'image/png') => JSON.stringify({
  schemaVersion: 1,
  id: 'midnight',
  name: 'Midnight',
  version: '1.0.0',
  author: 'Test',
  description: 'A safe test theme',
  codexCompatibility: '*',
  license: 'MIT',
  source: 'unknown',
  variables: { accent: '#2f6f63' },
  slots: { header: 'compact' },
  motion: { enabled: false },
  copy: { greeting: 'Welcome' },
  preview: { path: 'preview.png', mime: 'image/png', sha256: digest(preview) },
  assets: [
    { path: 'assets/mark.png', mime: 'image/png', sha256: assetHash },
    { path: 'assets/background.png', mime: backgroundMime, sha256: digest(background) },
  ],
  ...(backgroundConfig ? { background: backgroundConfig } : {}),
});

async function packageFile(files: Record<string, string>, rename?: readonly [string, string]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'codex-theme-test-'));
  const archivePath = path.join(directory, 'theme.codextheme');
  const archive = await zip(files);
  if (rename) {
    const [from, to] = rename;
    if (Buffer.byteLength(from) !== Buffer.byteLength(to)) throw new Error('ZIP fixture names must have equal byte length');
    let offset = archive.indexOf(from);
    while (offset >= 0) {
      archive.write(to, offset, 'utf8');
      offset = archive.indexOf(from, offset + to.length);
    }
  }
  await writeFile(archivePath, archive);
  return archivePath;
}

describe('importThemePackage', () => {
  it('installs a package with a declared local background asset', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(digest(asset), {
        assetPath: 'assets/background.png', placement: 'cover', focusX: 70, focusY: 35, readability: 'dark',
      }),
      'preview.png': preview,
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    const result = await importThemePackage(archivePath, root);

    expect(result.status).toBe('installed');
    await expect(readFile(path.join(root, 'midnight', '1.0.0', 'assets', 'background.png'), 'utf8')).resolves.toBe(background);
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a background with an unknown controlled presentation value', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(undefined, {
        assetPath: 'assets/background.png', placement: 'cover', focusX: 50, focusY: 50, readability: 'dark', imageLayout: 'panorama',
      }),
      'preview.png': asset,
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-skin-import-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_MANIFEST_INVALID' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('installs a valid package without enabling it', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(),
      'preview.png': 'preview',
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    const result = await importThemePackage(archivePath, root);

    expect(result.status).toBe('installed');
    expect(result.theme.id).toBe('midnight');
    expect(result.theme.version).toBe('1.0.0');
    await expect(readFile(path.join(root, 'midnight', '1.0.0', 'assets', 'mark.png'), 'utf8')).resolves.toBe(asset);
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a background that does not reference a supported declared asset', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(digest(asset), {
        assetPath: 'preview.png', placement: 'cover', focusX: 50, focusY: 50, readability: 'dark',
      }),
      'preview.png': preview,
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_BACKGROUND_INVALID' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a background with out-of-range focus coordinates', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(digest(asset), {
        assetPath: 'assets/background.png', placement: 'cover', focusX: 101, focusY: 50, readability: 'dark',
      }),
      'preview.png': preview,
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_MANIFEST_INVALID' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects an SVG asset as a page background', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(digest(asset), {
        assetPath: 'assets/background.png', placement: 'ambient', focusX: 50, focusY: 50, readability: 'light',
      }, 'image/svg+xml'),
      'preview.png': preview,
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_BACKGROUND_INVALID' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects traversal entries before publishing an installation', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(),
      'preview.png': 'preview',
      'xx/escape.txt': 'escape',
      'assets/mark.png': asset,
      'assets/background.png': background,
    }, ['xx/escape.txt', '../escape.txt']);
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_PATH_INVALID' });
    await expect(readFile(path.join(root, 'escape.txt'))).rejects.toThrow();
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects files that are not declared by the manifest', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest(),
      'preview.png': 'preview',
      'assets/mark.png': asset,
      'assets/background.png': background,
      'extra.txt': 'extra',
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_EXTRA_FILE' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it('rejects assets whose digest does not match the manifest', async () => {
    const archivePath = await packageFile({
      'manifest.json': manifest('0'.repeat(64)),
      'preview.png': 'preview',
      'assets/mark.png': asset,
      'assets/background.png': background,
    });
    const root = await mkdtemp(path.join(tmpdir(), 'codex-theme-install-'));

    await expect(importThemePackage(archivePath, root)).rejects.toMatchObject({ code: 'THEME_HASH_MISMATCH' });
    await rm(path.dirname(archivePath), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });
});
