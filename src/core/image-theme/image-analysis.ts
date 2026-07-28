import sharp from 'sharp';

const MAX_PIXELS = 36_000_000;
const MAX_SAMPLE_SIZE = 96;
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const FALLBACK_COLORS = ['#2F6F63', '#C95F3D', '#34699A'] as const;
const SUPPORTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

export interface ImageAnalysis {
  candidates: [string, string, string];
  defaultAccent: string;
  readability: 'light' | 'dark';
  imageLayout: 'wide' | 'standard';
  focusX: number;
  focusY: number;
  safeArea: 'left' | 'center' | 'right';
  previewDataUrl: string;
}

export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
  const image = sharp(buffer, { failOn: 'error' });
  const metadata = await image.metadata();
  const pixelCount = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height || pixelCount > MAX_PIXELS) {
    throw new Error('IMAGE_INVALID');
  }

  const sampled = await image
    .clone()
    .resize({ width: MAX_SAMPLE_SIZE, height: MAX_SAMPLE_SIZE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const candidates = selectColors(sampled.data);
  const readability = meanLuminance(sampled.data) < 0.52 ? 'dark' : 'light';
  const focus = findFocus(sampled.data, sampled.info.width, sampled.info.height);
  const preview = await image
    .clone()
    .resize({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();

  return {
    candidates,
    defaultAccent: candidates[0],
    readability,
    imageLayout: metadata.width / metadata.height >= 1.45 ? 'wide' : 'standard',
    focusX: focus.x,
    focusY: focus.y,
    safeArea: focus.x > 60 ? 'left' : focus.x < 40 ? 'right' : 'center',
    previewDataUrl: `data:image/webp;base64,${preview.toString('base64')}`,
  };
}

function findFocus(rgba: Buffer, width: number, height: number): { x: number; y: number } {
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let count = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha === undefined || alpha < 32) continue;
    redTotal += rgba[offset] ?? 0;
    greenTotal += rgba[offset + 1] ?? 0;
    blueTotal += rgba[offset + 2] ?? 0;
    count += 1;
  }
  if (count === 0 || width <= 0 || height <= 0) return { x: 50, y: 50 };

  const averageRed = redTotal / count;
  const averageGreen = greenTotal / count;
  const averageBlue = blueTotal / count;
  let weightTotal = 0;
  let xTotal = 0;
  let yTotal = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha === undefined || alpha < 32) continue;
    const red = rgba[offset] ?? 0;
    const green = rgba[offset + 1] ?? 0;
    const blue = rgba[offset + 2] ?? 0;
    const difference = Math.hypot(red - averageRed, green - averageGreen, blue - averageBlue) / 441.67;
    const weight = Math.max(0, difference - 0.08);
    if (weight === 0) continue;
    const pixel = offset / 4;
    xTotal += (pixel % width) * weight;
    yTotal += Math.floor(pixel / width) * weight;
    weightTotal += weight;
  }
  if (weightTotal === 0) return { x: 50, y: 50 };
  return {
    x: Math.round((xTotal / weightTotal / Math.max(1, width - 1)) * 100),
    y: Math.round((yTotal / weightTotal / Math.max(1, height - 1)) * 100),
  };
}

function selectColors(rgba: Buffer): [string, string, string] {
  const buckets = new Map<string, number>();
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const alpha = rgba[offset + 3];
    if (red === undefined || green === undefined || blue === undefined || alpha === undefined || alpha < 32) continue;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max - min < 24) continue;
    const color = `#${quantize(red).toString(16).padStart(2, '0')}${quantize(green).toString(16).padStart(2, '0')}${quantize(blue).toString(16).padStart(2, '0')}`.toUpperCase();
    buckets.set(color, (buckets.get(color) ?? 0) + 1);
  }

  const ranked = [...buckets.entries()].sort((left, right) => right[1] - left[1]).map(([color]) => color);
  const colors = [...ranked];
  for (const fallback of FALLBACK_COLORS) {
    if (colors.length >= 3) break;
    if (!colors.includes(fallback)) colors.push(fallback);
  }
  return [colors[0] ?? FALLBACK_COLORS[0], colors[1] ?? FALLBACK_COLORS[1], colors[2] ?? FALLBACK_COLORS[2]];
}

function quantize(value: number): number {
  return Math.round(value / 32) * 32 > 255 ? 255 : Math.round(value / 32) * 32;
}

function meanLuminance(rgba: Buffer): number {
  let total = 0;
  let count = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const alpha = rgba[offset + 3];
    if (red === undefined || green === undefined || blue === undefined || alpha === undefined || alpha < 32) continue;
    total += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    count += 1;
  }
  return count === 0 ? 0.5 : total / count;
}
