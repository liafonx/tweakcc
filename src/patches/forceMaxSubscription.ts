// Please see the note about writing patches in ./index

import { escapeForRegex as escRe } from './helpers';

/**
 * writeForceMaxSubscription — forces CC to treat an API-key user as a Max
 * subscriber across the entire app (model list, defaults, feature gates),
 * while preserving API-key authentication to the proxy.
 *
 * Designed for sub2api setups where the upstream IS a real Max subscription
 * but CC only sees an ANTHROPIC_API_KEY locally.
 *
 * Sub-patches:
 *   A1: S4() → "max"          [CRITICAL] Makes kV()=true, Opus default, Max gates
 *   A2: s8() → true           [CRITICAL] Forces subscription UI everywhere
 *   A3: fD() → true when s8() [CRITICAL] Opus defaults to 1M, no "Opus (1M context)"
 *   A4: Remove _Q() gate in Max model list [CRITICAL] Removes "Sonnet (1M context)"
 *   A5: Mb() opusplan 1M suffix [CRITICAL] Opus uses 1M in plan mode
 *   B1: qz() header guard     [CRITICAL] API-key still used for HTTP
 *   B2: Tb() apiKey/authToken [CRITICAL] API-key client options preserved
 *   B3: Tb() bearer injection [CRITICAL] ANTHROPIC_AUTH_TOKEN path preserved
 *   B4: OAuth beta header     [CRITICAL] oauth-2025 header not injected
 *   B5: auth conflict warning [CRITICAL] suppress false "Auth conflict" warning
 *   C1: Overload fallback     [CRITICAL] Retry logic preserved for API
 *   C2: x-should-retry hint   [CRITICAL] Retry hint preserved
 *   C3: 429 retry             [CRITICAL] 429 retry preserved
 *   D1: sendBatchWithRetry    [CRITICAL] Telemetry auth preserved
 *
 * Returns null if any CRITICAL sub-patch fails.
 */
