// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ThemeCard } from '../../src/renderer/ThemeCard';

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
}

describe('ThemeCard', () => {
  it('edits a theme name inline and cancels with Escape', () => {
    const onRename = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    const render = () => root.render(
      <ThemeCard
        theme={{ id: 'amber-workbench', version: '1.0.0', name: 'Amber Workbench', source: 'unknown', active: false, accent: '#D68A22', previewDataUrl: 'data:image/png;base64,cHJldmlldw==' }}
        busy={false}
        onEnable={vi.fn()}
        onDisable={vi.fn()}
        onDelete={vi.fn()}
        onExport={vi.fn()}
        onRename={onRename}
      />,
    );

    act(render);
    const renameButton = container.querySelector<HTMLButtonElement>('button[title="重命名主题"]');
    act(() => renameButton?.click());

    const input = container.querySelector<HTMLInputElement>('input[name="theme-name"]');
    expect(input?.value).toBe('Amber Workbench');
    act(() => {
      if (!input) return;
      setInputValue(input, '   ');
    });
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    act(() => {
      if (!input) return;
      setInputValue(input, 'Evening Workbench');
    });
    const form = container.querySelector<HTMLFormElement>('form');
    act(() => form?.requestSubmit());
    expect(onRename).toHaveBeenCalledWith('Evening Workbench');

    act(() => renameButton?.click());
    const escapeInput = container.querySelector<HTMLInputElement>('input[name="theme-name"]');
    act(() => {
      escapeInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('input[name="theme-name"]')).toBeNull();
    expect(onRename).toHaveBeenCalledTimes(1);
    void root.unmount();
  });
});
