import { describe, expect, it } from 'vitest';
import { writeForceMaxSubscription } from './forceMaxSubscription';

// ── Fixture helpers ──────────────────────────────────────────────────────────

// Minimal fixture using CC 2.1.76-style function names (WD, gb, e8, s8).
// All CRITICAL and best-effort patterns are present.
const S8_BODY = `function s8(){if(!WD())return!1;return gb(e8()?.scopes)}`;

const S4_BODY =
  `function S4(){` +
  `if(gL())return dQ();` +
  `if(!IM())return null;` +
  `let x=e8();` +
  `if(!x)return null;` +
  `return x.subscriptionType??null}`;

// fD() body — unique via !=="firstParty" guard + null-subscription guard (2.1.78+; no GrowthBook flag)
const FD_BODY =
  `function fD(){` +
  `if(we()||WE()||Q8()!=="firstParty")return!1;` +
  `if(nq()&&k4()===null)return!1;` +
  `return!0}`;

// Max branch of zLK(): comma-expression with SF7 push
const A4_SITE = `if(O.push(ALK),_Q())O.push(SF7())`;

// Mb() opusplan plan branch — returns bare S0()
const A5_SITE = `if(ML()==="opusplan"&&T==="plan"&&!R)return S0()`;

const B1_SITE = `if(s8()){let T=e8();if(!T?.accessToken)return{headers:{},error:"No OAuth token available"}}`;

const B2_SITE = `apiKey:s8()?null:_||QZ(),authToken:s8()?e8()?.accessToken:void 0`;

const B3_SITE = `await lA(),y("[API:auth] OAuth token check complete"),!s8())zmR(z,R6())`;

const B4_SITE = `if(s8())headers.push(xJ)`;

const B5_SITE = `let _=gL();return s8()&&(_.source==="ANTHROPIC_AUTH_TOKEN"||_.source==="apiKeyHelper")}`;

const C1_SITE = `process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS||!s8()&&OK_(req.model)`;

const C2_SITE = `T==="true"&&!s8()`;

const C3_SITE = `_.status===429)return!s8()`;

const D1_SITE = `if(!done&&s8()){let tok=e8();if(!IM())done=!0;else if(tok&&Bp(tok.expiresAt))done=!0}`;

function makeFullFixture(): string {
  return [
    S8_BODY,
    S4_BODY,
    FD_BODY,
    A4_SITE,
    A5_SITE,
    B1_SITE,
    B2_SITE,
    B3_SITE,
    B4_SITE,
    B5_SITE,
    C1_SITE,
    C2_SITE,
    C3_SITE,
    D1_SITE,
  ].join(' ');
}

// ── Name extraction ──────────────────────────────────────────────────────────

describe('name extraction from s8() body', () => {
  it('extracts function names and builds origPred', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    // origPred = WD()&&gb(e8()?.scopes) must appear at auth sites
    expect(result).toContain('WD()&&gb(e8()?.scopes)');
  });

  it('returns null when s8 body is absent', () => {
    const content = makeFullFixture().replace(S8_BODY, '// s8 removed');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });

  it('handles $-containing identifiers (e.g. WD$, gb$, e8$)', () => {
    const content =
      `function s8$(){if(!WD$())return!1;return gb$(e8$()?.scopes)} ` +
      // A1: S4
      `function S4(){if(gL())return dQ();if(!IM())return null;let x=e8$();if(!x)return null;return x.subscriptionType??null} ` +
      // B1
      `if(s8$()){let T=e8$();if(!T?.accessToken)return{headers:{},error:"No OAuth token available"}} ` +
      // B2
      `apiKey:s8$()?null:_||QZ(),authToken:s8$()?e8$()?.accessToken:void 0 ` +
      // B3
      `await lA(),y("[API:auth] OAuth token check complete"),!s8$())zmR(z,R6())`;
    const result = writeForceMaxSubscription(content);
    expect(result).not.toBeNull();
    expect(result).toContain('function s8$(){return!0}');
    expect(result).toContain('WD$()&&gb$(e8$()?.scopes)');
  });
});

