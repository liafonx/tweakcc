// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Override the theme ID passed to the Rust ColorDiff renderer so that custom
 * themes use the "ansi" bat theme (no background fills) rather than the
 * default bat theme (bright solid backgrounds).
 *
 * The Rust ColorDiff module maps known theme IDs to bat syntax themes:
 *   "dark-ansi" → bat "ansi" → foreground-only ANSI colours, no backgrounds
 *   unknown ID  → default bat theme → bright solid background fills
 *
 * This patch intercepts the theme argument in the diff component's useMemo
 * before it reaches J.render(themeId, width, dim). For any unrecognised
 * (custom) theme ID, it substitutes "dark-ansi" so the Rust renderer always
 * uses the foreground-only ansi bat theme while preserving syntax highlighting.
 *
 * The `Math.max(1,Math.floor(...))` expression uniquely anchors this to the
 * diff component (nI) rather than the file-viewer component (aI), which also
 * calls J.render but is left untouched.
 *
 * Two patterns supported:
 *
 * Pre-2.1.70 (direct return):
 *   let W=Math.max(1,Math.floor($));return J.render(q,W,A)
 *
 * 2.1.70+ (React Compiler cached useMemo):
 *   let Z=Math.max(1,Math.floor(D)),N;if(R[6]!==J||...)N=J.render(h,Z,A)
 */

const BUILTIN_THEMES =
  '/^(dark|light|dark-ansi|light-ansi|dark-daltonized|light-daltonized|monochrome)$/';

export const writeDiffSyntaxThemeOverride = (
  oldFile: string
): string | null => {
  // 2.1.70+: React Compiler cached useMemo pattern
  // let Z=Math.max(1,Math.floor(D)),N;if(R[6]!==J||...)N=J.render(h,Z,A)
  //
  // Capture groups: 1=widthVar 2=rawWidthVar 3=extraVar 4=assignVar
  //                 5=moduleVar 6=themeVar 7=widthRef 8=dimVar
  const patNew =
    /let ([$\w]+)=Math\.max\(1,Math\.floor\(([$\w]+)\)\),([$\w]+);if\([^)]+\)([$\w]+)=([$\w]+)\.render\(([$\w]+),([$\w]+),([$\w]+)\)/;

  const matchNew = oldFile.match(patNew);
  if (matchNew && matchNew.index !== undefined) {
    const [, widthVar, , , , moduleVar, themeVar, , dimVar] = matchNew;
    const oldRender = `${moduleVar}.render(${themeVar},${widthVar},${dimVar})`;
    const newRender =
      `${moduleVar}.render(` +
      `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
      `,${widthVar},${dimVar})`;
    const replacement = matchNew[0].replace(oldRender, newRender);
    const newFile =
      oldFile.slice(0, matchNew.index) +
      replacement +
      oldFile.slice(matchNew.index + matchNew[0].length);
    showDiff(
      oldFile,
      newFile,
      replacement,
      matchNew.index,
      matchNew.index + matchNew[0].length
    );
    return newFile;
  }

  // Pre-2.1.70: direct return pattern
  // let W=Math.max(1,Math.floor($));return J.render(q,W,A)
  //
  // Capture groups: 1=widthVar 2=rawWidthVar 3=moduleVar 4=themeVar
  //                 5=widthRef(unused) 6=dimVar
  const patOld =
    /let ([$\w]+)=Math\.max\(1,Math\.floor\(([$\w]+)\)\);return ([$\w]+)\.render\(([$\w]+),([$\w]+),([$\w]+)\)/;

  const matchOld = oldFile.match(patOld);
  if (!matchOld || matchOld.index === undefined) {
    console.error(
      'patch: diffSyntaxThemeOverride: failed to find nI useMemo render call'
    );
    return null;
  }

  const [, widthVar, rawWidthVar, moduleVar, themeVar, , dimVar] = matchOld;
  const replacement =
    `let ${widthVar}=Math.max(1,Math.floor(${rawWidthVar}));` +
    `return ${moduleVar}.render(` +
    `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
    `,${widthVar},${dimVar})`;

  const newFile =
    oldFile.slice(0, matchOld.index) +
    replacement +
    oldFile.slice(matchOld.index + matchOld[0].length);

  showDiff(
    oldFile,
    newFile,
    replacement,
    matchOld.index,
    matchOld.index + matchOld[0].length
  );
  return newFile;
};
