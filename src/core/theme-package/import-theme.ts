import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import yazl from 'yazl';
import { parseThemeManifest, ThemePackageError, type ThemeManifest } from '../../shared/contracts/theme-manifest';

const LIMITS = {
  archive: 50 * 1024 * 1024,
  extracted: 200 * 1024 * 1024,
  entries: 128,
  resource: 20 * 1024 * 1024,
  manifest: 256 * 1024,
  preview: 5 * 1024 * 1024,
  compressionRatio: 20,
} as const;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export interface InstalledTheme {
  id: string;
  version: string;
  name: string;
  source: 'unknown';
  installPath: string;
  archiveHash: string;
}

export type ImportResult =
  | { status: 'installed'; theme: InstalledTheme }
  | { status: 'already-installed'; theme: InstalledTheme };

interface ArchiveEntry {
  entry: Entry;
  name: string;
  data: Buffer;
}

function openArchive(archivePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: false }, (error, zipFile) => {
      if (error || !zipFile) reject(new ThemePackageError('THEME_ZIP_INVALID', '无法读取主题包'));
      else resolve(zipFile);
    });
  });
}

function readEntry(zipFile: ZipFile, entry: Entry, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(new ThemePackageError('THEME_ZIP_INVALID', '无法读取主题包条目'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) stream.destroy(new ThemePackageError('THEME_LIMIT_EXCEEDED', '主题包资源超出限制'));
        else chunks.push(chunk);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}

function normalizeEntryName(fileName: string): string {
  if (fileName.includes('\\') || fileName.startsWith('/') || /^[a-zA-Z]:/.test(fileName) || fileName.includes(':')) {
    throw new ThemePackageError('THEME_PATH_INVALID', '主题包包含非法路径');
  }
  const normalized = path.posix.normalize(fileName);
  if (normalized === '..' || normalized.startsWith('../') || normalized.endsWith('/') || normalized !== fileName) {
    throw new ThemePackageError('THEME_PATH_INVALID', '主题包包含非法路径');
  }
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.' || segment.endsWith('.') || segment.endsWith(' ') || WINDOWS_RESERVED.test(segment)) {
      throw new ThemePackageError('THEME_PATH_INVALID', '主题包包含非法 Windows 路径');
    }
  }
  return normalized;
}

async function collectEntries(archivePath: string): Promise<ArchiveEntry[]> {
  const archiveInfo = await stat(archivePath);
  if (archiveInfo.size > LIMITS.archive) throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '主题包超出大小限制');

  const zipFile = await openArchive(archivePath);
  return new Promise((resolve, reject) => {
    const entries: ArchiveEntry[] = [];
    const seen = new Set<string>();
    let extracted = 0;

    const fail = (error: unknown) => {
      zipFile.close();
      if (error instanceof Error && error.message.startsWith('invalid relative path:')) {
        reject(new ThemePackageError('THEME_PATH_INVALID', '主题包包含非法路径'));
        return;
      }
      reject(error instanceof Error ? error : new Error('主题包读取失败'));
    };

    zipFile.on('error', fail);
    zipFile.on('entry', (entry: Entry) => {
      void (async () => {
        try {
          if (entries.length >= LIMITS.entries) throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '主题包条目过多');
          const name = normalizeEntryName(entry.fileName);
          const collisionKey = name.normalize('NFC').toLocaleLowerCase('en-US');
          if (seen.has(collisionKey)) throw new ThemePackageError('THEME_PATH_INVALID', '主题包包含重复或碰撞路径');
          seen.add(collisionKey);
          if ((entry.externalFileAttributes >>> 16 & 0o170000) === 0o120000) {
            throw new ThemePackageError('THEME_PATH_INVALID', '主题包不允许链接');
          }
          if (entry.uncompressedSize > LIMITS.resource) throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '单个资源超出限制');
          if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > LIMITS.compressionRatio) {
            throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '主题包压缩比异常');
          }
          extracted += entry.uncompressedSize;
          if (extracted > LIMITS.extracted) throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '主题包解压总量超出限制');
          const data = await readEntry(zipFile, entry, entry.fileName === 'manifest.json' ? LIMITS.manifest : LIMITS.resource);
          entries.push({ entry, name, data });
          zipFile.readEntry();
        } catch (error) {
          fail(error);
        }
      })();
    });
    zipFile.on('end', () => resolve(entries));
    zipFile.readEntry();
  });
}

