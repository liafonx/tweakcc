# AGENTS.md

**tweakcc** is a CLI tool that patches Claude Code's native binary at runtime —
injecting custom themes, model aliases, and diff-rendering fixes.
`CLAUDE.md` is a symlink to this file.

Guidelines for agents working in **liafonx/tweakcc** (fork of Piebald-AI/tweakcc).

**Working dir**: `/Users/liafo/Development/GitWorkspace/tweakcc`
**Config/data dir**: `/Users/liafo/.tweakcc/` (config.json, themes, system prompts)

## Fork Commits (must survive upstream rebases)

| Commit    | Status         | Description                                                                                   |
| --------- | -------------- | --------------------------------------------------------------------------------------------- |
| `55b4453` | fork-permanent | feat: replace Rust diff renderer bypass with theme ID override                                |
| `0017699` | fork-local     | chore: re-add UNKNOWN\_\* fallback to fork main for local use (not for upstream)              |
| `76c2122` | fork-feature   | feat: add suppress-update-notification patch                                                  |
| `e8e6b1c` | fork-feature   | fix: update diffSyntaxThemeOverride and findTextComponent for CC 2.1.70                       |
| `9059293` | fork-fix       | fix: partition-safe regex for diffSyntaxThemeOverride if-block                                |
| `a83e6ef` | fork-feature   | fix: update agentsMd and patchesAppliedIndication for CC 2.1.70                               |
| `d9b5a5a` | fork-feature   | fix: update themes patch for CC 2.1.70 React Compiler output                                  |
| `b18b449` | fork-feature   | fix: update diffSyntaxThemeOverride for CC 2.1.71 render extraction                           |
| `8896338` | fork-fix       | fix: update sessionMemory and userMessageDisplay patches for CC 2.1.72 compatibility          |
| `927730d` | fork-feature   | feat: add safe gist sync (--export-settings/--import-settings) and backup contamination guard |
| `2628139` | fork-feature   | feat: add remote control and context warning gap settings                                     |
| `3668c3a` | fork-fix       | fix: update for CC 2.1.75 — remove opusplan1m, rename contextWarning setting                  |

