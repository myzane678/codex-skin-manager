import { describe, expect, it } from 'vitest';
import { isValidImagePath } from '../../src/main/image-input';

describe('isValidImagePath', () => {
  it('accepts a non-empty local path', () => {
    expect(isValidImagePath('C:\\images\\sample.png')).toBe(true);
  });

  it.each(['', '   ', null, 42, { path: 'C:\\images\\sample.png' }])('rejects invalid path input: %p', (value) => {
    expect(isValidImagePath(value)).toBe(false);
  });
});
