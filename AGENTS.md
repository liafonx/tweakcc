# AGENTS.md

This document provides guidelines for agentic coding assistants working in this
repository. It targets **liafonx/tweakcc** — a personal fork of
[Piebald-AI/tweakcc](https://github.com/Piebald-AI/tweakcc) — so it covers both
upstream dev conventions and fork-specific patches, themes, and invariants.

---

## Fork Context

**Upstream**: `Piebald-AI/tweakcc` (`remotes/upstream/main`)
**Fork**: `liafonx/tweakcc` (`remotes/origin/main`)
**Working directory**: `/Users/liafo/Development/GitWorkspace/tweakcc`
**Config/data directory**: `/Users/liafo/.tweakcc/` (config.json, themes, system prompts)

### Commits Diverging from Upstream (fork-only, on `origin/main`)

| Commit    | Description                                                             |
| --------- | ----------------------------------------------------------------------- |
| `d6a3196` | fix: resolve plan-mode crash and make model customizations configurable |
| `a114cca` | fix: preserve wrapper semantics in opusplan1m selector injection        |
| `cfee0d4` | feat: replace Rust diff renderer bypass with theme ID override          |

These commits must be preserved on `main` and must survive any upstream sync.
When pulling from upstream (`git fetch upstream && git rebase upstream/main`),
these three commits should be rebased on top.

### Fork-Specific Patches

The following patches exist **only in this fork** (not upstream):

#### `diff-syntax-theme-override` (`src/patches/diffSyntaxThemeOverride.ts`)

Replaces the old two-patch approach (`disableRustDiffRenderer` + `diffForegroundOnly`).
Instead of bypassing the Rust renderer, intercepts the theme ID arg in the diff
component's `useMemo` before `J.render(themeId, width, dim)`. For any non-builtin
theme ID, substitutes `"dark-ansi"` → Rust/bat uses the `ansi` bat theme →
syntax highlighting preserved, foreground-only `+`/`-` colours, no background fills.

#### `opusplan1m` fixes (`a114cca`, `d6a3196`)

- `patchDescriptionFunction`: whitespace-tolerant pattern, uses `fullMatch` to
  preserve the original match verbatim instead of hardcoding the string
- `patchModelSelectorOptions`: dropped the capture-group approach for wrapFn;
  now detects it dynamically via regex on `fullMatch` (fixes wrapper semantics
  across CC versions)
- `enableModelCustomizations`: uses `?? true` (not `!== false`) for clarity

---

## Development Commands

```bash
# Build
npm run build        # Production build (typecheck + minify)
npm run build:dev    # Development build (no minification)
npm run watch        # Watch mode for iterative development

# Testing
npm test             # Run all tests once
npm run test:dev     # Run tests in watch mode
npx vitest run <test-file>      # Run single test file
npm run test -- <pattern>       # Run tests matching pattern

# Linting & Formatting
npm run lint         # Typecheck + ESLint
npm run format       # Format code with Prettier

# Run CLI
node dist/index.mjs  # Run built CLI
node dist/index.mjs --apply     # Apply patches to Claude Code
node dist/index.mjs --list-patches  # List all patch IDs and status
```

---

## Theme System

Theme configuration lives in `/Users/liafo/.tweakcc/config.json` at
`.settings.themes[]`. Agents editing themes must read and write that file.

### Theme IDs in Scope

Built-in (upstream): `dark`, `light`, `light-ansi`, `dark-ansi`,
`light-daltonized`, `dark-daltonized`, `monochrome`

Fork custom themes: `sample1-coastal-harvest`, `sample2-solar-current`,
`set-b1-indigo-bloom`, `set-b2-festival-pulse`, `set-b3-ocean-ember`,
`set-b4-arctic-blaze`, `set-b5-forest-ember`, `set-b6-spectrum-flow`,
`set-b7-terra-dusk`, `set-b8-frost-gilt`

**Per-theme key count must stay: `61`**

### Hard Invariants (Must Always Pass)

**1. Diff colours for custom themes — NO background fills**

The `diff-syntax-theme-override` patch forces the Rust/bat renderer to use
the `ansi` bat theme for all non-builtin IDs. The JS renderer fallback uses the
theme's `diffAdded`/`diffRemoved` values injected by `themes.ts`. Keep these as
`ansi:*` — never `rgb()`:

| Key                     | Required value     |
| ----------------------- | ------------------ |
| `diffAdded`             | `ansi:green`       |
| `diffRemoved`           | `ansi:red`         |
| `diffAddedDimmed`       | `ansi:green`       |
| `diffRemovedDimmed`     | `ansi:red`         |
| `diffAddedWord`         | `ansi:greenBright` |
| `diffRemovedWord`       | `ansi:redBright`   |
| `diffAddedWordDimmed`   | `ansi:green`       |
| `diffRemovedWordDimmed` | `ansi:red`         |

`rgb()` values → heavy background fills on every diff line. Do not use.

**2. Assistant linkage**: `clawd_body = claude`

**3. Required separation**:

- `permission != planMode`
- `permission != claude`
- `permission != claudeShimmer`
- `claude` and `claudeShimmer` must be visually distinct in each theme

**4. Theme integrity**: keep all existing theme IDs and all 61 keys per theme
unless the user explicitly requests removal.

### Color Design Rules

- Dark-background first: avoid near-black accents that disappear on dark UI
- Saturation discipline: avoid fully neon or over-desaturated values; prefer
  moderate saturation with clear role contrast (use `dark-ansi` feel as baseline)
- Each theme keeps its own palette personality — do not normalize to one look
- `claude`/`claudeShimmer`: assistant identity pair, must differ from each other
- `permission`: action/approval accent, distinct hue from `planMode`
- `success`, `warning`, `error`: preserve green/amber/red semantics

### Theme Validation Checklist

```bash
# 1) key count — must be 61 for every theme
jq -r '.settings.themes[] | [.id, (.colors|keys|length)] | @tsv' /Users/liafo/.tweakcc/config.json

# 2) diff indicators must be ansi:* not rgb()
jq -r '.settings.themes[] | [.id, .colors.diffAdded, .colors.diffRemoved, .colors.diffAddedWord, .colors.diffRemovedWord] | @tsv' /Users/liafo/.tweakcc/config.json

# 3) permission separation
jq -r '.settings.themes[] | [.id, (.colors.permission==.colors.planMode), (.colors.permission==.colors.claude), (.colors.permission==.colors.claudeShimmer)] | @tsv' /Users/liafo/.tweakcc/config.json

# 4) assistant pair
jq -r '.settings.themes[] | [.id, .colors.claude, .colors.claudeShimmer] | @tsv' /Users/liafo/.tweakcc/config.json
```

---

## Code Style

### Formatting

- **Prettier**: 80 char width, single quotes, 2 spaces, semicolons required
- **Section dividers**: Use `// ======` lines for major code sections

### Imports

```typescript
import fs from 'node:fs/promises'; // Node.js built-ins (node: prefix)
import path from 'node:path';
import chalk from 'chalk'; // Third-party
import { getConfig } from '../config'; // Internal (relative paths)
```

### TypeScript

- **Strict mode** enabled in `tsconfig.json`
- **Avoid `any`**: use `unknown` with type guards or `as unknown as Type`
- **Interfaces** for complex objects, types for simple unions

### Naming Conventions

- **Files**: camelCase for logic (`config.ts`), PascalCase for React components
- **Functions**: camelCase (`getConfig`, `detectInstallation`)
- **Constants**: UPPER_SNAKE_CASE (`CONFIG_DIR`, `DEFAULT_CONFIG`)

### Error Handling

```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  debug('Error occurred:', error);
  return null; // Graceful fallback
}
```

---

## Writing Patches

### Regex Rules

- **Identifier matching**: use `[$\w]+` not `\w+` — `$` appears frequently in
  minified identifiers and is a valid JS identifier character
- **Word boundaries**: anchor patterns with `,` `;` `}` `{` at the start instead
  of `\b` — `\b` doesn't treat `$` as a word character in V8, causing mismatches
- **Performance**: a literal anchor at the start (e.g. `,functionName`) can reduce
  match time from ~1.5 s to ~30 ms on large bundles

### Adding a New Patch

1. Create `src/patches/myPatch.ts` exporting `writeMyPatch(oldFile: string): string | null`
2. Add a `PATCH_DEFINITIONS` entry in `src/patches/index.ts` with `id`, `name`,
   `group`, and `description`
3. Add a `PatchImplementation` entry in `patchImplementations` keyed by the new ID
4. Import the function at the top of `index.ts`

### Diff Rendering — Two Render Sites (Important)

The Rust `ColorDiff` module is invoked in two separate components. Only the diff
component is patched; the file viewer is left untouched:

| Component          | Rust module fn | useMemo pattern                                           | Fallback          |
| ------------------ | -------------- | --------------------------------------------------------- | ----------------- |
| `nI` (diff view)   | `hkB()`        | `let W=Math.max(1,Math.floor($)); return J.render(q,W,A)` | `qkB` JS renderer |
| `aI` (file viewer) | `EkB()`        | `return J.render(q,$,B)` directly                         | `IkB` JS renderer |

The `Math.max(1,Math.floor(...))` expression is the unique anchor for `nI`.

`diff-syntax-theme-override` intercepts `nI`'s render call: for any non-builtin
theme ID it substitutes `"dark-ansi"` → bat `ansi` theme → no backgrounds.
Builtin IDs (`dark`, `light`, `dark-ansi`, `light-ansi`, `dark-daltonized`,
`light-daltonized`, `monochrome`) pass through unchanged.

---

## Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('myPatch', () => {
  it('applies correctly', () => {
    /* ... */
  });
  it('returns null for unmatched input', () => {
    /* ... */
  });
});
```

- Test files: `src/tests/*.test.ts` and `src/patches/*.test.ts`
- Mock dependencies with `vi.mock()`
- Every patch should have at minimum: a success case and a null-return case
- Run `npm test` before committing — the pre-commit hook enforces it

---

## Git Workflow

This fork diverges from upstream. When syncing:

```bash
git fetch upstream
git rebase upstream/main
# Re-apply fork commits on top: d6a3196, a114cca, cfee0d4
```

Force-push to origin after a rebase:

```bash
git push --force-with-lease origin main
```

Do **not** merge upstream into main — always rebase to keep a clean linear history.
