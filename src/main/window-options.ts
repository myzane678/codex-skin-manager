import type { BrowserWindowConstructorOptions } from 'electron';

export function createWindowOptions(preload: string): BrowserWindowConstructorOptions {
  return {
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f5f5f2',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}
