import { describe, expect, it, vi } from 'vitest';
import { acquireSingleInstanceLock, revealManagerWindow } from '../../src/main/single-instance';

describe('single instance guard', () => {
  it('quits a second manager process when the existing instance owns the lock', () => {
    const quit = vi.fn();

    expect(acquireSingleInstanceLock({ requestSingleInstanceLock: () => false, quit })).toBe(false);
    expect(quit).toHaveBeenCalledOnce();
  });

  it('keeps the first manager process running when it acquires the lock', () => {
    const quit = vi.fn();

    expect(acquireSingleInstanceLock({ requestSingleInstanceLock: () => true, quit })).toBe(true);
    expect(quit).not.toHaveBeenCalled();
  });

  it('restores and focuses the existing manager window for a second launch', () => {
    const restore = vi.fn();
    const show = vi.fn();
    const focus = vi.fn();

    revealManagerWindow({ isMinimized: () => true, restore, show, focus });

    expect(restore).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
