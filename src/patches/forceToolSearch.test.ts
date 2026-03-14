import { describe, expect, it } from 'vitest';
import { writeForceToolSearch } from './forceToolSearch';

const originalFragment =
  'return["api.anthropic.com"].includes(Xe)}catch{return!1}';
const replacementFragment = 'return!0}catch{return!0}';

describe('writeForceToolSearch', () => {
  it('replaces the api.anthropic.com domain check', () => {
    const result = writeForceToolSearch(`before ${originalFragment} after`);

    expect(result).not.toBeNull();
    expect(result).toContain(replacementFragment);
    expect(result).not.toContain(originalFragment);
  });

  it('works with arbitrary minified variable names', () => {
    for (const varName of ['A', 'Xe', '$abc']) {
      const input =
        `return["api.anthropic.com"].includes(${varName})}` + 'catch{return!1}';
      const result = writeForceToolSearch(input);

      expect(result).toBe(replacementFragment);
    }
  });

  it('returns null when the pattern is absent', () => {
    const result = writeForceToolSearch('return["example.com"].includes(Xe)');

    expect(result).toBeNull();
  });

  it('preserves surrounding code before and after the match', () => {
    const prefix = 'const before="before";';
    const suffix = 'const after="after";';
    const result = writeForceToolSearch(
      `${prefix}${originalFragment}${suffix}`
    );

    expect(result).toBe(`${prefix}${replacementFragment}${suffix}`);
  });
});
