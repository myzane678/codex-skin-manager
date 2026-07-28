import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImageThemeCreator } from '../../src/core/image-theme/image-theme-creator';
import { ManagerService } from '../../src/core/manager-service';

describe('ImageThemeCreator', () => {
  it('creates and installs a theme from a controlled image draft', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-image-theme-'));
    const imagePath = path.join(root, 'source.png');
    await writeFile(imagePath, await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#236A90' },
    }).png().toBuffer());

    const manager = new ManagerService(path.join(root, 'themes'));
    await manager.initialize();
    const creator = new ImageThemeCreator(path.join(root, 'drafts'), manager);
    const draft = await creator.begin(imagePath);
    const snapshot = await creator.create({
      token: draft.token,
      name: '海岸夜色',
      accent: '#236A90',
      readability: 'dark',
      focusX: 70,
      focusY: 35,
      appearance: 'auto',
      safeArea: 'center',
      imageLayout: 'standard',
      taskMode: 'ambient',
    });

    expect(snapshot.themes).toHaveLength(1);
    const createdTheme = snapshot.themes[0];
    expect(createdTheme).toMatchObject({ name: '海岸夜色', accent: '#236A90' });
    if (!createdTheme) throw new Error('创建主题缺失');
    await expect(readFile(path.join(root, 'themes', createdTheme.id, '1.0.0', 'assets', 'background.webp'))).resolves.toBeInstanceOf(Buffer);
    await expect(manager.enableTheme(createdTheme.id, '1.0.0')).resolves.toBeDefined();
    const activeTheme = await manager.activeThemeInput();
    expect(activeTheme?.background).toMatchObject({ readability: 'dark', focusX: 70, focusY: 35 });
    expect(activeTheme?.background).toMatchObject({ imageLayout: 'standard', safeArea: 'center', taskMode: 'ambient' });
    expect(activeTheme?.appearance).toBe('auto');
    expect(activeTheme?.background?.dataUrl).toMatch(/^data:image\/webp;base64,/);
    await rm(root, { recursive: true, force: true });
  });

  it('preserves the image-derived focus and safe area in the created theme', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'codex-image-focus-'));
    const imagePath = path.join(root, 'source.png');
    await writeFile(imagePath, await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#8A8A8A' },
    }).composite([{
      input: await sharp({
        create: { width: 400, height: 500, channels: 3, background: '#236A90' },
      }).png().toBuffer(),
      left: 1080,
      top: 200,
    }]).png().toBuffer());

    const manager = new ManagerService(path.join(root, 'themes'));
    await manager.initialize();
    const creator = new ImageThemeCreator(path.join(root, 'drafts'), manager);
    const draft = await creator.begin(imagePath);
    const snapshot = await creator.create({
      token: draft.token,
      name: '右侧主体',
      accent: '#236A90',
      readability: draft.readability,
      focusX: draft.focusX,
      focusY: draft.focusY,
      appearance: 'auto',
      safeArea: draft.safeArea,
      imageLayout: draft.imageLayout,
      taskMode: 'ambient',
    });

    const createdTheme = snapshot.themes[0];
    if (!createdTheme) throw new Error('创建主题缺失');
    await manager.enableTheme(createdTheme.id, '1.0.0');
    const activeTheme = await manager.activeThemeInput();
    expect(activeTheme?.background).toMatchObject({ focusX: draft.focusX, focusY: draft.focusY, safeArea: 'left' });
    await rm(root, { recursive: true, force: true });
  });
});
