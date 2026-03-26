import { describe, expect, it } from 'vitest';
import { writeForceBypassPermissionsAvailable } from './forceBypassPermissionsAvailable';

// CC 2.1.81 representative fragments for each sub-patch site.
// Real identifiers are replaced with short single-letter names for readability.

/** S1: init flag — isBypassPermissionsModeAvailable computed at startup */
const s1Fragment = ',D=(K==="bypassPermissions"||R)&&!w&&!Y,';

/** S2: kill-switch function ni() */
const s2Fragment =
  'function ni(){let _=QO("tengu_disable_bypass_permissions_mode"),q=(P8()||{}).permissions?.disableBypassPermissionsMode==="disable";return _||q}';

/** S3: async-disable function M1_() */
const s3Fragment =
  'function M1_(_){let T=_;if(_.mode==="bypassPermissions")T=QA(_,{type:"setMode",mode:"default",destination:"session"});return{...T,isBypassPermissionsModeAvailable:!1}}';

const allFragments = s1Fragment + s2Fragment + s3Fragment;

// ── S1 tests ──────────────────────────────────────────────────────────────────

describe('writeForceBypassPermissionsAvailable — S1 (init flag)', () => {
  it('forces the init flag to !0', () => {
    const result = writeForceBypassPermissionsAvailable(allFragments);

    expect(result).not.toBeNull();
    expect(result).toContain(',D=!0,');
    expect(result).not.toContain('(K==="bypassPermissions"||R)&&!w&&!Y');
  });

  it('works with arbitrary minified identifiers in S1', () => {
    const input =
      ',X$=(A$==="bypassPermissions"||B$)&&!C$&&!D$,' + s2Fragment + s3Fragment;
    const result = writeForceBypassPermissionsAvailable(input);

    expect(result).not.toBeNull();
    expect(result).toContain(',X$=!0,');
  });

  it('returns null when S1 pattern is absent', () => {
    const result = writeForceBypassPermissionsAvailable(
      s2Fragment + s3Fragment
    );

    expect(result).toBeNull();
  });
});

// ── S2 tests ──────────────────────────────────────────────────────────────────

describe('writeForceBypassPermissionsAvailable — S2 (kill switch)', () => {
  it('replaces kill-switch body with return!1', () => {
    const result = writeForceBypassPermissionsAvailable(allFragments);

    expect(result).not.toBeNull();
    expect(result).toContain('function ni(){return!1}');
    expect(result).not.toContain('tengu_disable_bypass_permissions_mode');
  });

  it('works with arbitrary minified function name in S2', () => {
    const input =
      s1Fragment +
      'function A$B(){let _=QO("tengu_disable_bypass_permissions_mode"),q=(P8()||{}).permissions?.disableBypassPermissionsMode==="disable";return _||q}' +
      s3Fragment;
    const result = writeForceBypassPermissionsAvailable(input);

    expect(result).not.toBeNull();
    expect(result).toContain('function A$B(){return!1}');
  });

  it('returns null when S2 pattern is absent', () => {
    const result = writeForceBypassPermissionsAvailable(
      s1Fragment + s3Fragment
    );

    expect(result).toBeNull();
  });
});

// ── S3 tests ──────────────────────────────────────────────────────────────────

describe('writeForceBypassPermissionsAvailable — S3 (disable function)', () => {
  it('replaces disable function body with identity return', () => {
    const result = writeForceBypassPermissionsAvailable(allFragments);

    expect(result).not.toBeNull();
    expect(result).toContain('function M1_(_){return _}');
    expect(result).not.toContain('isBypassPermissionsModeAvailable:!1');
  });

  it('works with arbitrary minified identifiers in S3', () => {
    const input =
      s1Fragment +
      s2Fragment +
      'function X$(Y$){let Z$=Y$;if(Y$.mode==="bypassPermissions")Z$=QA$(Y$,{type:"setMode",mode:"default",destination:"session"});return{...Z$,isBypassPermissionsModeAvailable:!1}}';
    const result = writeForceBypassPermissionsAvailable(input);

    expect(result).not.toBeNull();
    expect(result).toContain('function X$(Y$){return Y$}');
  });

  it('returns null when S3 pattern is absent', () => {
    const result = writeForceBypassPermissionsAvailable(
      s1Fragment + s2Fragment
    );

    expect(result).toBeNull();
  });
});

// ── Integration test ──────────────────────────────────────────────────────────

describe('writeForceBypassPermissionsAvailable — integration', () => {
  it('applies all three sub-patches in a single pass', () => {
    const prefix = 'var before=1;';
    const suffix = 'var after=2;';
    const result = writeForceBypassPermissionsAvailable(
      prefix + allFragments + suffix
    );

    expect(result).not.toBeNull();
    // S1 applied
    expect(result).toContain(',D=!0,');
    // S2 applied
    expect(result).toContain('function ni(){return!1}');
    // S3 applied
    expect(result).toContain('function M1_(_){return _}');
    // Surrounding code preserved
    expect(result!.startsWith(prefix)).toBe(true);
    expect(result!.endsWith(suffix)).toBe(true);
  });

  it('preserves code between the three patch sites', () => {
    const between1 = 'var mid1=42;';
    const between2 = 'var mid2=99;';
    const input = s1Fragment + between1 + s2Fragment + between2 + s3Fragment;
    const result = writeForceBypassPermissionsAvailable(input);

    expect(result).not.toBeNull();
    expect(result).toContain(between1);
    expect(result).toContain(between2);
  });
});
