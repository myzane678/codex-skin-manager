import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export interface ShortcutDetails {
  target: string;
  args?: string;
}

export interface ShortcutPort {
  writeShortcutLink(filePath: string, details: { target: string; args: string; description: string }): boolean;
  readShortcutLink(filePath: string): ShortcutDetails;
}

const SHORTCUT_NAME = 'Codex 主题版.lnk';
const THEMED_ARGUMENT = '--launch-themed';

export class WindowsThemeShortcut {
  private readonly shortcutPath: string;

  constructor(
    private readonly directory: string,
    private readonly shortcuts: ShortcutPort,
  ) {
    this.shortcutPath = path.join(directory, SHORTCUT_NAME);
  }

  async create(managerExecutable: string): Promise<string> {
    if (!path.isAbsolute(managerExecutable) || path.extname(managerExecutable).toLowerCase() !== '.exe') {
      throw new Error('SHORTCUT_TARGET_INVALID');
    }
    await mkdir(this.directory, { recursive: true });
    const written = this.shortcuts.writeShortcutLink(this.shortcutPath, {
      target: managerExecutable,
      args: THEMED_ARGUMENT,
      description: '通过 Codex Skin Manager 启动并尝试应用欢迎页主题',
    });
    if (!written) throw new Error('SHORTCUT_CREATE_FAILED');
    return this.shortcutPath;
  }

  matches(managerExecutable: string): boolean {
    try {
      const details = this.shortcuts.readShortcutLink(this.shortcutPath);
      return path.resolve(details.target) === path.resolve(managerExecutable)
        && (details.args?.trim() ?? '') === THEMED_ARGUMENT;
    } catch {
      return false;
    }
  }

  async removeOwned(managerExecutable: string): Promise<boolean> {
    if (!this.matches(managerExecutable)) return false;
    await rm(this.shortcutPath, { force: true });
    return true;
  }
}
