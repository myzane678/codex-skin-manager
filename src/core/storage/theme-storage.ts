import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createThemeArchive, type InstalledTheme } from '../theme-package/import-theme';
import { parseThemeManifest } from '../../shared/contracts/theme-manifest';

export interface ThemeConfig {
  currentThemeId: string | null;
  currentThemeVersion: string | null;
  proxyEnabled: boolean;
}

const DEFAULT_CONFIG: ThemeConfig = {
  currentThemeId: null,
  currentThemeVersion: null,
  proxyEnabled: false,
};

export class ThemeStorage {
  private readonly configPath: string;

  constructor(private readonly root: string) {
    this.configPath = path.join(root, 'config.json');
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    try {
      const config = await this.readConfig();
      await this.writeConfig(config);
    } catch {
      await this.writeConfig(DEFAULT_CONFIG);
    }
  }

  async readConfig(): Promise<ThemeConfig> {
    try {
      const value: unknown = JSON.parse(await readFile(this.configPath, 'utf8'));
      if (!isThemeConfig(value)) throw new Error('invalid config');
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
      throw error;
    }
  }

  async setCurrentTheme(theme: InstalledTheme | null): Promise<ThemeConfig> {
    const current = await this.readConfig();
    const next: ThemeConfig = {
      ...current,
      currentThemeId: theme?.id ?? null,
      currentThemeVersion: theme?.version ?? null,
    };
    await this.writeConfig(next);
    return next;
  }

  async setProxyEnabled(enabled: boolean): Promise<ThemeConfig> {
    const next = { ...(await this.readConfig()), proxyEnabled: enabled };
    await this.writeConfig(next);
    return next;
  }

  async deleteTheme(theme: InstalledTheme): Promise<void> {
    const current = await this.readConfig();
    if (current.currentThemeId === theme.id && current.currentThemeVersion === theme.version) {
      throw new Error('THEME_CURRENT_CANNOT_DELETE');
    }
    await rm(theme.installPath, { recursive: true, force: true });
  }

  async renameTheme(theme: InstalledTheme, name: string): Promise<InstalledTheme> {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 80) throw new Error('THEME_NAME_INVALID');

    const manifestPath = path.join(theme.installPath, 'manifest.json');
    const metadataPath = path.join(theme.installPath, '.installed.json');
    const archivePath = path.join(theme.installPath, 'package.codextheme');
    const manifestBytes = await readFile(manifestPath);
    const metadataBytes = await readFile(metadataPath);
    const archiveBytes = await readFile(archivePath);
    const manifest = parseThemeManifest(JSON.parse(manifestBytes.toString('utf8')) as unknown);
    if (manifest.id !== theme.id || manifest.version !== theme.version) throw new Error('THEME_MANIFEST_INVALID');

    const metadata = JSON.parse(metadataBytes.toString('utf8')) as InstalledTheme;
    if (metadata.id !== theme.id || metadata.version !== theme.version || metadata.installPath !== theme.installPath) throw new Error('THEME_METADATA_INVALID');

    const resources = new Map<string, Buffer>();
    for (const asset of [manifest.preview, ...manifest.assets]) {
      resources.set(asset.path, await readFile(path.join(theme.installPath, ...asset.path.split('/'))));
    }
    const renamedManifest = { ...manifest, name: trimmedName };
    const renamedTheme: InstalledTheme = {
      ...metadata,
      name: trimmedName,
      archiveHash: '',
    };

    const staging = await mkdtemp(path.join(theme.installPath, '.rename-'));
    const stagedManifestPath = path.join(staging, 'manifest.json');
    const stagedMetadataPath = path.join(staging, '.installed.json');
    const stagedArchivePath = path.join(staging, 'package.codextheme');
    try {
      await writeFile(stagedManifestPath, JSON.stringify(renamedManifest));
      await createThemeArchive(stagedArchivePath, renamedManifest, resources);
      renamedTheme.archiveHash = createHash('sha256').update(await readFile(stagedArchivePath)).digest('hex');
      await writeFile(stagedMetadataPath, JSON.stringify(renamedTheme));
      await replaceFilesAtomically([
        { target: manifestPath, staged: stagedManifestPath, original: manifestBytes },
        { target: metadataPath, staged: stagedMetadataPath, original: metadataBytes },
        { target: archivePath, staged: stagedArchivePath, original: archiveBytes },
      ]);
      return renamedTheme;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  async listThemes(): Promise<InstalledTheme[]> {
    const themes: InstalledTheme[] = [];
    for (const id of await safeDirectoryEntries(this.root)) {
      for (const version of await safeDirectoryEntries(path.join(this.root, id))) {
        try {
          themes.push(JSON.parse(await readFile(path.join(this.root, id, version, '.installed.json'), 'utf8')) as InstalledTheme);
        } catch {
          continue;
        }
      }
    }
    return themes;
  }

  private async writeConfig(config: ThemeConfig): Promise<void> {
    const tempPath = `${this.configPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(config)}\n`, { encoding: 'utf8', flag: 'w' });
    await rename(tempPath, this.configPath);
  }
}

interface Replacement {
  target: string;
  staged: string;
  original: Buffer;
}

async function replaceFilesAtomically(replacements: Replacement[]): Promise<void> {
  const backups = replacements.map((replacement) => `${replacement.target}.rename-backup`);
  try {
    for (const [index, replacement] of replacements.entries()) {
      await rename(replacement.target, backups[index]!);
    }
    for (const replacement of replacements) await rename(replacement.staged, replacement.target);
    await Promise.all(backups.map((backup) => rm(backup, { force: true })));
  } catch (error) {
    await Promise.all(replacements.map(async (replacement, index) => {
      await writeFile(replacement.target, replacement.original);
      await rm(backups[index]!, { force: true });
    }));
    throw error;
  }
}

function isThemeConfig(value: unknown): value is ThemeConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (typeof candidate.currentThemeId === 'string' || candidate.currentThemeId === null)
    && (typeof candidate.currentThemeVersion === 'string' || candidate.currentThemeVersion === null)
    && typeof candidate.proxyEnabled === 'boolean';
}

async function safeDirectoryEntries(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
