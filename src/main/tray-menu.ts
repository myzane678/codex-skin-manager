import type { MenuItemConstructorOptions } from 'electron';
import type { ManagerSnapshot, ThemeIdentity } from '../shared/contracts/manager';

export type TrayMenuAction =
  | { kind: 'native' }
  | { kind: 'theme'; identity: ThemeIdentity }
  | { kind: 'open-manager' }
  | { kind: 'quit' };

export type TrayMenuItem = Omit<MenuItemConstructorOptions, 'submenu'> & { submenu?: TrayMenuItem[] };

export function buildTrayMenuTemplate(
  snapshot: ManagerSnapshot,
  onAction: (action: TrayMenuAction) => void,
): TrayMenuItem[] {
  const themeItems: TrayMenuItem[] = [
    {
      label: '原生外观',
      type: 'radio',
      checked: snapshot.theme === 'native',
      click: () => onAction({ kind: 'native' }),
    },
    ...snapshot.themes.map((theme) => ({
      label: theme.name,
      type: 'radio' as const,
      checked: theme.active,
      click: () => onAction({ kind: 'theme', identity: { id: theme.id, version: theme.version } }),
    })),
  ];

  return [
    { label: '打开管理器', click: () => onAction({ kind: 'open-manager' }) },
    { label: '切换主题', submenu: themeItems },
    { type: 'separator' },
    { label: '退出', click: () => onAction({ kind: 'quit' }) },
  ];
}
