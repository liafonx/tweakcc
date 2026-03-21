import { describe, expect, it } from 'vitest';
import { writeShowClearContextOnPlanAccept } from './showClearContextOnPlanAccept';

const originalFragment =
  'f=zT((t)=>t.settings.showClearContextOnPlanAccept)??!1,Y=_.assistantMessage';
const replacementFragment =
  'f=zT((t)=>t.settings.showClearContextOnPlanAccept)??!0,Y=_.assistantMessage';

describe('writeShowClearContextOnPlanAccept', () => {
  it('replaces the showClearContextOnPlanAccept default from false to true', () => {
    const result = writeShowClearContextOnPlanAccept(
      `before ${originalFragment} after`
    );

    expect(result).not.toBeNull();
    expect(result).toContain(replacementFragment);
    expect(result).not.toContain('.showClearContextOnPlanAccept)??!1');
  });

  it('returns null when the pattern is absent', () => {
    const result = writeShowClearContextOnPlanAccept(
      'showClearContextOnPlanAccept:C.boolean().optional()'
    );

    expect(result).toBeNull();
  });

  it('preserves surrounding code before and after the match', () => {
    const prefix = 'const before="before";';
    const suffix = 'const after="after";';
    const result = writeShowClearContextOnPlanAccept(
      `${prefix}.showClearContextOnPlanAccept)??!1${suffix}`
    );

    expect(result).toBe(`${prefix}.showClearContextOnPlanAccept)??!0${suffix}`);
  });
});
