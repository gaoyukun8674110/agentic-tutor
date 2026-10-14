import { describe, expect, it } from 'vitest';

import { deriveSelectedMaterialIds } from './materialSelection';

describe('material selection helpers', () => {
  it('does not auto-select available materials', () => {
    expect(deriveSelectedMaterialIds([1, 2, 3], [])).toEqual([]);
  });

  it('preserves explicit user selection across material refreshes', () => {
    expect(deriveSelectedMaterialIds([1, 2, 3], [1])).toEqual([1]);
  });

  it('drops missing selections while preserving matching ids', () => {
    expect(deriveSelectedMaterialIds([1, 2, 3], [1, 4])).toEqual([1]);
  });
});
