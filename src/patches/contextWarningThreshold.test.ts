import { describe, expect, it } from 'vitest';
import { writeContextWarningThreshold } from './contextWarningThreshold';

// CC 2.1.75 form (identifiers change per version, values are stable)
const declarationFragment =
  'var OSK=20000,Dgq=13000,ASK=20000,HSK=20000,wgq=3000;';

describe('writeContextWarningThreshold', () => {
  it('replaces the warning gap constant with 0', () => {
    const result = writeContextWarningThreshold(declarationFragment);

    expect(result).not.toBeNull();
    expect(result).toContain('ASK=0');
    expect(result).not.toContain('ASK=20000');
    // Surrounding constants are untouched
    expect(result).toContain('OSK=20000');
    expect(result).toContain('Dgq=13000');
    expect(result).toContain('HSK=20000');
    expect(result).toContain('wgq=3000');
  });

  it('works with arbitrary minified variable names', () => {
    const input = 'var A$=20000,B$=13000,C$=20000,D$=20000,E$=3000;';
    const result = writeContextWarningThreshold(input);

    expect(result).not.toBeNull();
    expect(result).toBe('var A$=20000,B$=13000,C$=0,D$=20000,E$=3000;');
  });

  it('preserves surrounding code before and after the declaration', () => {
    const prefix = 'function foo(){return 1;}';
    const suffix = 'function bar(){return 2;}';
    const result = writeContextWarningThreshold(
      `${prefix}${declarationFragment}${suffix}`
    );

    expect(result).not.toBeNull();
    expect(result!.startsWith(prefix)).toBe(true);
    expect(result!.endsWith(suffix)).toBe(true);
  });

  it('does NOT replace other 20000 occurrences (like max output tokens M77)', () => {
    // M77=20000 is the max output tokens constant — should not be affected
    const inputWithM77 =
      'var $tK=200000,M77=20000,OtK=32000,AtK=64000;' + declarationFragment;
    const result = writeContextWarningThreshold(inputWithM77);

    expect(result).not.toBeNull();
    // M77=20000 untouched
    expect(result).toContain('M77=20000');
    // The warning gap (ASK) set to 0
    expect(result).toContain('ASK=0');
  });

  it('does NOT replace OSK=20000 (output reservation) — only replaces ASK', () => {
    const result = writeContextWarningThreshold(declarationFragment);

    expect(result).not.toBeNull();
    // Output reservation stays at 20000
    expect(result).toContain('OSK=20000');
    // Warning gap set to 0
    expect(result).toContain(',ASK=0,');
  });

  it('returns null when the anchor pattern is absent', () => {
    const result = writeContextWarningThreshold('var someOtherCode=12345;');

    expect(result).toBeNull();
  });

  it('returns null when only unrelated 20000 constants exist', () => {
    // Has 20000 values but not adjacent to the 13000 anchor
    const result = writeContextWarningThreshold('var A=20000,B=20000,C=20000;');

    expect(result).toBeNull();
  });
});