export function writeForceMaxSubscription(oldFile: string): string | null {
  // ── Step 1: Extract version-specific function names from s8() body ───────
  // s8 body: function s8(){if(!WD())return!1;return gb(e8()?.scopes)}
  const namePattern =
    /function ([$\w]+)\(\)\{if\(!([$\w]+)\(\)\)return!1;return ([$\w]+)\(([$\w]+)\(\)\?\.scopes\)\}/;
  const nameMatch = oldFile.match(namePattern);
  if (!nameMatch) {
    console.error(
      'patch: forceMaxSubscription: failed to extract s8() function names — body pattern not found'
    );
    return null;
  }
  const [, s8Name, wdName, gbName, e8Name] = nameMatch;
  // Original predicate that s8() used to evaluate — used at auth-critical sites
  const origPred = `${wdName}()&&${gbName}(${e8Name}()?.scopes)`;

  const escS8 = escRe(s8Name);
  const escWd = escRe(wdName);
  const escGb = escRe(gbName);
  const escE8 = escRe(e8Name);

  let content = oldFile;

  // ── Group A: Override patches ─────────────────────────────────────────────

  // A1: S4() → "max" [CRITICAL]
  // The 4-guard function that reads subscriptionType from the OAuth profile.
  // Forcing it to "max" makes kV()=true, sets default model to Opus, and
  // activates all Max feature gates.
  const a1Pattern =
    /(function [$\w]+\(\)\{)if\([$\w]+\(\)\)return [$\w]+\(\);if\(![$\w]+\(\)\)return null;let [$\w]+=[$\w]+\(\);if\(![$\w]+\)return null;return [$\w]+\.subscriptionType\?\?null\}/;
  if (!a1Pattern.test(content)) {
    console.error(
      'patch: forceMaxSubscription: A1 CRITICAL — S4() subscriptionType pattern not found'
    );
    return null;
  }
  content = content.replace(a1Pattern, '$1return"max"}');

  // A2: s8() → true [CRITICAL]
  // Forces the subscription check to always return true. Auth-critical call
  // sites are protected in Group B using the original predicate built above.
  const a2Pattern = new RegExp(
    `function ${escS8}\\(\\)\\{if\\(!${escWd}\\(\\)\\)return!1;return ${escGb}\\(${escE8}\\(\\)\\?\\.scopes\\)\\}`
  );
  if (!a2Pattern.test(content)) {
    console.error(
      'patch: forceMaxSubscription: A2 CRITICAL — s8() body pattern not found'
    );
    return null;
  }
  content = content.replace(a2Pattern, `function ${s8Name}(){return!0}`);

  // A3: fD() → true when s8() [CRITICAL]
  // fD()=true causes: (1) Default model resolves to "Opus 4.6 with 1M context",
  // (2) !fD()=false → EF7 ("Opus (1M context)") not added to model list,
  // (3) bf7() stays false (cachedExtraUsageDisabledReason=undefined for Max accounts)
  //     → eF()=false, _Q()=false → SF7 ("Sonnet (1M context)") not added either.
  // Net result: model list matches real Max — Default + Sonnet + Haiku, no extra entries.
  //
  // 2.1.77-: function body checked a GrowthBook flag ("tengu_cobalt_compass").
  // 2.1.78+: flag removed; body is now a pure subscription check:
  //   function JD(){if(LQ()||BE()||x8()!=="firstParty")return!1;if(Q8()&&k4()===null)return!1;return!0}
  // Anchor: !=="firstParty" guard + null-subscription guard + bare return!0 (unique combo).
  // Capture group 2 = fD's function name, used by A5.
  const a3Pattern =
    /(function ([$\w]+)\(\)\{)(if\([$\w]+\(\)\|\|[$\w]+\(\)\|\|[$\w]+\(\)!=="firstParty"\)return!1;if\([$\w]+\(\)&&[$\w]+\(\)===null\)return!1;return!0\})/;
  let fdName: string | null = null;
  const a3Match = content.match(a3Pattern);
  if (a3Match) {
    fdName = a3Match[2];
    content = content.replace(a3Pattern, `$1if(${s8Name}())return!0;$3`);
  } else {
    console.error(
      'patch: forceMaxSubscription: A3 CRITICAL — fD() 1M-context guard pattern not found'
    );
    return null;
  }

  // A4: Remove SF7 ("Sonnet (1M context)") from Max model list [CRITICAL]
  // In the Max branch of zLK(), SF7 is pushed via a comma-expression:
  //   if(O.push(ALK), _Q()) O.push(SF7())
  // With sub2api proxying /api/oauth/claude_cli/client_data returning
  // cachedExtraUsageDisabledReason=null, bf7()=true → _Q()=true → SF7 pushed.
  // Real Max subscribers don't see this entry because their
  // cachedExtraUsageDisabledReason is undefined → bf7()=false → _Q()=false.
  // Fix: collapse the comma-expression to just the push, dropping SF7.
  // The non-Max branch uses a plain `if(_Q())` (no comma-expression), so
  // the pattern is unique to the Max branch.
  const a4Pattern =
    /if\(([$\w]+\.push\([$\w]+\)),[$\w]+\(\)\)[$\w]+\.push\([$\w]+\(\)\)/;
  if (a4Pattern.test(content)) {
    content = content.replace(a4Pattern, '$1');
  } else {
    console.error(
      'patch: forceMaxSubscription: A4 CRITICAL — SF7 comma-expression pattern not found'
    );
    return null;
  }

  // A5: Mb() opusplan 1M suffix [CRITICAL]
  // Mb() selects the per-turn model for plan/execution split. Its opusplan plan
  // branch returns bare S0() (Opus), while Gh() — the default resolver — appends
  // +(fD()?"[1m]":"") when fD()=true. This patch makes Mb() consistent with Gh()
  // so opusplan planning calls also use 1M context when forceMaxSubscription is active.
  // Guard: only applied if A3 matched and fdName was captured.
  if (fdName !== null) {
    const a5Pattern =
      /([$\w]+\(\)==="opusplan"&&[$\w]+==="plan"&&![$\w]+\)return )([$\w]+\(\))/;
    if (a5Pattern.test(content)) {
      content = content.replace(a5Pattern, `$1$2+(${fdName}()?"[1m]":"")`);
    } else {
      console.error(
        'patch: forceMaxSubscription: A5 CRITICAL — Mb() opusplan plan branch not found'
      );
      return null;
    }
  }

  // ── Group B: Critical auth protection ────────────────────────────────────
  // Each replaces s8() at an auth-critical call site with ORIG_PRED so the
  // site still behaves as if no subscription exists (correct for API-key users).

  // B1: qz() header selection [CRITICAL]
  // Without protection: s8()=true → qz() tries to fetch OAuth token → returns
  // {error:"No OAuth token available"} → all HTTP calls fail.
  const b1Pattern = new RegExp(
    `if\\(${escS8}\\(\\)\\)(\\{let [$\\w]+=${escE8}\\(\\);if\\(![$\\w]+\\?\\.accessToken\\)return\\{headers:\\{\\},error:"No OAuth token available"\\})`
  );
  if (!b1Pattern.test(content)) {
    console.error(
      'patch: forceMaxSubscription: B1 CRITICAL — qz() header selection pattern not found'
    );
    return null;
  }
  content = content.replace(b1Pattern, `if(${origPred})$1`);

  // B2: Tb() apiKey/authToken client options [CRITICAL]
  // Without protection: apiKey becomes null and authToken tries to use a
  // missing OAuth access token — breaking all Anthropic API calls.
  const b2Pattern = new RegExp(
    `apiKey:${escS8}\\(\\)\\?null:([^,]+),authToken:${escS8}\\(\\)\\?${escE8}\\(\\)\\?\\.accessToken:void 0`
  );
  if (!b2Pattern.test(content)) {
    console.error(
      'patch: forceMaxSubscription: B2 CRITICAL — apiKey/authToken pattern not found'
    );
    return null;
  }
  content = content.replace(
    b2Pattern,
    `apiKey:${origPred}?null:$1,authToken:${origPred}?${e8Name}()?.accessToken:void 0`
  );

  // B3: Tb() bearer header injection [CRITICAL]
  // Without protection: the ANTHROPIC_AUTH_TOKEN bearer path is skipped,
  // meaning the API key is not injected into inference request headers.
  const b3Pattern = new RegExp(
    `("\\[API:auth\\] OAuth token check complete"\\),!)${escS8}\\(\\)`
  );
  if (!b3Pattern.test(content)) {
    console.error(
      'patch: forceMaxSubscription: B3 CRITICAL — bearer header injection pattern not found'
    );
    return null;
  }
  content = content.replace(b3Pattern, `$1(${origPred})`);

  // B5: "internal-token" auth conflict warning [CRITICAL]
  // The warning notification's isActive calls s8()&&(source==="ANTHROPIC_AUTH_TOKEN"||...).
  // With s8()=true this fires for every API-key user. Restore the original predicate
  // so the warning only shows for genuine OAuth subscribers with a conflicting env var.
  const b5Pattern = new RegExp(
    `(let [$\\w]+=[$\\w]+\\(\\);return )${escS8}\\(\\)(&&\\([$\\w]+\\.source==="ANTHROPIC_AUTH_TOKEN"\\|\\|[$\\w]+\\.source==="apiKeyHelper"\\)\\})`
  );
  if (b5Pattern.test(content)) {
    content = content.replace(b5Pattern, `$1(${origPred})$2`);
  } else {
    console.error(
      'patch: forceMaxSubscription: B5 CRITICAL — internal-token warning isActive pattern not found'
    );
    return null;
  }

  // B4: OAuth beta header injection [CRITICAL]
  // Without protection: API-key inference requests receive the oauth-2025-04-20
  // beta header which is OAuth-only and may confuse the proxy.
  // Only apply if exactly one push pattern matches (avoid ambiguity).
  const b4Pattern = new RegExp(
    `if\\(${escS8}\\(\\)\\)([$\\w]+\\.push\\([$\\w]+\\))`
  );
  const b4Matches = [...content.matchAll(new RegExp(b4Pattern.source, 'g'))];
  if (b4Matches.length === 1) {
    content = content.replace(b4Pattern, `if(${origPred})$1`);
  } else if (b4Matches.length === 0) {
    console.error(
      'patch: forceMaxSubscription: B4 CRITICAL — oauth beta header push pattern not found'
    );
    return null;
  } else {
    console.error(
      `patch: forceMaxSubscription: B4 CRITICAL — ambiguous: ${b4Matches.length} push patterns found, skipping`
    );
    return null;
  }

  // ── Group C: Resilience protection ───────────────────────────────────────

  // C1: Overload fallback [CRITICAL]
  // Anchor: FALLBACK_FOR_ALL_PRIMARY_MODELS — restores API-key retry on 529s.
  const c1Pattern = new RegExp(
    `(FALLBACK_FOR_ALL_PRIMARY_MODELS\\|\\|!)${escS8}\\(\\)(&&[$\\w]+\\([$\\w]+\\.model\\))`
  );
  if (c1Pattern.test(content)) {
    content = content.replace(c1Pattern, `$1(${origPred})$2`);
  } else {
    console.error(
      'patch: forceMaxSubscription: C1 CRITICAL — overload fallback pattern not found'
    );
    return null;
  }

  // C2: Retry on x-should-retry header [CRITICAL]
  // CC 2.1.80 added parens + ||fallback: `==="true"&&(!s8()||LYT())`; make both forms match.
  const c2Pattern = new RegExp(
    `(==="true"&&\\(?!)${escS8}\\(\\)(\\|\\|[$\\w]+\\(\\)\\))?`
  );
  if (c2Pattern.test(content)) {
    content = content.replace(c2Pattern, `$1(${origPred})$2`);
  } else {
    console.error(
      'patch: forceMaxSubscription: C2 CRITICAL — x-should-retry pattern not found'
    );
    return null;
  }

  // C3: Retry on HTTP 429 [CRITICAL]
  const c3Pattern = new RegExp(`(===429\\)return!)${escS8}\\(\\)`);
  if (c3Pattern.test(content)) {
    content = content.replace(c3Pattern, `$1(${origPred})`);
  } else {
    console.error(
      'patch: forceMaxSubscription: C3 CRITICAL — 429-retry pattern not found'
    );
    return null;
  }

  // ── Group D: Telemetry ────────────────────────────────────────────────────

  // D1: sendBatchWithRetry auth selection [CRITICAL]
  // Anchor: expiresAt inside the OAuth token check block in sendBatchWithRetry.
  const d1Pattern = new RegExp(
    `(if\\(![$\\w]+&&)${escS8}\\(\\)` +
      `(\\)\\{let [$\\w]+=${escE8}\\(\\);if\\(![$\\w]+\\(\\)\\)[$\\w]+=!0;` +
      `else if\\([$\\w]+&&[$\\w]+\\([$\\w]+\\.expiresAt\\)\\)[$\\w]+=!0\\})`
  );
  if (d1Pattern.test(content)) {
    content = content.replace(d1Pattern, `$1(${origPred})$2`);
  } else {
    console.error(
      'patch: forceMaxSubscription: D1 CRITICAL — sendBatchWithRetry auth pattern not found'
    );
    return null;
  }

  return content;
}
