// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ImageThemeCreator } from '../../src/renderer/ImageThemeCreator';

describe('ImageThemeCreator', () => {
  it('renders a draft and sends the chosen accent when creating', () => {
    const onCreate = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <ImageThemeCreator
          draft={{ token: 'draft-1', candidates: ['#236A90', '#C95F3D', '#34699A'], defaultAccent: '#236A90', readability: 'dark', focusX: 50, focusY: 50, imageLayout: 'standard', safeArea: 'center', previewDataUrl: 'data:image/webp;base64,cHJldmlldw==' }}
          busy={false}
          onCancel={vi.fn()}
          onCreate={onCreate}
        />,
      );
    });

    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelectorAll('[data-accent]')).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>('input[name="name"]')).not.toBeNull();
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(container.querySelector('select[name="appearance"]')).not.toBeNull();
    expect(container.querySelector('select[name="safeArea"]')).not.toBeNull();
    expect(container.querySelector('select[name="imageLayout"]')).not.toBeNull();
    expect(container.querySelector('select[name="taskMode"]')).not.toBeNull();
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
    const color = container.querySelector<HTMLButtonElement>('[data-accent="#C95F3D"]');
    act(() => color?.click());
    const form = container.querySelector<HTMLFormElement>('form');
    act(() => form?.requestSubmit());

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      accent: '#C95F3D', token: 'draft-1', appearance: 'auto', safeArea: 'center', imageLayout: 'standard', taskMode: 'ambient',
    }));
    root.unmount();
  });
});
