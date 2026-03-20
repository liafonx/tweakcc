import { describe, it, expect } from 'vitest';
import { writeDiffSyntaxThemeOverride } from './diffSyntaxThemeOverride';

// 2.1.71+: render extracted to Ns$-style wrapper function
// factory-call → null-guard → WeakMap cache → new Class(...).render(theme,w,dim)
const mock2171 =
  'function Ns$(_,q,T,K,$,A,O){' +
  'let H=si7();if(!H)return null;' +
  'let z=`${$}|${A}`,R=Tn7.get(_),w=R?.get(z);' +
  'if(w)return w;' +
  'let Y=new H(_,q,T,K).render($,A,O)' +
  '}';

describe('diffSyntaxThemeOverride', () => {
  describe('2.1.71+ wrapper-function pattern', () => {
    it('should intercept theme in new Class().render() call', () => {
      const result = writeDiffSyntaxThemeOverride(mock2171);
      expect(result).not.toBeNull();
      // theme arg should be wrapped with builtin test
      expect(result).toContain('.test($)?$:"dark-ansi"');
      // constructor args and width/dim preserved
      expect(result).toContain('new H(_,q,T,K).render(');
      expect(result).toContain(',A,O)');
    });

    it('should not alter the rest of the function body', () => {
      const result = writeDiffSyntaxThemeOverride(mock2171)!;
      expect(result).toContain('if(!H)return null');
      expect(result).toContain('if(w)return w');
      expect(result).toContain('let Y=');
    });
  });

  describe('null-return case', () => {
    it('should return null when no pattern matches', () => {
      const result = writeDiffSyntaxThemeOverride('not a valid binary');
      expect(result).toBeNull();
    });

    it('should return null for empty input', () => {
      const result = writeDiffSyntaxThemeOverride('');
      expect(result).toBeNull();
    });
  });
});
