import { describe, expect, it } from 'vitest';
import { compileInjectionPlan } from '../../src/core/theme-runtime/compiler';

describe('compileInjectionPlan', () => {
  it('compiles a controlled color-only shell for a theme without a background', () => {
    const plan = compileInjectionPlan({
      runId: 'native-interface',
      variables: { accent: '#2f6f63' },
      slots: { header: 'compact' },
      motion: { enabled: false },
      copy: { greeting: 'Welcome' },
      shell: { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: '#F4F7FB', mutedTextColor: '#B5C0D0' },
    });

    expect(plan.styleText).toContain('--color-theme-accent:#2f6f63');
    expect(plan.styleText).toContain('aside.app-shell-left-panel');
    expect(plan.styleText).toContain('main.main-surface');
    expect(plan.styleText).not.toContain('--dream-art:url(');
    expect(plan.decoration).toBeNull();
  });

  it('uses stronger shell color layers for forest and neon built-in themes', () => {
    const forest = compileInjectionPlan({
      runId: 'forest', variables: { accent: '#2F7D5A' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    });
    const neon = compileInjectionPlan({
      runId: 'neon', variables: { accent: '#24C6D8' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    });
    const amber = compileInjectionPlan({
      runId: 'amber', variables: { accent: '#D68A22' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    });

    expect(forest.styleText).toContain('--color-theme-surface:84%');
    expect(forest.styleText).toContain('.codex-skin-composer-dock{background:transparent!important}');
    expect(forest.styleText).toContain('.thread-scroll-container .bg-gradient-to-t.from-token-main-surface-primary{background:transparent!important}');
    expect(forest.styleText).not.toContain('padding-bottom');
    expect(neon.styleText).toContain('--color-theme-surface:82%');
    expect(amber.styleText).toContain('--color-theme-surface:94%');
  });

  it('uses only the shared verified visual runtime for every image theme', () => {
    const plan = compileInjectionPlan({
      runId: 'background-only',
      variables: { accent: '#806060' },
      slots: { header: 'standard' },
      motion: { enabled: true },
      copy: { greeting: 'Welcome' },
      shell: { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: '#F4F7FB', mutedTextColor: '#B5C0D0' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 72, focusY: 45, readability: 'dark',
        imageLayout: 'wide', safeArea: 'left', taskMode: 'ambient',
      },
    });

    expect(plan.styleText).toContain('--dream-art:url("data:image/png;base64,YmFja2dyb3VuZA==")');
    expect(plan.styleText).toContain('--dream-art-position:72% 45%');
    expect(plan.styleText).toContain('html[data-codex-skin]');
    expect(plan.styleText).not.toContain('html.codex-dream-skin');
    expect(plan.styleText).toContain('pointer-events: none');
    expect(plan.styleText).not.toMatch(/@import|javascript:|https:\/\/evil\.test/);
    expect(plan.decoration).toBeNull();
  });

  it('uses the same color-only shell regardless of legacy presentation fields', () => {
    const compact = compileInjectionPlan({
      runId: 'compact', variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    });
    const standard = compileInjectionPlan({
      runId: 'standard', variables: { accent: '#2f6f63' }, slots: { header: 'standard' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
    });

    expect(compact.styleText).toContain('--color-theme-accent:#2f6f63');
    expect(standard.styleText).toContain('--color-theme-accent:#2f6f63');
    expect(compact.decoration).toBeNull();
    expect(standard.decoration).toBeNull();
  });

  it('compiles a validated background into Dream Skin art variables', () => {
    const plan = compileInjectionPlan({
      runId: 'run-123',
      variables: { accent: '#2f6f63' },
      slots: { header: 'compact' },
      motion: { enabled: false },
      copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==',
        placement: 'cover', focusX: 70, focusY: 35, readability: 'dark',
      },
    });

    expect(plan.styleText).toContain('data:image/png;base64,YmFja2dyb3VuZA==');
    expect(plan.styleText).toContain('--dream-art-position:70% 35%');
    expect(plan.styleText).toMatch(/background-size:\s*cover/);
    expect(plan.styleText).toContain('main.main-surface');
    expect(plan.styleText).toContain('.codex-skin-composer-dock{background:transparent!important}');
    expect(plan.styleText).toContain('.thread-scroll-container .bg-gradient-to-t.from-token-main-surface-primary{background:transparent!important}');
    expect(plan.styleText).not.toMatch(/color-scheme|font-family|caret-color/);
    expect(plan.styleText).not.toMatch(/@import|javascript:|https:\/\/evil\.test/);
  });

  it('keeps readability metadata without recoloring the native interface', () => {
    const plan = compileInjectionPlan({
      runId: 'light-image', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: { dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light' },
    });

    expect(plan.presentation?.appearance).toBe('light');
    expect(plan.styleText).not.toMatch(/@import|javascript:|https:\/\/evil\.test/);
    expect(plan.styleText).toMatch(/background-image:\s*var\(--dream-art\)/);
  });

  it('lets a Dream Skin theme follow the native Codex appearance automatically', () => {
    const plan = compileInjectionPlan({
      runId: 'auto-image', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      appearance: 'auto',
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light',
        safeArea: 'auto', taskMode: 'auto',
      },
    });

    expect(plan.presentation).toEqual({ appearance: 'auto', imageLayout: 'standard', safeArea: 'auto', taskMode: 'auto' });
  });

  it('uses one fixed image background across the window for a cover image theme', () => {
    const plan = compileInjectionPlan({
      runId: 'continuous-image', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: { dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light' },
    });

    expect(plan.styleText).toContain('--dream-art:url("data:image/png;base64,YmFja2dyb3VuZA==")');
    expect(plan.styleText).toMatch(/data-codex-skin-page="task"[^{]*body/);
    expect(plan.styleText).toMatch(/background-size:\s*cover/);
    expect(plan.styleText).not.toMatch(/@import|javascript:|https:\/\/evil\.test/);
    expect(plan.styleText).toContain('.composer-surface-chrome');
  });

  it('clears only the verified current home shell for a standard image theme', () => {
    const plan = compileInjectionPlan({
      runId: 'standard-home', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light',
        imageLayout: 'standard', safeArea: 'center', taskMode: 'ambient',
      },
    });

    expect(plan.styleText).toContain('html[data-codex-skin][data-codex-skin-page="home"] main.main-surface');
    expect(plan.styleText).toContain('html[data-codex-skin][data-codex-skin-page="home"] main.main-surface > header.app-header-tint');
    expect(plan.styleText).not.toMatch(/html\[data-codex-skin\]\[data-codex-skin-page="home"\][^{]*\bbutton\b/);
  });

  it('compiles an immersive wide-image home surface with a controlled safe area', () => {
    const plan = compileInjectionPlan({
      runId: 'wide-home', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 72, focusY: 42, readability: 'dark',
        imageLayout: 'wide', safeArea: 'left', taskMode: 'ambient',
      },
    });

    expect(plan.presentation).toEqual({ appearance: 'dark', imageLayout: 'wide', safeArea: 'left', taskMode: 'ambient' });
    expect(plan.styleText).toContain('html[data-codex-skin][data-codex-skin-image="wide"]');
    expect(plan.styleText).toContain('main.main-surface');
    expect(plan.styleText).toMatch(/background-attachment:\s*fixed/);
  });

  it('ports the Dream Skin wide-art shell layers instead of a global glass overlay', () => {
    const plan = compileInjectionPlan({
      runId: 'dream-wide', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 72, focusY: 45, readability: 'light',
        imageLayout: 'wide', safeArea: 'left', taskMode: 'ambient',
      },
    });

    expect(plan.styleText).toContain('--dream-art:url("data:image/png;base64,YmFja2dyb3VuZA==")');
    expect(plan.styleText).toMatch(/html\[data-codex-skin\]\[data-codex-skin-page="home"\]\s+body/);
    expect(plan.styleText).toContain('aside.app-shell-left-panel');
    expect(plan.styleText).toMatch(/data-codex-skin-image="wide"\]\[data-codex-skin-page="home"\] main\.main-surface\s*\{\s*background: linear-gradient\(90deg,\s*var\(--dream-wide-edge\),\s*var\(--dream-wide-mid\) 64%,\s*var\(--dream-wide-far\)\) !important/);
    expect(plan.styleText).toMatch(/data-codex-skin-image="wide"\]\[data-codex-skin-page="home"\]\s+aside\.app-shell-left-panel[\s\S]*?var\(--dream-wide-sidebar\)/);
    expect(plan.styleText).toContain('.composer-surface-chrome');
    expect(plan.styleText).not.toContain('background-color:rgba(244,247,250,0.76)');
  });

  it('ports the verified Dream Skin visual surfaces for sidebar, composer, and task content', () => {
    const plan = compileInjectionPlan({
      runId: 'full-surface', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      appearance: 'auto',
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 72, focusY: 45, readability: 'light',
        imageLayout: 'wide', safeArea: 'left', taskMode: 'ambient',
      },
    });

    expect(plan.styleText).toContain('--dream-accent:#806060');
    expect(plan.styleText).toContain('.composer-surface-chrome');
    expect(plan.styleText).toContain('.dream-task::before');
    expect(plan.styleText).toContain('[data-message-author-role]');
    expect(plan.styleText).toContain('.group\\/home-suggestions button');
    expect(plan.styleText).toContain('pointer-events: none');
  });

  it('uses a low-interference ambient layer for a wide image task page', () => {
    const plan = compileInjectionPlan({
      runId: 'wide-task', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'dark',
        imageLayout: 'wide', safeArea: 'center', taskMode: 'ambient',
      },
    });

    expect(plan.styleText).toMatch(/html\[data-codex-skin\]\[data-codex-skin-image="wide"\]\[data-codex-skin-page="task"\]:is\(\[data-codex-skin-task-mode="ambient"\],\s*\[data-codex-skin-task-mode="banner"\]\)/);
    expect(plan.styleText).toContain('var(--dream-wide-task-edge)');
  });

  it('keeps the task page native when the controlled task mode is off', () => {
    const plan = compileInjectionPlan({
      runId: 'standard-task', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: {
        dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light',
        imageLayout: 'standard', safeArea: 'center', taskMode: 'off',
      },
    });

    expect(plan.presentation).toEqual({ appearance: 'light', imageLayout: 'standard', safeArea: 'center', taskMode: 'off' });
    expect(plan.styleText).not.toContain('.dream-task-off');
    expect(plan.styleText).toMatch(/data-codex-skin-page="task"\]:is\(\[data-codex-skin-task-mode="ambient"\], \[data-codex-skin-task-mode="banner"\]\)/);
  });

  it('keeps Dream Skin image surfaces authoritative when a legacy shell token is present', () => {
    const plan = compileInjectionPlan({
      runId: 'shell-image', variables: { accent: '#806060' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      shell: { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: '#F4F7FB', mutedTextColor: '#B5C0D0' },
      background: { dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 50, focusY: 50, readability: 'light' },
    });

    expect(plan.styleText).toContain('--dream-art:url("data:image/png;base64,YmFja2dyb3VuZA==")');
    expect(plan.styleText).not.toMatch(/#6D8399|#F4F7FB|#B5C0D0/);
  });

  it('ignores legacy shell tokens while retaining the controlled color-only shell', () => {
    const plan = compileInjectionPlan({
      runId: 'shell-run', variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      shell: { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: '#F4F7FB', mutedTextColor: '#B5C0D0' },
    }, false);

    expect(plan.styleText).toContain('--color-theme-accent:#2f6f63');
    expect(plan.decoration).toBeNull();
  });

  it('rejects values that could become arbitrary CSS', () => {
    expect(() => compileInjectionPlan({
      runId: 'run-123',
      variables: { accent: 'red; background:url(https://evil.test)' },
      slots: { header: 'compact' },
      motion: { enabled: false },
      copy: { greeting: 'Welcome' },
    })).toThrow('THEME_VALUE_INVALID');
  });

  it('rejects unsafe shell token values', () => {
    expect(() => compileInjectionPlan({
      runId: 'run-123', variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      shell: { surfaceOpacity: 72, sidebarOpacity: 62, blurPx: 18, borderColor: '#6D8399', textColor: 'white; background:url(https://evil.test)', mutedTextColor: '#B5C0D0' },
    })).toThrow('THEME_VALUE_INVALID');
  });

  it.each([
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/png;base64,evil);color:red',
  ])('rejects an unsafe background data URL', (dataUrl) => {
    expect(() => compileInjectionPlan({
      runId: 'run-123', variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: { dataUrl, placement: 'cover', focusX: 50, focusY: 50, readability: 'dark' },
    })).toThrow('THEME_VALUE_INVALID');
  });

  it('rejects out-of-range background coordinates', () => {
    expect(() => compileInjectionPlan({
      runId: 'run-123', variables: { accent: '#2f6f63' }, slots: { header: 'compact' }, motion: { enabled: false }, copy: { greeting: 'Welcome' },
      background: { dataUrl: 'data:image/png;base64,YmFja2dyb3VuZA==', placement: 'cover', focusX: 101, focusY: 50, readability: 'dark' },
    })).toThrow('THEME_VALUE_INVALID');
  });
});
