import { describe, expect, it } from 'vitest';
import {
  writeBypassBridgeExplicitGating,
  writeBypassBridgeFeatureFlag,
  writeBypassBridgeInitFeatureFlag,
  writeForceRemoteControlAtStartup,
  writeForceRemoteControlEnabled,
} from './forceRemoteControl';

// ======================================================================
// writeForceRemoteControlEnabled (Patch 1)
// ======================================================================

describe('writeForceRemoteControlEnabled', () => {
  const makeContent = () =>
    `var gQ=function gQ(){return Zq("tengu_ccr_bridge",!1)}; rest of code`;

  it('replaces gQ body with {return true}', () => {
    const result = writeForceRemoteControlEnabled(makeContent());
    expect(result).not.toBeNull();
    expect(result).toContain('{return true}');
    expect(result).not.toContain('Zq("tengu_ccr_bridge"');
  });

  it('returns null when pattern is absent', () => {
    const result = writeForceRemoteControlEnabled(
      'function gQ(){return someOtherCall()}'
    );
    expect(result).toBeNull();
  });
});

// ======================================================================
// writeBypassBridgeFeatureFlag (Patch 2)
// ======================================================================

describe('writeBypassBridgeFeatureFlag', () => {
  const makeContent = () =>
    `async function blK(){if(!await Ql_())return"Remote Control is not enabled. Wait for the feature flag rollout.";if(!D6()?.accessToken)return oh_;}`;

  it('removes the Ql_() guard statement', () => {
    const result = writeBypassBridgeFeatureFlag(makeContent());
    expect(result).not.toBeNull();
    expect(result).not.toContain(
      'Remote Control is not enabled. Wait for the feature flag rollout.'
    );
    // Subsequent credential check still present
    expect(result).toContain('D6()?.accessToken');
  });

  it('handles arbitrary minified identifier for Ql_()', () => {
    const content =
      `async function blK(){` +
      `if(!await XY$z())return"Remote Control is not enabled. Wait for the feature flag rollout.";` +
      `if(!D6()?.accessToken)return oh_;}`;
    const result = writeBypassBridgeFeatureFlag(content);
    expect(result).not.toBeNull();
    expect(result).not.toContain('Remote Control is not enabled');
  });

  it('returns null when pattern is absent', () => {
    const result = writeBypassBridgeFeatureFlag(
      'async function blK(){if(!D6()?.accessToken)return oh_;}'
    );
    expect(result).toBeNull();
  });
});

// ======================================================================
// writeBypassBridgeInitFeatureFlag (Patch 4)
// ======================================================================

describe('writeBypassBridgeInitFeatureFlag', () => {
  const makeContent = () =>
    `async function y6$(){` +
    `if(!await Ql_())return v("[bridge:repl] Skipping: bridge not enabled"),Q("tengu_bridge_repl_skipped",{reason:"not_enabled"}),null;` +
    `if(!ll_())return null;` +
    `if(!tV())return null;}`;

  it('removes the Ql_() guard in initReplBridge', () => {
    const result = writeBypassBridgeInitFeatureFlag(makeContent());
    expect(result).not.toBeNull();
    expect(result).not.toContain('[bridge:repl] Skipping: bridge not enabled');
    expect(result).not.toContain('tengu_bridge_repl_skipped');
  });

  it('preserves subsequent legitimate checks', () => {
    const result = writeBypassBridgeInitFeatureFlag(makeContent());
    expect(result).not.toBeNull();
    expect(result).toContain('ll_()');
    expect(result).toContain('tV()');
  });

  it('handles arbitrary minified identifiers', () => {
    const content =
      `async function y6$(){` +
      `if(!await XY$z())return AB$c("[bridge:repl] Skipping: bridge not enabled"),DE$f("tengu_bridge_repl_skipped",{reason:"not_enabled"}),null;` +
      `if(!ll_())return null;}`;
    const result = writeBypassBridgeInitFeatureFlag(content);
    expect(result).not.toBeNull();
    expect(result).not.toContain('[bridge:repl] Skipping: bridge not enabled');
  });

  it('returns null when pattern is absent', () => {
    const result = writeBypassBridgeInitFeatureFlag(
      'async function y6$(){if(!ll_())return null;}'
    );
    expect(result).toBeNull();
  });
});

// ======================================================================
// writeBypassBridgeExplicitGating (Patch 5)
// ======================================================================

describe('writeBypassBridgeExplicitGating', () => {
  const makeContent = () =>
    `let O=jT(j=>j.replBridgeExplicit);` +
    `if(!gQ()||!T)return null;` +
    `let A=TuT({error:$,connected:q,sessionActive:R,reconnecting:K});` +
    `if(!O&&A.label!=="Remote Control failed"&&A.label!=="Remote Control reconnecting")return null;` +
    `return createElement(StatusBar,{label:A.label});`;

  it('removes the replBridgeExplicit gating statement', () => {
    const result = writeBypassBridgeExplicitGating(makeContent());
    expect(result).not.toBeNull();
    expect(result).not.toContain('Remote Control failed');
    expect(result).not.toContain('Remote Control reconnecting');
    expect(result).not.toContain('if(!O&&');
  });

  it('preserves surrounding TuT() call and createElement return', () => {
    const result = writeBypassBridgeExplicitGating(makeContent());
    expect(result).not.toBeNull();
    expect(result).toContain('TuT({error:$');
    expect(result).toContain('createElement(StatusBar');
  });

  it('handles arbitrary minified variable names', () => {
    const content =
      `let X$=jT(j=>j.replBridgeExplicit);` +
      `let Y$z=TuT({error:$,connected:q});` +
      `if(!X$&&Y$z.label!=="Remote Control failed"&&Y$z.label!=="Remote Control reconnecting")return null;` +
      `return createElement(StatusBar,{label:Y$z.label});`;
    const result = writeBypassBridgeExplicitGating(content);
    expect(result).not.toBeNull();
    expect(result).not.toContain('Remote Control failed');
    expect(result).toContain('createElement(StatusBar');
  });

  it('returns null when pattern is absent', () => {
    const result = writeBypassBridgeExplicitGating(
      'let A=TuT({error:$});return createElement(StatusBar,{label:A.label});'
    );
    expect(result).toBeNull();
  });
});

// ======================================================================
// writeForceRemoteControlAtStartup (Patch 3)
// ======================================================================

describe('writeForceRemoteControlAtStartup', () => {
  const makeContent = () =>
    `var _=fT().remoteControlAtStartup;if(_!==void 0)return _;return!1}`;

  it('flips the !1 default to !0', () => {
    const result = writeForceRemoteControlAtStartup(makeContent());
    expect(result).not.toBeNull();
    expect(result).toContain('return!0}');
    expect(result).not.toContain('return!1}');
  });

  it('preserves the surrounding void-0 guard', () => {
    const result = writeForceRemoteControlAtStartup(makeContent());
    expect(result).not.toBeNull();
    expect(result).toContain('!==void 0)return _');
  });

  it('matches the CC 2.1.76 let-prefixed accessor form', () => {
    const result = writeForceRemoteControlAtStartup(
      `let _=DT().remoteControlAtStartup;if(_!==void 0)return _;return!1}`
    );
    expect(result).not.toBeNull();
    expect(result).toContain('let _=DT().remoteControlAtStartup');
    expect(result).toContain('return!0}');
  });

  it('returns null when pattern is absent', () => {
    const result = writeForceRemoteControlAtStartup(
      'var x=fT().remoteControlAtStartup;return!1'
    );
    expect(result).toBeNull();
  });
});
