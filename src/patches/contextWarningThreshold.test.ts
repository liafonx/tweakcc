import { describe, expect, it } from 'vitest';
import { writeContextWarningThreshold } from './contextWarningThreshold';

// CC 2.1.73 form (identifiers change per version, values are stable)
const declarationFragment =
  'var GrR=20000,vZq=13000,hrR=20000,ZrR=20000,VZq=3000;';

describe('writeContextWarningThreshold', () => {
  it('replaces the warning gap constant with a custom value', () => {
    const result = writeContextWarningThreshold(declarationFragment, 5000);

    expect(result).not.toBeNull();
    expect(result).toContain('hrR=5000');
    expect(result).not.toContain('hrR=20000');
    // Surrounding constants are untouched
    expect(result).toContain('GrR=20000');
    expect(result).toContain('vZq=13000');
    expect(result).toContain('ZrR=20000');
    expect(result).toContain('VZq=3000');
  });

  it('works with arbitrary minified variable names', () => {
    const input = 'var A$=20000,B$=13000,C$=20000,D$=20000,E$=3000;';
    const result = writeContextWarningThreshold(input, 10000);

    expect(result).not.toBeNull();
    expect(result).toBe('var A$=20000,B$=13000,C$=10000,D$=20000,E$=3000;');
  });

  it('preserves surrounding code before and after the declaration', () => {
    const prefix = 'function foo(){return 1;}';
    const suffix = 'function bar(){return 2;}';
    const result = writeContextWarningThreshold(
      `${prefix}${declarationFragment}${suffix}`,
      5000
    );

    expect(result).not.toBeNull();
    expect(result!.startsWith(prefix)).toBe(true);
    expect(result!.endsWith(suffix)).toBe(true);
  });

  it('does NOT replace other 20000 occurrences (like max output tokens M77)', () => {
    // M77=20000 is the max output tokens constant — should not be affected
    const inputWithM77 =
      'var $tK=200000,M77=20000,OtK=32000,AtK=64000;' + declarationFragment;
    const result = writeContextWarningThreshold(inputWithM77, 5000);

    expect(result).not.toBeNull();
    // M77=20000 untouched
    expect(result).toContain('M77=20000');
    // The warning gap (hrR) replaced
    expect(result).toContain('hrR=5000');
  });

  it('does NOT replace GrR=20000 (output reservation) — only replaces hrR', () => {
    const result = writeContextWarningThreshold(declarationFragment, 8000);

    expect(result).not.toBeNull();
    // Output reservation stays at 20000
    expect(result).toContain('GrR=20000');
    // Warning gap replaced
    expect(result).toContain(',hrR=8000,');
  });

  it('returns null when the anchor pattern is absent', () => {
    const result = writeContextWarningThreshold(
      'var someOtherCode=12345;',
      5000
    );

    expect(result).toBeNull();
  });

  it('returns null when only unrelated 20000 constants exist', () => {
    // Has 20000 values but not adjacent to the 13000 anchor
    const result = writeContextWarningThreshold(
      'var A=20000,B=20000,C=20000;',
      5000
    );

    expect(result).toBeNull();
  });
});
