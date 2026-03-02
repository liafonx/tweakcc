# AGENTS.md

Guidelines for agents working in **liafonx/tweakcc** (fork of Piebald-AI/tweakcc).

**Working dir**: `/Users/liafo/Development/GitWorkspace/tweakcc`
**Config/data dir**: `/Users/liafo/.tweakcc/` (config.json, themes, system prompts)

## Fork Commits (must survive upstream rebases)

| Commit    | Description                                                             |
| --------- | ----------------------------------------------------------------------- |
| `d6a3196` | fix: resolve plan-mode crash and make model customizations configurable |
| `a114cca` | fix: preserve wrapper semantics in opusplan1m selector injection        |
| `cfee0d4` | feat: replace Rust diff renderer bypass with theme ID override          |

Always rebase onto upstream — never merge: `git fetch upstream && git rebase upstream/main`

## Fork-Specific Patches

**`diff-syntax-theme-override`** — intercepts the theme ID before `J.render()` in the
diff component's `useMemo`. Non-builtin IDs → `"dark-ansi"` → bat `ansi` theme →
syntax highlighting preserved, no background fills. The `Math.max(1,Math.floor(...))`
expression uniquely anchors to `nI` (diff view); `aI` (file viewer) is left untouched.

**`opusplan1m` fixes** — `patchDescriptionFunction` uses `fullMatch` to preserve the
original verbatim; `patchModelSelectorOptions` detects `wrapFn` dynamically via regex
on `fullMatch` instead of a capture group (fixes wrapper semantics across CC versions).

## Development Commands

```bash
npm run build        # typecheck + minify
npm test             # run all tests (also runs on commit via pre-commit hook)
npm run lint         # tsc --noEmit + eslint
node dist/index.mjs --apply        # apply patches to Claude Code
node dist/index.mjs --list-patches # list patch IDs and status
```

## Theme System

Config: `/Users/liafo/.tweakcc/config.json` → `.settings.themes[]` — **61 keys per theme**.

Custom theme IDs: `sample1-coastal-harvest`, `sample2-solar-current`,
`set-b1-indigo-bloom` … `set-b8-frost-gilt` (plus the 7 upstream built-ins).

### Hard Invariants

1. **Diff colours — `ansi:*` only, never `rgb()`** (rgb → solid background fills):
   `diffAdded/Dimmed = ansi:green`, `diffRemoved/Dimmed = ansi:red`,
   `diffAddedWord = ansi:greenBright`, `diffRemovedWord = ansi:redBright`,
   `diffAddedWordDimmed = ansi:green`, `diffRemovedWordDimmed = ansi:red`
2. `clawd_body = claude`
3. `permission != planMode`, `permission != claude`, `permission != claudeShimmer`
4. `claude` and `claudeShimmer` visually distinct per theme

### Validation

```bash
jq -r '.settings.themes[] | [.id, (.colors|keys|length)] | @tsv' /Users/liafo/.tweakcc/config.json
jq -r '.settings.themes[] | [.id, .colors.diffAdded, .colors.diffRemoved] | @tsv' /Users/liafo/.tweakcc/config.json
```

## Writing Patches

- **Identifiers**: use `[$\w]+` not `\w+` (`$` is valid in minified JS identifiers)
- **Anchors**: use `,` `;` `{` `}` at pattern start, never `\b` (V8 perf + `$` mismatch)
- **New patch**: create `src/patches/myPatch.ts` → add to `PATCH_DEFINITIONS` and
  `patchImplementations` in `index.ts` → import at top of `index.ts`

### Diff Render Sites

| Component        | Fn      | Pattern                                                  | Fallback                |
| ---------------- | ------- | -------------------------------------------------------- | ----------------------- |
| `nI` diff view   | `hkB()` | `let W=Math.max(1,Math.floor($));return J.render(q,W,A)` | `qkB`                   |
| `aI` file viewer | `EkB()` | `return J.render(q,$,B)`                                 | `IkB` — leave untouched |

## Code Style

Prettier: 80 chars, single quotes, 2 spaces, semicolons. Section dividers: `// ======`.
Strict TS: avoid `any`, use `unknown`. Test files: `src/tests/*.test.ts`, `src/patches/*.test.ts`.
Every patch needs a success case + null-return case test.
