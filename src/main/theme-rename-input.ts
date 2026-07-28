import type { ThemeIdentity } from '../shared/contracts/manager';

export function isValidThemeRenameInput(identity: unknown, name: unknown): identity is ThemeIdentity & { name: string } {
  if (!identity || typeof identity !== 'object' || typeof name !== 'string') return false;
  const candidate = identity as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && typeof candidate.version === 'string'
    && candidate.version.length > 0
    && name.trim().length >= 1
    && name.trim().length <= 80;
}
