import type { ForgeConfig } from '@electron-forge/shared-types';
import { cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const sharpRuntimeModules = [
  'sharp',
  '@img/colour',
  '@img/sharp-win32-x64',
  'detect-libc',
  'semver',
];

async function copySharpRuntime(buildPath: string): Promise<void> {
  for (const moduleName of sharpRuntimeModules) {
    const source = resolve('node_modules', moduleName);
    const destination = join(buildPath, 'node_modules', moduleName);
    await cp(source, destination, { recursive: true });
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/@img/sharp-win32-x64/**',
    },
    afterCopy: [(buildPath, _electronVersion, _platform, _arch, done) => {
      copySharpRuntime(buildPath).then(() => done(), done);
    }],
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({})],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
