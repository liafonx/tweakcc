// Please see the note about writing patches in ./index

import { showDiff } from './index';
import { BUILTIN_THEME_IDS } from './themes';

/**
 * Override the theme ID passed to the Rust ColorDiff renderer so that custom
 * themes use the "ansi" bat theme (no background fills) rather than the
 * default bat theme (bright solid backgrounds).
 *
 * The Rust ColorDiff module maps known theme IDs to bat syntax themes:
 *   "dark-ansi" → bat "ansi" → foreground-only ANSI colours, no backgrounds
 *   unknown ID  → default bat theme → bright solid background fills
 *
 * This patch intercepts the theme argument before it reaches
 * ColorDiff.render(themeId, width, dim). For any unrecognised (custom) theme
 * ID, it substitutes "dark-ansi" so the Rust renderer always uses the
 * foreground-only ansi bat theme while preserving syntax highlighting.
 *
 * 2.1.71+ (render extracted to wrapper function):
 *   The diff component calls the wrapper with (patch,firstLine,filePath,content,theme,width,dim)
 *   and the wrapper does: let Y=new H(_,q,T,K).render($,A,O)
 *   Anchored by factory-call + null-guard (backreference) + WeakMap cache-check uniquely
 *   identifying the ColorDiff wrapper function.
 */

const BUILTIN_THEMES = `/^(${BUILTIN_THEME_IDS.join('|')})$/`;

export const writeDiffSyntaxThemeOverride = (
  oldFile: string
): string | null => {
  // 2.1.71+: render extracted to wrapper function (Ns$-style)
  // let H=factory();if(!H)return null;let cache=...;if(hit)return hit;
  //   let Y=new H(_,q,T,K).render($,A,O)
  //
  // Anchored by: factory-call → null-guard (backreference to class var) →
  //   WeakMap cache check → new ClassVar(4 args).render(theme,width,dim)
  //
  // Capture groups: 1=classVar 2=factoryFn 3=cacheHitVar 4=resultVar
  //                 5..8=constructorArgs 9=themeVar 10=widthVar 11=dimVar
  const pat2171 =
    /let ([$\w]+)=([$\w$]+)\(\);if\(!\1\)return null;let [^;]+;if\(([$\w]+)\)return \3;let ([$\w]+)=new \1\(([$\w]+),([$\w]+),([$\w]+),([$\w]+)\)\.render\(([$\w]+),([$\w]+),([$\w]+)\)/;

  const match2171 = oldFile.match(pat2171);
  if (!match2171 || match2171.index === undefined) {
    console.error(
      'patch: diffSyntaxThemeOverride: failed to find ColorDiff wrapper function'
    );
    return null;
  }

  const [, classVar, , , , a1, a2, a3, a4, themeVar, widthVar, dimVar] =
    match2171;
  const oldRender = `new ${classVar}(${a1},${a2},${a3},${a4}).render(${themeVar},${widthVar},${dimVar})`;
  const newRender =
    `new ${classVar}(${a1},${a2},${a3},${a4}).render(` +
    `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
    `,${widthVar},${dimVar})`;
  const replacement = match2171[0].replace(oldRender, newRender);
  const matchIndex = match2171.index;
  const matchLength = match2171[0].length;

  const newFile =
    oldFile.slice(0, matchIndex) +
    replacement +
    oldFile.slice(matchIndex + matchLength);
  showDiff(oldFile, newFile, replacement, matchIndex, matchIndex + matchLength);
  return newFile;
};
