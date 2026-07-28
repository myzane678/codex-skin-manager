import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('native module packaging', () => {
  it('keeps sharp and its Windows native runtime in the packaged application', async () => {
    const config = await readFile(new URL('../../forge.config.ts', import.meta.url), 'utf8');

    expect(config).toContain("@electron-forge/plugin-auto-unpack-natives");
    expect(config).toContain('afterCopy: [(buildPath');
    expect(config).toContain("'sharp'");
    expect(config).toContain("'@img/sharp-win32-x64'");
    expect(config).toContain('await cp(source, destination, { recursive: true })');
    expect(config).toContain('copySharpRuntime(buildPath).then(() => done(), done)');
    expect(config).toContain("unpack: '**/node_modules/@img/sharp-win32-x64/**'");
    expect(config).toMatch(/new AutoUnpackNativesPlugin\(\{\}\)/);
  });
});
