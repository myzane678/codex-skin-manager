import { DREAM_SKIN_CSS } from './dream-skin-css';
import type { CodexShellSelectors } from './codex-version-adapter';

export interface BackgroundThemeInput {
  dataUrl: string;
  placement: 'cover' | 'ambient';
  focusX: number;
  focusY: number;
  readability: 'light' | 'dark';
  imageLayout?: 'wide' | 'standard';
  safeArea?: 'auto' | 'left' | 'center' | 'right';
  taskMode?: 'auto' | 'ambient' | 'banner' | 'off';
}

export interface ThemePresentation {
  appearance: 'auto' | 'light' | 'dark';
  imageLayout: 'wide' | 'standard';
  safeArea: 'auto' | 'left' | 'center' | 'right';
  taskMode: 'auto' | 'ambient' | 'banner' | 'off';
}

export interface ShellThemeInput {
  surfaceOpacity: number;
  sidebarOpacity: number;
  blurPx: number;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
}

export interface CompileThemeInput {
  runId: string;
  variables: { accent: string };
  slots: { header: 'compact' | 'standard' };
  motion: { enabled: boolean };
  copy: { greeting: string };
  appearance?: 'auto' | 'light' | 'dark';
  shell?: ShellThemeInput;
  background?: BackgroundThemeInput;
}

export interface InjectionPlan {
  runId: string;
  styleText: string;
  shell: CodexShellSelectors | null;
  presentation: ThemePresentation | null;
  decoration: {
    attribute: string;
    className: string;
    text: string;
    pointerEvents: 'none';
  } | null;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const RUN_ID = /^[a-zA-Z0-9-]{1,64}$/;
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const SHARED_SHELL_CSS = 'html[data-codex-skin] .codex-skin-composer-dock{background:transparent!important}html[data-codex-skin] .thread-scroll-container .bg-gradient-to-t.from-token-main-surface-primary{background:transparent!important}';

export function compileInjectionPlan(input: CompileThemeInput, _includeWelcomeDecoration?: boolean): InjectionPlan {
  void _includeWelcomeDecoration;
  if (!COLOR.test(input.variables.accent) || !RUN_ID.test(input.runId)) {
    throw new Error('THEME_VALUE_INVALID');
  }
  if (input.appearance !== undefined && !['auto', 'light', 'dark'].includes(input.appearance)) {
    throw new Error('THEME_VALUE_INVALID');
  }
  if (input.background && !isValidBackground(input.background)) throw new Error('THEME_VALUE_INVALID');
  if (input.shell && !isValidShell(input.shell)) throw new Error('THEME_VALUE_INVALID');

  const presentation = input.background ? presentationFrom(input.background, input.appearance) : null;
  const themeStyleText = input.background && presentation
    ? compileDreamSkin(input.background, input.variables.accent)
    : compileColorTheme(input.variables.accent);
  const styleText = `${themeStyleText}${SHARED_SHELL_CSS}`;

  return {
    runId: input.runId,
    styleText,
    shell: null,
    presentation,
    decoration: null,
  };
}

function isValidBackground(background: BackgroundThemeInput): boolean {
  return DATA_URL.test(background.dataUrl)
    && (background.placement === 'cover' || background.placement === 'ambient')
    && (background.readability === 'light' || background.readability === 'dark')
    && Number.isInteger(background.focusX)
    && Number.isInteger(background.focusY)
    && background.focusX >= 0
    && background.focusX <= 100
    && background.focusY >= 0
    && background.focusY <= 100
    && (background.imageLayout === undefined || background.imageLayout === 'wide' || background.imageLayout === 'standard')
    && (background.safeArea === undefined || background.safeArea === 'auto' || background.safeArea === 'left' || background.safeArea === 'center' || background.safeArea === 'right')
    && (background.taskMode === undefined || background.taskMode === 'auto' || background.taskMode === 'ambient' || background.taskMode === 'banner' || background.taskMode === 'off');
}

function presentationFrom(background: BackgroundThemeInput, appearance?: CompileThemeInput['appearance']): ThemePresentation {
  return {
    appearance: appearance ?? background.readability,
    imageLayout: background.imageLayout ?? 'standard',
    safeArea: background.safeArea ?? 'auto',
    taskMode: background.taskMode ?? 'auto',
  };
}

function isValidShell(shell: ShellThemeInput): boolean {
  return Number.isInteger(shell.surfaceOpacity)
    && shell.surfaceOpacity >= 35
    && shell.surfaceOpacity <= 96
    && Number.isInteger(shell.sidebarOpacity)
    && shell.sidebarOpacity >= 35
    && shell.sidebarOpacity <= 96
    && Number.isInteger(shell.blurPx)
    && shell.blurPx >= 0
    && shell.blurPx <= 32
    && COLOR.test(shell.borderColor)
    && COLOR.test(shell.textColor)
    && COLOR.test(shell.mutedTextColor);
}

function compileDreamSkin(background: BackgroundThemeInput, accent: string): string {
  return `${DREAM_SKIN_CSS}html[data-codex-skin]{--dream-art:url("${background.dataUrl}");--dream-art-position:${background.focusX}% ${background.focusY}%;--dream-accent:${accent}}`;
}

function compileColorTheme(accent: string): string {
  const surface = accent.toUpperCase() === '#2F7D5A' ? 84 : accent.toUpperCase() === '#24C6D8' ? 82 : 94;
  const sidebar = Math.max(surface - 5, 0);
  return `html[data-codex-skin]{--color-theme-accent:${accent};--color-theme-surface:${surface}%;--color-theme-sidebar:${sidebar}%;--color-theme-wash:color-mix(in oklab,Canvas var(--color-theme-surface),var(--color-theme-accent));--color-theme-side:color-mix(in oklab,Canvas var(--color-theme-sidebar),var(--color-theme-accent));--color-theme-line:color-mix(in oklab,CanvasText 18%,var(--color-theme-accent));--color-theme-hover:color-mix(in oklab,var(--color-theme-accent) 18%,Canvas)}html[data-codex-skin] aside.app-shell-left-panel{background:var(--color-theme-side)!important;border-color:var(--color-theme-line)!important;box-shadow:inset -1px 0 var(--color-theme-line)!important}html[data-codex-skin] main.main-surface{background:var(--color-theme-wash)!important}html[data-codex-skin] main.main-surface>header.app-header-tint{background:color-mix(in oklab,var(--color-theme-wash) 88%,transparent)!important}html[data-codex-skin] aside.app-shell-left-panel button:hover,html[data-codex-skin] aside.app-shell-left-panel [aria-current="page"]{background:var(--color-theme-hover)!important}`;
}
