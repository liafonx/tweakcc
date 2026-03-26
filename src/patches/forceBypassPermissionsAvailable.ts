// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Forces bypassPermissions mode to always appear in the Shift+Tab cycle
 * (default → acceptEdits → plan → bypassPermissions → default), without
 * requiring --dangerously-skip-permissions or --allow-dangerously-skip-permissions
 * CLI flags.
 *
 * Three code sites control availability:
 *
 * S1 – Init flag: sets isBypassPermissionsModeAvailable at startup.
 *   CC 2.1.81:
 *   ```diff
 *   -,D=(K==="bypassPermissions"||R)&&!w&&!Y,
 *   +,D=!0,
 *   ```
 *
 * S2 – Kill switch ni(): sync guard checked on every mode change.
 *   CC 2.1.81:
 *   ```diff
 *   -function ni(){let _=QO("tengu_disable_bypass_permissions_mode"),q=(P8()||{}).permissions?.disableBypassPermissionsMode==="disable";return _||q}
 *   +function ni(){return!1}
 *   ```
 *
 * S3 – Disable function M1_(): called by async Statsig check to force-clear.
 *   CC 2.1.81:
 *   ```diff
 *   -function M1_(_){let T=_;if(_.mode==="bypassPermissions")T=QA(_,{type:"setMode",mode:"default",destination:"session"});return{...T,isBypassPermissionsModeAvailable:!1}}
 *   +function M1_(_){return _}
 *   ```
 *
 * Note: itq() (process-exit on Statsig disable) only fires when the session
 * starts in bypass mode. Users cycle into it via Shift+Tab, so itq() is never
 * called — no patch needed there.
 */
export function writeForceBypassPermissionsAvailable(
  oldFile: string
): string | null {
  let content = oldFile;

  // ── S1: Force init flag to true ──────────────────────────────────────────
  // Anchored by "bypassPermissions" string literal + boolean conjunction form.
  // The comma before and after act as fast-anchor boundary characters.
  const s1Pattern =
    /,([$\w]+)=\(([$\w]+)==="bypassPermissions"\|\|[$\w]+\)&&![$\w]+&&![$\w]+,/;
  const s1Match = content.match(s1Pattern);
  if (!s1Match || s1Match.index === undefined) {
    console.error(
      'patch: forceBypassPermissionsAvailable: S1 CRITICAL — init flag pattern not found'
    );
    return null;
  }
  {
    const replacement = `,${s1Match[1]}=!0,`;
    const start = s1Match.index;
    const end = start + s1Match[0].length;
    const newContent =
      content.slice(0, start) + replacement + content.slice(end);
    showDiff(content, newContent, replacement, start, end);
    content = newContent;
  }

  // ── S2: Neutralize the kill-switch function ───────────────────────────────
  // Anchored by the unique "tengu_disable_bypass_permissions_mode" string literal.
  // Captures the opening brace in group 1 to preserve the function signature.
  const s2Pattern =
    /(function [$\w]+\(\)\{)let [$\w]+=[$\w]+\("tengu_disable_bypass_permissions_mode"\),[$\w]+=\([$\w]+\(\)\|\|\{\}\)\.permissions\?\.disableBypassPermissionsMode==="disable";return [$\w]+\|\|[$\w]+\}/;
  const s2Match = content.match(s2Pattern);
  if (!s2Match || s2Match.index === undefined) {
    console.error(
      'patch: forceBypassPermissionsAvailable: S2 CRITICAL — kill-switch function pattern not found'
    );
    return null;
  }
  {
    const replacement = `${s2Match[1]}return!1}`;
    const start = s2Match.index;
    const end = start + s2Match[0].length;
    const newContent =
      content.slice(0, start) + replacement + content.slice(end);
    showDiff(content, newContent, replacement, start, end);
    content = newContent;
  }

  // ── S3: Make the async-disable function a no-op identity ─────────────────
  // Anchored by "bypassPermissions" + "setMode" + isBypassPermissionsModeAvailable:!1
  // together they are unique. The function becomes: return the input unchanged.
  const s3Pattern =
    /function ([$\w]+)\(([$\w]+)\)\{let [$\w]+=[$\w]+;if\([$\w]+\.mode==="bypassPermissions"\)[$\w]+=[$\w]+\([$\w]+,\{type:"setMode",mode:"default",destination:"session"\}\);return\{\.\.\.[$\w]+,isBypassPermissionsModeAvailable:!1\}\}/;
  const s3Match = content.match(s3Pattern);
  if (!s3Match || s3Match.index === undefined) {
    console.error(
      'patch: forceBypassPermissionsAvailable: S3 CRITICAL — disable function pattern not found'
    );
    return null;
  }
  {
    const replacement = `function ${s3Match[1]}(${s3Match[2]}){return ${s3Match[2]}}`;
    const start = s3Match.index;
    const end = start + s3Match[0].length;
    const newContent =
      content.slice(0, start) + replacement + content.slice(end);
    showDiff(content, newContent, replacement, start, end);
    content = newContent;
  }

  return content;
}
