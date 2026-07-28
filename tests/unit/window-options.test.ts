import { describe, expect, it } from 'vitest';
import { createWindowOptions } from '../../src/main/window-options';

describe('createWindowOptions', () => {
  it('isolates and sandboxes the renderer', () => {
    const options = createWindowOptions('C:/app/preload.js');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: 'C:/app/preload.js',
    });
  });
});