// ── Group A: Override patches ────────────────────────────────────────────────

describe('A1: S4() → "max"', () => {
  it('replaces subscriptionType body with return"max"', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('return"max"}');
    expect(result).not.toContain('subscriptionType??null');
  });

  it('returns null when A1 pattern is absent', () => {
    const content = makeFullFixture().replace(S4_BODY, '// S4 removed');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });
});

describe('A2: s8() → true', () => {
  it('replaces s8() body with return!0', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('function s8(){return!0}');
    expect(result).not.toContain('return gb(e8()?.scopes)');
  });
});

describe('A3: fD() → true when s8() (best-effort)', () => {
  it('prepends if(s8())return!0 to fD() body', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('function fD(){if(s8())return!0;');
    // original guards preserved after injection
    expect(result).toContain('if(we()||WE()||Q8()!=="firstParty")return!1;');
    expect(result).toContain('if(nq()&&k4()===null)return!1;');
  });

  it('continues (non-null) when A3 pattern is absent', () => {
    const content = makeFullFixture().replace(FD_BODY, '// fD removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

describe('A4: Remove SF7 from Max model list (best-effort)', () => {
  it('collapses comma-expression to just O.push(ALK)', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('O.push(ALK)');
    expect(result).not.toContain('O.push(SF7())');
  });

  it('continues (non-null) when A4 pattern is absent', () => {
    const content = makeFullFixture().replace(A4_SITE, '// A4 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

describe('A5: Mb() opusplan 1M suffix (best-effort)', () => {
  it('appends +(fD()?"[1m]":"") to S0() in opusplan plan branch', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('S0()+(fD()?"[1m]":"")');
    // raw S0() in opusplan branch should be gone (no S0() without the suffix)
    expect(result).not.toMatch(
      /"opusplan"&&\w+==="plan"&&!\w+\)return S0\(\)[^+]/
    );
  });

  it('continues (non-null) when A5 pattern is absent', () => {
    const content = makeFullFixture().replace(A5_SITE, '// A5 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });

  it('skips A5 entirely when A3 (fD) was not matched', () => {
    const content = makeFullFixture().replace(FD_BODY, '// fD removed');
    const result = writeForceMaxSubscription(content);
    expect(result).not.toBeNull();
    // A5 site is unchanged — no suffix appended since fdName was null
    expect(result).toContain('"opusplan"&&T==="plan"&&!R)return S0()');
  });
});

// ── Group B: Auth protection ─────────────────────────────────────────────────

describe('B1: qz() header selection', () => {
  it('replaces s8() with origPred at qz() site', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain(
      'if(WD()&&gb(e8()?.scopes)){let T=e8();if(!T?.accessToken)return{headers:{},error:"No OAuth token available"}'
    );
  });

  it('returns null when B1 pattern is absent', () => {
    const content = makeFullFixture().replace(B1_SITE, '// B1 removed');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });
});

describe('B2: Tb() apiKey/authToken', () => {
  it('replaces both s8() calls with origPred', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('apiKey:WD()&&gb(e8()?.scopes)?null:_||QZ()');
    expect(result).toContain(
      'authToken:WD()&&gb(e8()?.scopes)?e8()?.accessToken:void 0'
    );
  });

  it('returns null when B2 pattern is absent', () => {
    const content = makeFullFixture().replace(B2_SITE, '// B2 removed');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });
});

describe('B3: Tb() bearer injection', () => {
  it('wraps s8() in !(origPred) at bearer site', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain(
      '"[API:auth] OAuth token check complete"),!(WD()&&gb(e8()?.scopes))'
    );
  });

  it('returns null when B3 pattern is absent', () => {
    const content = makeFullFixture().replace(B3_SITE, '// B3 removed');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });
});

describe('B4: OAuth beta header (best-effort)', () => {
  it('replaces single push pattern with origPred guard', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('if(WD()&&gb(e8()?.scopes))headers.push(xJ)');
  });

  it('continues (non-null) when B4 pattern is absent', () => {
    const content = makeFullFixture().replace(B4_SITE, '// B4 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });

  it('skips B4 when multiple push patterns exist (ambiguous)', () => {
    // Add a second push pattern to trigger ambiguity guard
    const content = makeFullFixture() + ' if(s8())other.push(yJ)';
    const result = writeForceMaxSubscription(content);
    expect(result).not.toBeNull();
    // Neither push pattern should be replaced (both still say s8())
    // After A2 the function body is replaced, but call sites still use s8()
    expect(result).toContain('if(s8())headers.push(xJ)');
    expect(result).toContain('if(s8())other.push(yJ)');
  });
});

describe('B5: auth conflict warning (best-effort)', () => {
  it('replaces s8() with origPred in internal-token isActive', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain(
      'let _=gL();return (WD()&&gb(e8()?.scopes))&&(_.source==="ANTHROPIC_AUTH_TOKEN"||_.source==="apiKeyHelper")}'
    );
  });

  it('continues (non-null) when B5 pattern is absent', () => {
    const content = makeFullFixture().replace(B5_SITE, '// B5 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

// ── Group C: Resilience protection ───────────────────────────────────────────

describe('C1: Overload fallback (best-effort)', () => {
  it('wraps s8() in !(origPred) for overload fallback', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain(
      'FALLBACK_FOR_ALL_PRIMARY_MODELS||!(WD()&&gb(e8()?.scopes))&&OK_(req.model)'
    );
  });

  it('continues (non-null) when C1 pattern is absent', () => {
    const content = makeFullFixture().replace(C1_SITE, '// C1 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

describe('C2: x-should-retry hint (best-effort)', () => {
  it('wraps s8() in !(origPred) for retry hint', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('==="true"&&!(WD()&&gb(e8()?.scopes))');
  });

  it('continues (non-null) when C2 pattern is absent', () => {
    const content = makeFullFixture().replace(C2_SITE, '// C2 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

describe('C3: 429 retry (best-effort)', () => {
  it('wraps s8() in !(origPred) for 429 retry', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain('===429)return!(WD()&&gb(e8()?.scopes))');
  });

  it('continues (non-null) when C3 pattern is absent', () => {
    const content = makeFullFixture().replace(C3_SITE, '// C3 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

// ── Group D: Telemetry ───────────────────────────────────────────────────────

describe('D1: sendBatchWithRetry (best-effort)', () => {
  it('wraps s8() in (origPred) for sendBatchWithRetry', () => {
    const result = writeForceMaxSubscription(makeFullFixture());
    expect(result).not.toBeNull();
    expect(result).toContain(
      'if(!done&&(WD()&&gb(e8()?.scopes))){let tok=e8();if(!IM())done=!0;else if(tok&&Bp(tok.expiresAt))done=!0}'
    );
  });

  it('continues (non-null) when D1 pattern is absent', () => {
    const content = makeFullFixture().replace(D1_SITE, '// D1 removed');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});

// ── Critical failure chains ───────────────────────────────────────────────────

describe('critical failure returns null immediately', () => {
  it('returns null if ONLY s8 body absent (extraction fails)', () => {
    const content = [S4_BODY, B1_SITE, B2_SITE, B3_SITE].join(' ');
    expect(writeForceMaxSubscription(content)).toBeNull();
  });

  it('best-effort failures do not cause null return', () => {
    // Remove all best-effort sites, keep only CRITICAL ones
    const content = [S8_BODY, S4_BODY, B1_SITE, B2_SITE, B3_SITE].join(' ');
    expect(writeForceMaxSubscription(content)).not.toBeNull();
  });
});