function validateFiles(entries: ArchiveEntry[], manifest: ThemeManifest): void {
  const declaredAssets = [manifest.preview, ...manifest.assets];
  const declared = new Set(['manifest.json', ...declaredAssets.map((asset) => asset.path)]);
  const files = new Map(entries.map((item) => [item.name, item]));

  for (const name of files.keys()) {
    if (!declared.has(name)) throw new ThemePackageError('THEME_EXTRA_FILE', `未声明文件：${name}`);
  }
  for (const name of declared) {
    if (!files.has(name)) throw new ThemePackageError('THEME_FILE_MISSING', `缺少文件：${name}`);
  }
  if (files.get(manifest.preview.path)!.data.length > LIMITS.preview) {
    throw new ThemePackageError('THEME_LIMIT_EXCEEDED', '预览图超出限制');
  }
  for (const asset of declaredAssets) {
    normalizeEntryName(asset.path);
    const digest = createHash('sha256').update(files.get(asset.path)!.data).digest('hex');
    if (digest !== asset.sha256) throw new ThemePackageError('THEME_HASH_MISMATCH', `资源哈希不匹配：${asset.path}`);
  }
  if (manifest.background) {
    const asset = manifest.assets.find((candidate) => candidate.path === manifest.background!.assetPath);
    if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime)) {
      throw new ThemePackageError('THEME_BACKGROUND_INVALID', '主题背景资源无效');
    }
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export function createThemeArchive(
  archivePath: string,
  manifest: ThemeManifest,
  resources: Map<string, Buffer>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = new yazl.ZipFile();
    const output = createWriteStream(archivePath);
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    archive.outputStream.once('error', fail);
    output.once('error', fail);
    output.once('close', () => {
      if (!settled) resolve();
    });
    archive.outputStream.pipe(output);
    archive.addBuffer(Buffer.from(JSON.stringify(manifest)), 'manifest.json');
    for (const asset of [manifest.preview, ...manifest.assets]) {
      const data = resources.get(asset.path);
      if (!data) {
        fail(new ThemePackageError('THEME_FILE_MISSING', `缺少文件：${asset.path}`));
        return;
      }
      archive.addBuffer(data, asset.path);
    }
    archive.end();
  });
}

export async function importThemePackage(archivePath: string, storageRoot: string): Promise<ImportResult> {
  const entries = await collectEntries(archivePath);
  const manifestEntry = entries.find((item) => item.name === 'manifest.json');
  if (!manifestEntry) throw new ThemePackageError('THEME_MANIFEST_MISSING', '主题包缺少 manifest.json');

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestEntry.data.toString('utf8')) as unknown;
  } catch {
    throw new ThemePackageError('THEME_MANIFEST_INVALID', '主题清单不是有效 JSON');
  }
  const manifest = parseThemeManifest(manifestValue);
  normalizeEntryName(manifest.preview.path);
  validateFiles(entries, manifest);

  await mkdir(storageRoot, { recursive: true });
  const themeRoot = path.join(storageRoot, manifest.id);
  const destination = path.join(themeRoot, manifest.version);
  const archiveHash = await hashFile(archivePath);

  try {
    const installedMetadata = JSON.parse(await readFile(path.join(destination, '.installed.json'), 'utf8')) as InstalledTheme;
    if (installedMetadata.archiveHash === archiveHash) return { status: 'already-installed', theme: installedMetadata };
    throw new ThemePackageError('THEME_VERSION_CONFLICT', '相同主题版本已存在不同内容');
  } catch (error) {
    if (error instanceof ThemePackageError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(themeRoot, { recursive: true });
  const staging = await mkdtemp(path.join(themeRoot, `.staging-${manifest.version}-`));
  try {
    for (const item of entries) {
      const outputPath = path.join(staging, ...item.name.split('/'));
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, item.data, { flag: 'wx' });
    }
    await copyFile(archivePath, path.join(staging, 'package.codextheme'));
    const theme: InstalledTheme = {
      id: manifest.id,
      version: manifest.version,
      name: manifest.name,
      source: 'unknown',
      installPath: destination,
      archiveHash,
    };
    await writeFile(path.join(staging, '.installed.json'), JSON.stringify(theme));
    await rename(staging, destination);
    return { status: 'installed', theme };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
