import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrentThemeStatus } from '../../src/renderer/CurrentThemeStatus';

describe('CurrentThemeStatus', () => {
  it('shows the active theme identity, pending state, CDP state, and accent', () => {
    const markup = renderToStaticMarkup(
      <CurrentThemeStatus
        theme={{
          id: 'amber-workbench',
          version: '1.0.0',
          name: '琥珀工作台',
          source: 'unknown',
          active: true,
          accent: '#D68A22',
          previewDataUrl: 'data:image/svg+xml;base64,',
        }}
        runtimeTheme="pending"
        cdp="connected"
      />,
    );

    expect(markup).toContain('CURRENT THEME');
    expect(markup).toContain('琥珀工作台');
    expect(markup).toContain('待启动 · CDP 已连接');
    expect(markup).toContain('border-left-color:#D68A22');
  });

  it('shows native mode when no theme is active', () => {
    const markup = renderToStaticMarkup(
      <CurrentThemeStatus theme={undefined} runtimeTheme="native" cdp="disconnected" />,
    );

    expect(markup).toContain('当前主题');
    expect(markup).toContain('原生模式');
    expect(markup).toContain('CDP 未连接');
    expect(markup).not.toContain('CURRENT THEME');
  });

  it('warns when an applied theme uses an unverified Codex version', () => {
    const markup = renderToStaticMarkup(
      <CurrentThemeStatus
        theme={{
          id: 'amber-workbench',
          version: '1.0.0',
          name: '琥珀工作台',
          source: 'unknown',
          active: true,
          accent: '#D68A22',
          previewDataUrl: 'data:image/svg+xml;base64,',
        }}
        runtimeTheme="applied"
        cdp="connected"
        runtimeCompatibility="unverified"
      />,
    );

    expect(markup).toContain('已应用 · 未验证版本 · CDP 已连接');
  });
});
