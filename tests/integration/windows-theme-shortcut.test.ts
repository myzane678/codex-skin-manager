import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WindowsThemeShortcut, type ShortcutDetails, type ShortcutPort } from '../../src/platform/windows/theme-shortcut';

const managerPath = 'C:\\Program Files\\Codex Skin Manager\\Codex Skin Manager.exe';

class MemoryShortcutPort implements ShortcutPort {
  private details: ShortcutDetails | null = null;

  writeShortcutLink(filePath: string, details: { target: string; args: string; description: string }): boolean {
    void filePath;
    this.details = details;
    return true;
  }

  readShortcutLink(filePath: string): ShortcutDetails {
    void filePath;
    if (!this.details) throw new Error('SHORTCUT_MISSING');
    return this.details;
  }
}


describe.runIf(process.platform === 'win32')('WindowsThemeShortcut', () => {
  it('creates and removes only a matching themed shortcut in its supplied directory', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'codex-shortcut-'));
    const shortcut = new WindowsThemeShortcut(directory, new MemoryShortcutPort());

    const created = await shortcut.create(managerPath);
    expect(created).toBe(path.join(directory, 'Codex 主题版.lnk'));
    expect(shortcut.matches(managerPath)).toBe(true);

    await shortcut.removeOwned(managerPath);
    await rm(directory, { recursive: true, force: true });
  });
});