Previously in upstream (PRs now merged): model customizations (#572), context-limit opt-in (#577).

Always rebase onto upstream — never merge: `git fetch upstream && git rebase upstream/main`

## Fork-Specific Patches

**`diff-syntax-theme-override`** — intercepts the theme ID before the Rust ColorDiff
`.render(themeId, width, dim)` call. Non-builtin IDs → `"dark-ansi"` → bat `ansi` theme →
syntax highlighting preserved, no background fills. Three patterns across CC versions:

- Pre-2.1.70: `let W=Math.max(1,Math.floor($));return J.render(q,W,A)` (inline, direct return)
- 2.1.70: `let Z=Math.max(1,Math.floor(D)),N;if(R[6]!==J||...)N=J.render(h,Z,A)` (React Compiler cached)
- 2.1.71+: render extracted to `Ns$` wrapper function; anchor is factory-call + null-guard
  (backreference) + WeakMap cache-check + `new ClassVar(...).render(theme,width,dim)`

**`opusplan1m` fixes** — `patchDescriptionFunction` uses `fullMatch` to preserve the
original verbatim; `patchModelSelectorOptions` detects `wrapFn` dynamically via regex
on `fullMatch` instead of a capture group (fixes wrapper semantics across CC versions).

**`themes`** — injects custom themes into the theme picker (`objArr`), the theme
name-map (`obj`), and the color switch statement. CC 2.1.70 React Compiler changes:

- `objArr`: array now prefixed with `[...[],` (sentinel-guarded cache entry)
- `obj`: changed from `return{dark:"Dark",...}` to `{auto:"Auto...",dark:"Dark mode",...}[WT.value...]`;
  the patch preserves the `auto:` entry and emits the full `{auto:..., ...themes}` object.

**`agentsMd`** — falls back from CLAUDE.md to AGENTS.md/GEMINI.md/QWEN.md when the former
is absent. CC 2.1.70+ changed from `existsSync+statSync+isFile()` guard to a try/catch
on ENOENT/EISDIR; the patch handles both patterns. In the 2.1.70+ path the recursive
call is used directly (ENOENT is handled gracefully) instead of existsSync.

**`patchesAppliedIndication`** — injects tweakcc version + patches-applied list into
the startup header (Patches 1–3) and indicator view (Patches 4–5). CC 2.1.70's React
Compiler caches createElement calls into variables with sentinel checks, breaking the
paren-counting stack machine used by Patches 4–5; those two sub-patches are **non-fatal**
in CC 2.1.70 (the header patches still apply). Patch 2 uses a backreference regex to
match the cached `createElement(TEXT,null,VAR," ",createElement(TEXT,{dimColor:!0},"v",VER))`
form; Patch 3 anchors on `createElement(TEXT,{bold:!0},"Claude Code")` (not affected by
Patch 2's insertion).

**`forceRemoteControl`** — 5 sub-patches that unlock Remote Control for non-OAuth users:

- Patch 1: Override the feature-flag helper (anchored by `"tengu_ccr_bridge",!1`) to
  unconditionally `return true`, making the settings toggle visible.
- Patch 2: Remove the `if(!await Ql_())return"Remote Control is not enabled..."` guard
  in `blK()` (bridge preflight). Credential check (`D6()?.accessToken`) still enforces
  valid local OAuth creds.
- Patch 3 (optional): Flip `remoteControlAtStartup` default `!1` → `!0`, applied only
  when `forceRemoteControlAtStartup` is enabled in config.
- Patch 4: Remove the `Ql_()` guard in `y6$()` (`initReplBridge`) that logs
  `"[bridge:repl] Skipping: bridge not enabled"` and returns null.
- Patch 5: Remove the `replBridgeExplicit` gating in the status indicator (`U4$`) that
  hides the indicator when the bridge was auto-started (not user-explicit).
- Patches 2, 4, and 5 are best-effort (non-fatal if guard already absent).

**`contextWarningThreshold`** — suppresses the "Context low" warning by setting the
gap constant to 0 (warning would only fire at 100% usage). Anchored by the adjacent
`13000` constant in the var declaration block (`var ...,vZq=13000,hrR=20000,...`).
Enabled via `suppressContextWarning` boolean toggle in misc settings.

**`forceToolSearch`** — bypasses the `api.anthropic.com` domain check that gates Tool
Search, replacing `return["api.anthropic.com"].includes(host)}catch{return!1}` with
`return!0}catch{return!0}`. Enables Tool Search when using proxy or relay endpoints.

## Development Commands

```bash
npm run build        # typecheck + minify
npm test             # run all tests (also runs on commit via pre-commit hook)
npm run lint         # tsc --noEmit + eslint
node dist/index.mjs --apply        # apply patches to Claude Code
node dist/index.mjs --list-patches # list patch IDs and status
```

## Source Layout

```
src/
  index.ts                       # CLI entry (commander: --apply, --restore, --list-patches)
  patches/
    index.ts                     # Registry: PATCH_DEFINITIONS, patchImplementations, applyCustomization()
    helpers.ts                   # Shared utilities: findChalkVar, getReactVar, etc.
    themes.ts                    # Theme injection (incl. diff color overrides)
    diffSyntaxThemeOverride.ts   # Fork: Rust renderer theme ID swap
    modelSelector.ts             # Fork: CUSTOM_MODELS injection
    forceRemoteControl.ts        # Fork: unlock Remote Control for non-OAuth
    contextWarningThreshold.ts   # Fork: context warning gap override
    forceToolSearch.ts           # Fork: bypass domain check for Tool Search
  tests/                         # Vitest: config, migration, systemPromptSync, etc.
  ui/                            # Ink/React terminal UI (theme editor, color picker)
  config.ts                      # ~/.tweakcc/ config read/write
  defaultSettings.ts             # Default settings values and merging
  startup.ts                     # startupCheck: version detect, backup guard, contamination check
  types.ts                       # Theme (61 color keys), Settings, TweakccConfig
```

## New CC Version Update Checklist

When CC auto-updates or a new version is released, run this full sequence:

```bash
# 1. Upgrade CC (or use brew reinstall claude-code for a clean binary)
brew upgrade claude-code

# 2. Update the backup to the new binary
cp "$(ls -d /opt/homebrew/Caskroom/claude-code/*/claude | tail -1)" ~/.tweakcc/native-binary.backup

# 3. Rebuild the fork (always after a version bump)
cd /Users/liafo/Development/GitWorkspace/tweakcc && npm run build

# 4. Apply and check patch output — every patch must show ✓
node dist/index.mjs --apply
```

### Verify patches after apply

Check the apply output carefully:

- Every patch you care about must show `✓` — any `✗` or `failed` requires a fix
- `patchesAppliedIndication` PATCH 5 is permanently non-fatal (React Compiler since 2.1.70)
- "Could not find system prompt X" warnings are soft-fails; benign if you haven't customized that file
- "Themes" patch must appear and be `✓` — if missing, config reverted to defaults (recover from gist)

### Cache cleanup after a version bump

Delete the old version's prompt cache (keeps only current):

```bash
# Delete old version cache (replace OLD_VER with the previous version number)
rm ~/.tweakcc/prompt-data-cache/prompts-<OLD_VER>.json
```

Delete stale system prompt files whose `ccVersion` frontmatter no longer matches:

- If a prompt file shows "Could not find system prompt X" on --apply AND you haven't
  customized it, it has a stale regex. Delete it — tweakcc will re-sync it from the binary:

```bash
# Example: delete a stale skill prompt
rm ~/.tweakcc/system-prompts/skill-stuck-slash-command.md
# Then re-apply so tweakcc re-syncs the file from the new binary
node dist/index.mjs --apply
```

Note: tweakcc auto-recreates any file it can extract from the binary during sync.
The "Could not find" error persists even after deletion+re-apply for prompts whose
binary anchor regex doesn't match — this is benign if the file is unmodified.

### Config safety after update

After upgrading CC, verify themes weren't reverted:

```bash
cat ~/.tweakcc/config.json | python3 -c "import json,sys; c=json.load(sys.stdin); print(len(c['settings']['themes']), 'themes')"
# Expected: 19 (or however many you have). If it shows 7, restore from gist:
gh gist view 5d7b8fa2baab5e870e1a9010f6470131 -r -f config.json | node dist/index.mjs --import-settings -
node dist/index.mjs --apply
```

## Restore / Cache-Clean / Re-apply

Run this sequence whenever patches fail (binary auto-updated, backup stale, or
patterns changed after editing patches):

```bash
# 1. Reinstall Claude Code to get a known-clean binary
brew reinstall claude-code

# 2. Update the backup so tweakcc tracks the new binary
cp "$(ls -d /opt/homebrew/Caskroom/claude-code/*/claude | tail -1)" ~/.tweakcc/native-binary.backup

# 3. Rebuild the fork (skip if source unchanged)
cd /Users/liafo/Development/GitWorkspace/tweakcc && npm run build

# 4. Apply
node dist/index.mjs --apply
```

**`--apply` is safe to re-run directly** — `applyCustomization` internally calls
`restoreNativeBinaryFromBackup` before patching, so the live binary is always reset
to the backup before patterns are searched. You do NOT need a manual `--restore` first.

**When patches fail: check the backup first:**
If `--apply` fails with many pattern-not-found errors, the backup is likely contaminated
(contains patched content from a previous run or a CC auto-update race).

```bash
# Detect contaminated backup
grep -c 'tweakcc' ~/.tweakcc/native-binary.backup
# 0 = clean, >0 = contaminated → do the full reinstall sequence below
```

**When to use `--restore`:**
`node dist/index.mjs --restore` reverts the live binary to `~/.tweakcc/native-binary.backup`.
Useful to undo a patch without reinstalling, but only meaningful when the backup is clean.

**Signs the backup is stale** (need reinstall, not just --restore):

- `md5 /opt/homebrew/Caskroom/claude-code/*/claude ~/.tweakcc/native-binary.backup` → hashes differ
- Multiple unrelated patches fail simultaneously (patterns changed)
- File sizes differ between live binary and backup

tweakcc now auto-detects contaminated backups during startupCheck and skips re-backup.
If you see a "live binary is already patched" warning, the ccVersion was stale — use
`--import-settings` for gist pulls instead of overwriting config.json directly.

### Config Safety — Gist Sync

`config.json` contains both user preferences (`settings`) and machine-local state
(`ccVersion`, `changesApplied`, `ccInstallationPath`). **Never overwrite `config.json`
directly from a gist** — the stale `ccVersion` will cause `startupCheck` to re-backup
the already-patched live binary, corrupting the backup.

Use the safe sync commands instead:

- `tweakcc --export-settings` — outputs only the `settings` portion (no machine state)
- `tweakcc --import-settings <file|->` — **full replacement** of `cfg.settings`; preserves
  machine-local state (`ccVersion` etc.) but overwrites every settings field.
  **Never pipe partial JSON** (e.g. `echo '{"misc":{...}}'`) — it replaces the entire
  settings object with only that fragment, wiping everything else. Use `jq` for individual
  field edits instead (see below).

The gist file (`config.json`) stores the full `TweakccConfig` shape (with a `settings` key);
`--import-settings` detects this and extracts `.settings` automatically.

**To set a single field after a gist pull**, edit `~/.tweakcc/config.json` directly with jq:

```bash
jq '.settings.misc.suppressContextWarning = true' ~/.tweakcc/config.json > /tmp/cfg.json \
  && mv /tmp/cfg.json ~/.tweakcc/config.json
```

**To recover lost settings from gist git history:**

```bash
git clone https://gist.github.com/5d7b8fa2baab5e870e1a9010f6470131.git /tmp/gist-tweakcc
git -C /tmp/gist-tweakcc log --oneline          # find the right commit
git -C /tmp/gist-tweakcc show <sha>:config.json | jq '.settings.<field>'
```

Defense-in-depth: `startupCheck` now detects if the live binary is already patched
before re-backing up. If contamination is detected, it skips re-backup and warns.

## Theme System

Config: `/Users/liafo/.tweakcc/config.json` → `.settings.themes[]` — **61 keys per theme**.

### Gist Sync

- Gist: https://gist.github.com/liafonx/5d7b8fa2baab5e870e1a9010f6470131
- Push settings to gist (settings only, no machine-local state):
  `node dist/index.mjs --export-settings | gh gist edit 5d7b8fa2baab5e870e1a9010f6470131 -f config.json`
- Pull settings from gist (full replacement of settings, preserves local ccVersion/ccInstallationPath):
  `gh gist view 5d7b8fa2baab5e870e1a9010f6470131 -r -f config.json | node dist/index.mjs --import-settings -`
- After pulling, set individual fields with jq rather than a second `--import-settings` call

### Theme IDs In Scope

Built-ins: `dark`, `light`, `light-ansi`, `dark-ansi`, `light-daltonized`, `dark-daltonized`, `monochrome`

Custom: `sample1-coastal-harvest`, `sample2-solar-current`, `sample3-deep-space-saffron`,
`sample4-aurora-violet-frost`, `set-a1-neon-tide`, `set-a2-desert-signal`, `set-a3-coral-circuit`,
`set-a4-emerald-orbit`, `set-a5-lime-current`, `set-a6-amethyst-ember`, `set-a7-blueforge-amber`,
`set-a8-copper-nocturne`, `set-b1-indigo-bloom` … `set-b8-frost-gilt`

### Hard Invariants

1. **Diff colours — `ansi:*` only, never `rgb()`** — two rendering paths, both must be correct:
   - Primary path: `diff-syntax-theme-override` patch (see Fork-Specific Patches above)
   - Fallback path: JS renderer uses theme's diff values; `themes.ts` patch overrides them
   - `rgb()` → background fills on every diff line; `ansi:*` → foreground-only (correct)
   - Required values (binary + config.json):
     - `diffAdded = ansi:green`, `diffAddedDimmed = ansi:green`, `diffAddedWordDimmed = ansi:green`
     - `diffRemoved = ansi:red`, `diffRemovedDimmed = ansi:red`, `diffRemovedWordDimmed = ansi:red`
     - `diffAddedWord = ansi:greenBright`
     - `diffRemovedWord = ansi:redBright`
2. `clawd_body = claude`
3. `permission != planMode`, `permission != claude`, `permission != claudeShimmer`
4. `claude` and `claudeShimmer` visually distinct per theme
5. Keep all existing theme IDs unless user explicitly requests removal; keep all 61 keys per theme

### Color Design Rules

1. **Dark-background first**: mid/high lightness for accents (no near-black that vanishes)
2. **Saturation**: moderate (dark-ansi baseline), not neon and not flat
3. **Identity**: each theme keeps its own palette; `claude`/`claudeShimmer` differ from each other and from other roles
4. **Semantic roles**: `claude`/`claudeShimmer` = assistant pair; `permission` ≠ `planMode` ≠ `claude`; `success`/`warning`/`error` = green/amber/red

### Validation

Run after every color edit:

```bash
# 1) key count
jq -r '.settings.themes[] | [.id, (.colors|keys|length)] | @tsv' /Users/liafo/.tweakcc/config.json

# 2) diff indicators fixed (must be ansi:*, not rgb())
jq -r '.settings.themes[] | [.id, .colors.diffAdded, .colors.diffRemoved, .colors.diffAddedWord, .colors.diffRemovedWord] | @tsv' /Users/liafo/.tweakcc/config.json

# 3) permission linkage + separation
jq -r '.settings.themes[] | [.id, (.colors.permission==.colors.suggestion), (.colors.permission==.colors.remember), (.colors.permission==.colors.rate_limit_fill), (.colors.permission==.colors.planMode), (.colors.permission==.colors.claude), (.colors.permission==.colors.claudeShimmer)] | @tsv' /Users/liafo/.tweakcc/config.json

# 4) per-theme assistant pair
jq -r '.settings.themes[] | [.id, .colors.claude, .colors.claudeShimmer] | @tsv' /Users/liafo/.tweakcc/config.json
```

### Handoff Requirements

When handing off, always report:

1. Which theme IDs changed
2. Whether all hard invariants passed
3. Any manual compromises (if a palette could not satisfy all constraints)

## Writing Patches

- **Identifiers**: use `[$\w]+` not `\w+` (`$` is valid in minified JS identifiers)
- **Anchors**: use `,` `;` `{` `}` at pattern start, never `\b` (V8 perf + `$` mismatch)
- **New patch**: create `src/patches/myPatch.ts` → add to `PATCH_DEFINITIONS` and
  `patchImplementations` in `index.ts` → import at top of `index.ts`

### Diff Render Sites

Two `J.render()` call sites exist in the CC binary (identifiers change per release):

- **Diff view**: anchored by `Math.max(1,Math.floor(...))` before `J.render()` — this is the patched site
- **File viewer**: a plain `return J.render(q,$,B)` — leave untouched

## Code Style

Prettier: 80 chars, single quotes, 2 spaces, semicolons. Section dividers: `// ======`.
Strict TS: avoid `any`, use `unknown`. Test files: `src/tests/*.test.ts`, `src/patches/*.test.ts`.
Every patch needs a success case + null-return case test.
