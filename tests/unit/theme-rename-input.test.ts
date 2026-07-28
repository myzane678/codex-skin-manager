import { describe, expect, it } from 'vitest';
import { isValidThemeRenameInput } from '../../src/main/theme-rename-input';

describe('isValidThemeRenameInput', () => {
  it('accepts an identity and a trimmed theme name up to 80 characters', () => {
    expect(isValidThemeRenameInput({ id: 'amber-workbench', version: '1.0.0' }, ' Evening Workbench ')).toBe(true);
    expect(isValidThemeRenameInput({ id: 'amber-workbench', version: '1.0.0' }, 'a'.repeat(80))).toBe(true);
  });

  it('rejects malformed identities and invalid names', () => {
    expect(isValidThemeRenameInput({ id: '', version: '1.0.0' }, 'Evening Workbench')).toBe(false);
    expect(isValidThemeRenameInput({ id: 'amber-workbench', version: '' }, 'Evening Workbench')).toBe(false);
    expect(isValidThemeRenameInput({ id: 'amber-workbench', version: '1.0.0' }, '   ')).toBe(false);
    expect(isValidThemeRenameInput({ id: 'amber-workbench', version: '1.0.0' }, 'a'.repeat(81))).toBe(false);
  });
});
