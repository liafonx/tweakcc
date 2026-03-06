import { describe, expect, it } from 'vitest';
import { writeSuppressUpdateNotification } from './suppressUpdateNotification';

const makeFakeContent = (funcName: string = '$G0') =>
  `some preamble;function ${funcName}(){var x=createElement(L,{color:"warning",wrap:"truncate"},"Update available! Run: ",createElement(L,{bold:true},$));return x}more code`;

describe('suppressUpdateNotification', () => {
  it('injects return null at component function start', () => {
    const content = makeFakeContent();
    const result = writeSuppressUpdateNotification(content);

    expect(result).not.toBeNull();
    expect(result).toContain('return null;');
    expect(result).toContain('return null;var x=createElement');
    expect(result).toContain('Update available! Run: ');
  });

  it('returns null when anchor string is missing', () => {
    const content = 'function foo(){return "no update banner here"}';
    const result = writeSuppressUpdateNotification(content);

    expect(result).toBeNull();
  });

  it('returns null when no enclosing function is found', () => {
    const content = 'Update available! Run: ';
    const result = writeSuppressUpdateNotification(content);

    expect(result).toBeNull();
  });

  it('handles different function identifier names', () => {
    const result1 = writeSuppressUpdateNotification(makeFakeContent('AG0'));
    const result2 = writeSuppressUpdateNotification(makeFakeContent('xY$z'));

    expect(result1).not.toBeNull();
    expect(result1).toContain('return null;');
    expect(result2).not.toBeNull();
    expect(result2).toContain('return null;');
  });
});
