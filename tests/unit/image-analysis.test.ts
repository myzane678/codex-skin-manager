import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analyzeImage } from '../../src/core/image-theme/image-analysis';

describe('analyzeImage', () => {
  it('returns safe fallback suggestions for a transparent image', async () => {
    const transparentPixel = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    const analysis = await analyzeImage(transparentPixel);

    expect(analysis.candidates).toHaveLength(3);
    expect(analysis.candidates.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true);
    expect(analysis.defaultAccent).toMatch(/^#[0-9A-F]{6}$/);
    expect(['light', 'dark']).toContain(analysis.readability);
    expect(analysis.previewDataUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it('classifies a landscape image as wide without exposing arbitrary presentation values', async () => {
    const image = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#236A90' },
    }).png().toBuffer();

    const analysis = await analyzeImage(image);

    expect(analysis.imageLayout).toBe('wide');
    expect(analysis.safeArea).toBe('center');
    expect(analysis.focusX).toBe(50);
    expect(analysis.focusY).toBe(50);
  });

  it('uses a visually distinct right-side subject for focus and the opposite safe area', async () => {
    const image = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#8A8A8A' },
    }).composite([{
      input: await sharp({
        create: { width: 400, height: 500, channels: 3, background: '#236A90' },
      }).png().toBuffer(),
      left: 1080,
      top: 200,
    }]).png().toBuffer();

    const analysis = await analyzeImage(image);

    expect(analysis.focusX).toBeGreaterThan(60);
    expect(analysis.focusY).toBeGreaterThan(45);
    expect(analysis.safeArea).toBe('left');
  });
});
