import type { AppSnapshot } from '../shared/contracts/app-snapshot';
import type { ThemeView } from '../shared/contracts/manager';

interface CurrentThemeStatusProps {
  theme: ThemeView | undefined;
  runtimeTheme: AppSnapshot['theme'];
  cdp: AppSnapshot['cdp'];
  runtimeCompatibility?: AppSnapshot['runtimeCompatibility'];
}

const runtimeLabels: Record<AppSnapshot['theme'], string> = {
  native: '原生模式',
  pending: '待启动',
  applied: '已应用',
  'compatibility-degraded': '兼容性降级',
  recovering: '恢复中',
};

export function CurrentThemeStatus({ theme, runtimeTheme, cdp, runtimeCompatibility }: CurrentThemeStatusProps) {
  const cdpLabel = cdp === 'connected' ? 'CDP 已连接' : 'CDP 未连接';
  const compatibilityLabel = runtimeTheme === 'applied' && runtimeCompatibility === 'unverified' ? ' · 未验证版本' : '';

  return (
    <div
      className={`current-theme-status ${theme ? 'themed' : 'native'}`}
      style={theme ? { borderLeftColor: theme.accent } : undefined}
    >
      <span className="current-theme-label">{theme ? 'CURRENT THEME' : '当前主题'}</span>
      <strong>{theme?.name ?? '原生模式'}</strong>
      <small>{theme ? `${runtimeLabels[runtimeTheme]}${compatibilityLabel} · ${cdpLabel}` : cdpLabel}</small>
    </div>
  );
}
