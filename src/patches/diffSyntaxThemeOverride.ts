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
 */

export const writeDiffSyntaxThemeOverride = (
  oldFile: string
): string | null => {
  // The nI diff component's useMemo contains:
  //   let W=Math.max(1,Math.floor($));return J.render(q,W,A)
  //
  // Capture groups:
  //  1  computed width var  (W)
  //  2  raw width var       ($)
  //  3  Rust module var     (J)
  //  4  theme ID var        (q)
  //  5  computed width ref  (W — same as group 1, unused in replacement)
  //  6  dim var             (A)
  const pat =
    /let ([$\w]+)=Math\.max\(1,Math\.floor\(([$\w]+)\)\);return ([$\w]+)\.render\(([$\w]+),([$\w]+),([$\w]+)\)/;

  const match = oldFile.match(pat);
  if (!match || match.index == undefined) {
    console.error(
      'patch: diffSyntaxThemeOverride: failed to find nI useMemo render call'
    );
    return null;
  }

  const [, widthVar, rawWidthVar, moduleVar, themeVar, , dimVar] = match;

  // Replace J.render(q,W,A) with J.render(<built-in check>?q:"dark-ansi",W,A)
  const replacement =
    `let ${widthVar}=Math.max(1,Math.floor(${rawWidthVar}));` +
    `return ${moduleVar}.render(` +
    `/^(dark|light|dark-ansi|light-ansi|dark-daltonized|light-daltonized|monochrome)$/.test(${themeVar})?${themeVar}:"dark-ansi"` +
    `,${widthVar},${dimVar})`;

  const newFile =
    oldFile.slice(0, match.index) +
    replacement +
    oldFile.slice(match.index + match[0].length);

  showDiff(
    oldFile,
    newFile,
    replacement,
    match.index,
    match.index + match[0].length
  );
  return newFile;
};
