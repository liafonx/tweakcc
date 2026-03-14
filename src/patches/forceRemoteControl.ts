// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patch 1: Override gQ() to return true unconditionally.
 *
 * Normally gQ() calls Zq("tengu_ccr_bridge", false) which returns false when the
 * user is not in OAuth mode (e.g. ANTHROPIC_AUTH_TOKEN is set). This makes the
 * Remote Control settings toggle invisible. Replacing the body with `{return true}`
 * unlocks the toggle as long as local OAuth creds exist (enforced downstream by blK()).
 */
export function writeForceRemoteControlEnabled(oldFile: string): string | null {
  const pattern = /\{return [$\w]+\("tengu_ccr_bridge",!1\)\}/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: forceRemoteControl: failed to find gQ() body {return <fn>("tengu_ccr_bridge",!1)}'
    );
    return null;
  }
  const idx = oldFile.indexOf(match[0]);
  const replacement = '{return true}';
  const newFile =
    oldFile.slice(0, idx) + replacement + oldFile.slice(idx + match[0].length);
  showDiff(oldFile, newFile, replacement, idx, idx + match[0].length);
  return newFile;
}

/**
 * Patch 2: Remove the Ql_() async feature-flag prerequisite guard in blK().
 *
 * Without this patch blK() bails out with "Remote Control is not enabled. Wait for
 * the feature flag rollout." before the bridge can start. Removing the guard lets
 * blK() proceed to its own credential check (D6()?.accessToken), which still enforces
 * that valid local OAuth creds must be present.
 */
export function writeBypassBridgeFeatureFlag(oldFile: string): string | null {
  const pattern =
    /if\(!await [$\w]+\(\)\)return"Remote Control is not enabled\. Wait for the feature flag rollout\.";/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: forceRemoteControl: failed to find Ql_() guard in blK()'
    );
    return null;
  }
  const idx = oldFile.indexOf(match[0]);
  const newFile = oldFile.slice(0, idx) + oldFile.slice(idx + match[0].length);
  showDiff(oldFile, newFile, '', idx, idx + match[0].length);
  return newFile;
}

/**
 * Patch 4: Remove the Ql_() async feature-flag guard in y6$() (initReplBridge).
 *
 * blK() preflight (Patch 2) only removes gate #1. The bridge initializer y6$() has its
 * own independent Ql_() check that silently returns null, logging
 * "[bridge:repl] Skipping: bridge not enabled". This prevents the UI from transitioning
 * past "connecting…". Removing this guard lets the bridge proceed to its legitimate
 * checks: version (ll_()), policy (allow_remote_control), OAuth token, and org UUID.
 */
export function writeBypassBridgeInitFeatureFlag(
  oldFile: string
): string | null {
  const pattern =
    /if\(!await [$\w]+\(\)\)return [$\w]+\("\[bridge:repl\] Skipping: bridge not enabled"\),[$\w]+\("tengu_bridge_repl_skipped",\{reason:"not_enabled"\}\),null;/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: forceRemoteControl: failed to find Ql_() guard in y6$() (initReplBridge)'
    );
    return null;
  }
  const idx = oldFile.indexOf(match[0]);
  const newFile = oldFile.slice(0, idx) + oldFile.slice(idx + match[0].length);
  showDiff(oldFile, newFile, '', idx, idx + match[0].length);
  return newFile;
}

/**
 * Patch 5: Remove the replBridgeExplicit gating in the status indicator component (U4$).
 *
 * U4$ gates on `replBridgeExplicit` for "active" and "connecting…" states:
 *   if(!O && A.label !== "Remote Control failed" && A.label !== "Remote Control reconnecting") return null;
 *
 * When remoteControlAtStartup auto-enables the bridge it sets replBridgeEnabled:true but
 * replBridgeExplicit:false, so the indicator stays hidden and the remote web UI sees no
 * active session. Removing this guard shows the indicator for all bridge states.
 */
export function writeBypassBridgeExplicitGating(
  oldFile: string
): string | null {
  const pattern =
    /if\(![$\w]+&&[$\w]+\.label!=="Remote Control failed"&&[$\w]+\.label!=="Remote Control reconnecting"\)return null;/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: forceRemoteControl: failed to find replBridgeExplicit gating in U4$()'
    );
    return null;
  }
  const idx = oldFile.indexOf(match[0]);
  const newFile = oldFile.slice(0, idx) + oldFile.slice(idx + match[0].length);
  showDiff(oldFile, newFile, '', idx, idx + match[0].length);
  return newFile;
}

/**
 * Patch 3 (optional): Flip the remoteControlAtStartup default from false → true.
 *
 * Only applied when forceRemoteControlAtStartup is enabled in config.
 * Anchored on the remoteControlAtStartup property with the surrounding void-0 guard.
 */
export function writeForceRemoteControlAtStartup(
  oldFile: string
): string | null {
  const pattern =
    /((?:let [$\w]+=)?[$\w]+\(\)\.remoteControlAtStartup;if\([$\w]+!==void 0\)return [$\w]+;return)!1(\})/;
  if (!pattern.test(oldFile)) {
    console.error(
      'patch: forceRemoteControl: failed to find remoteControlAtStartup default'
    );
    return null;
  }
  const newFile = oldFile.replace(pattern, '$1!0$2');
  showDiff(oldFile, newFile, '!0', 0, 0);
  return newFile;
}
