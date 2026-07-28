import type { AppSnapshot } from './app-snapshot';

export interface ThemeView {
  id: string;
  version: string;
  name: string;
  source: 'unknown';
  active: boolean;
  accent: string;
  previewDataUrl: string;
}

export interface ManagerSnapshot extends AppSnapshot {
  themes: ThemeView[];
  diagnostic: string;
}

export interface ThemeIdentity {
  id: string;
  version: string;
}

export interface ImageThemeDraft {
  token: string;
  candidates: [string, string, string];
  defaultAccent: string;
  readability: 'light' | 'dark';
  focusX: number;
  focusY: number;
  imageLayout: 'wide' | 'standard';
  safeArea: 'left' | 'center' | 'right';
  previewDataUrl: string;
}

export interface CreateImageThemeInput {
  token: string;
  name: string;
  accent: string;
  readability: 'light' | 'dark';
  focusX: number;
  focusY: number;
  appearance: 'auto' | 'light' | 'dark';
  safeArea: 'auto' | 'left' | 'center' | 'right';
  imageLayout: 'wide' | 'standard';
  taskMode: 'auto' | 'ambient' | 'banner' | 'off';
}
