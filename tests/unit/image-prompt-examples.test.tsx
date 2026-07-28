// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePromptExamples } from '../../src/renderer/ImagePromptExamples';

describe('ImagePromptExamples', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  it('offers four UI-safe prompt examples and copies a chosen prompt', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<ImagePromptExamples />));

    expect(container.textContent).toContain('留白构图');
    expect(container.textContent).toContain('抽象纹理');
    expect(container.textContent).toContain('自然场景');
    expect(container.textContent).toContain('建筑场景');

    const copyButton = container.querySelector<HTMLButtonElement>('button[title="复制留白构图提示词"]');
    if (!copyButton) throw new Error('COPY_BUTTON_NOT_FOUND');
    act(() => copyButton.click());
    await act(async () => { await Promise.resolve(); });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('16:9'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('编程工作区'));
    root.unmount();
  });
});
