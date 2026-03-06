# AGENTS.md

**tweakcc** is a CLI tool that patches Claude Code's native binary at runtime —
injecting custom themes, model aliases, and diff-rendering fixes.
`CLAUDE.md` is a symlink to this file.

Guidelines for agents working in **liafonx/tweakcc** (fork of Piebald-AI/tweakcc).

**Working dir**: `/Users/liafo/Development/GitWorkspace/tweakcc`
**Config/data dir**: `/Users/liafo/.tweakcc/` (config.json, themes, system prompts)

## Fork Commits (must survive upstream rebases)

| Commit    | Status         | Description                                                                      |
| --------- | -------------- | -------------------------------------------------------------------------------- |
| `55b4453` | fork-permanent | feat: replace Rust diff renderer bypass with theme ID override                   |
| `0017699` | fork-local     | chore: re-add UNKNOWN\_\* fallback to fork main for local use (not for upstream) |
| `76c2122` | fork-feature   | feat: add suppress-update-notification patch                                     |
| `e8e6b1c` | fork-feature   | fix: update diffSyntaxThemeOverride and findTextComponent for CC 2.1.70          |
| `9059293` | fork-fix       | fix: partition-safe regex for diffSyntaxThemeOverride if-block                   |
| `a83e6ef` | fork-feature   | fix: update agentsMd and patchesAppliedIndication for CC 2.1.70                  |
| `d9b5a5a` | fork-feature   | fix: update themes patch for CC 2.1.70 React Compiler output                     |

Previously in upstream (PRs now merged): model customizations (#572), context-limit opt-in (#577).

Always rebase onto upstream — never merge: `git fetch upstream && git rebase upstream/main`

## Fork-Specific Patches

**`diff-syntax-theme-override`** — intercepts the theme ID before `J.render()` in the
diff component's `useMemo`. Non-builtin IDs → `"dark-ansi"` → bat `ansi` theme →
syntax highlighting preserved, no background fills. The `Math.max(1,Math.floor(...))`
expression uniquely anchors to `nI` (diff view); `aI` (file viewer) is left untouched.

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
    opusplan1m.ts                # Fork: model alias support
    modelSelector.ts             # Fork: CUSTOM_MODELS injection
  tests/                         # Vitest: config, migration, systemPromptSync, etc.
  ui/                            # Ink/React terminal UI (theme editor, color picker)
  config.ts                      # ~/.tweakcc/ config read/write
  types.ts                       # Theme (61 color keys), Settings, TweakccConfig
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

## Theme System

Config: `/Users/liafo/.tweakcc/config.json` → `.settings.themes[]` — **61 keys per theme**.

### Gist Sync

- Gist: https://gist.github.com/liafonx/5d7b8fa2baab5e870e1a9010f6470131
- Push update: `gh gist edit 5d7b8fa2baab5e870e1a9010f6470131 -f config.json /Users/liafo/.tweakcc/config.json`
- Pull latest: `gh gist view 5d7b8fa2baab5e870e1a9010f6470131 -r > /Users/liafo/.tweakcc/config.json`

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
