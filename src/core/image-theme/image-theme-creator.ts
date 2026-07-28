import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import yazl from 'yazl';
import type { CreateImageThemeInput, ImageThemeDraft, ManagerSnapshot } from '../../shared/contracts/manager';
import type { ManagerService } from '../manager-service';
import { analyzeImage } from './image-analysis';

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

interface DraftFile {
  createdAt: number;
  backgroundPath: string;
  imageLayout: 'wide' | 'standard';
  safeArea: 'left' | 'center' | 'right';
}

export class ImageThemeCreator {
  private readonly drafts = new Map<string, DraftFile>();

  constructor(
    private readonly draftRoot: string,
    private readonly manager: ManagerService,
  ) {}

  async begin(imagePath: string): Promise<ImageThemeDraft> {
    const file = await stat(imagePath);
    if (file.size > MAX_INPUT_BYTES) throw new Error('IMAGE_TOO_LARGE');
    const source = await readFile(imagePath);
    const analysis = await analyzeImage(source);
    const token = randomUUID();
    await mkdir(this.draftRoot, { recursive: true });
    const backgroundPath = path.join(this.draftRoot, `${token}.webp`);
    await sharp(source)
      .resize({ width: 2560, height: 1440, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(backgroundPath);
    this.drafts.set(token, { createdAt: Date.now(), backgroundPath, imageLayout: analysis.imageLayout, safeArea: analysis.safeArea });
    return { ...analysis, token };
  }

  async create(input: CreateImageThemeInput): Promise<ManagerSnapshot> {
    this.validateInput(input);
    const draft = this.drafts.get(input.token);
    if (!draft || Date.now() - draft.createdAt > TOKEN_MAX_AGE_MS) throw new Error('IMAGE_DRAFT_INVALID');
    this.drafts.delete(input.token);

    const archivePath = path.join(this.draftRoot, `${input.token}.codextheme`);
    try {
      const background = await readFile(draft.backgroundPath);
      const preview = await sharp(background).resize({ width: 640, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
      const id = `${slugify(input.name) || 'picture-theme'}-${input.token.slice(0, 8)}`;
      const manifest = JSON.stringify({
        schemaVersion: 1,
        id,
        name: input.name.trim(),
        version: '1.0.0',
        author: '本地创建',
        description: '从本地图片创建的主题',
        codexCompatibility: '*',
        license: 'UNLICENSED',
        source: 'unknown',
        appearance: input.appearance,
        variables: { accent: input.accent.toUpperCase() },
        slots: { header: 'compact' },
        motion: { enabled: false },
        shell: input.readability === 'dark'
          ? { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: '#F4F7FB', mutedTextColor: '#B5C0D0' }
          : { surfaceOpacity: 82, sidebarOpacity: 72, blurPx: 14, borderColor: '#748394', textColor: '#18212B', mutedTextColor: '#526273' },
        copy: { greeting: 'Welcome' },
        preview: asset('preview.webp', 'image/webp', preview),
        assets: [asset('assets/background.webp', 'image/webp', background)],
        background: {
          assetPath: 'assets/background.webp', placement: 'cover', focusX: input.focusX, focusY: input.focusY, readability: input.readability,
          imageLayout: input.imageLayout, safeArea: input.safeArea, taskMode: input.taskMode,
        },
      });
      await createArchive(archivePath, {
        'manifest.json': Buffer.from(manifest),
        'preview.webp': preview,
        'assets/background.webp': background,
      });
      return await this.manager.importTheme(archivePath);
    } finally {
      await Promise.all([rm(draft.backgroundPath, { force: true }), rm(archivePath, { force: true })]);
    }
  }

  private validateInput(input: CreateImageThemeInput): void {
    if (!this.drafts.has(input.token) || !input.name.trim() || input.name.trim().length > 80 || !/^#[0-9a-fA-F]{6}$/.test(input.accent)) {
      throw new Error('IMAGE_DRAFT_INVALID');
    }
    if (!['light', 'dark'].includes(input.readability)
      || !['auto', 'light', 'dark'].includes(input.appearance)
      || !['auto', 'left', 'center', 'right'].includes(input.safeArea)
      || !['wide', 'standard'].includes(input.imageLayout)
      || !['auto', 'ambient', 'banner', 'off'].includes(input.taskMode)
      || !Number.isInteger(input.focusX) || !Number.isInteger(input.focusY) || input.focusX < 0 || input.focusX > 100 || input.focusY < 0 || input.focusY > 100) {
      throw new Error('IMAGE_DRAFT_INVALID');
    }
  }
}

function asset(pathName: string, mime: 'image/webp', data: Buffer): { path: string; mime: 'image/webp'; sha256: string } {
  return { path: pathName, mime, sha256: createHash('sha256').update(data).digest('hex') };
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55);
}

function createArchive(archivePath: string, files: Record<string, Buffer>): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = new yazl.ZipFile();
    const output = createWriteStream(archivePath);
    archive.outputStream.once('error', reject);
    output.once('error', reject);
    archive.outputStream.pipe(output);
    output.once('close', resolve);
    for (const [name, data] of Object.entries(files)) archive.addBuffer(data, name);
    archive.end();
  });
}
