import { describe, expect, it, vi } from 'vitest';
import type { MenuItem } from 'electron';
import type { ManagerSnapshot, ThemeIdentity } from '../../src/shared/contracts/manager';
import { buildTrayMenuTemplate, type TrayMenuAction } from '../../src/main/tray-menu';

const first: ThemeIdentity = { id: 'first', version: '1.0.0' };
const second: ThemeIdentity = { id: 'second', version: '1.0.0' };

function snapshot(active: ThemeIdentity | null): ManagerSnapshot {
  return {
    theme: active ? 'pending' : 'native', cdp: 'connected', proxy: 'watching', recovery: 'idle',
    runtimeRunId: null, runtimeErrorCode: null, runtimeAdapterId: null, diagnostic: '',
    themes: [first, second].map((theme) => ({ ...theme, name: theme.id, source: 'unknown' as const, active: theme.id === active?.id, accent: '#2f6f63', previewDataUrl: '' })),
  };
}

describe('buildTrayMenuTemplate', () => {
  it('lists native appearance and every installed theme with the current item checked', () => {
    const template = buildTrayMenuTemplate(snapshot(second), vi.fn());
    const switchMenu = template.find((item) => item.label === '切换主题');

    expect(switchMenu?.submenu).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '原生外观', type: 'radio', checked: false }),
      expect.objectContaining({ label: 'second', type: 'radio', checked: true }),
      expect.objectContaining({ label: 'first', type: 'radio', checked: false }),
    ]));
  });

  it('routes theme choices, opening, and quitting through supplied callbacks', () => {
    const action = vi.fn<(action: TrayMenuAction) => void>();
    const template = buildTrayMenuTemplate(snapshot(first), action);
    const switchMenu = template.find((item) => item.label === '切换主题');
    const nativeItem = switchMenu?.submenu?.find((item) => item.label === '原生外观');
    const secondItem = switchMenu?.submenu?.find((item) => item.label === 'second');

    const keyboardEvent = {} as KeyboardEvent;
    nativeItem?.click?.({} as MenuItem, undefined, keyboardEvent);
    secondItem?.click?.({} as MenuItem, undefined, keyboardEvent);
    template.find((item) => item.label === '打开管理器')?.click?.({} as MenuItem, undefined, keyboardEvent);
    template.find((item) => item.label === '退出')?.click?.({} as MenuItem, undefined, keyboardEvent);

    expect(action).toHaveBeenNthCalledWith(1, { kind: 'native' });
    expect(action).toHaveBeenNthCalledWith(2, { kind: 'theme', identity: second });
    expect(action).toHaveBeenNthCalledWith(3, { kind: 'open-manager' });
    expect(action).toHaveBeenNthCalledWith(4, { kind: 'quit' });
  });
});
