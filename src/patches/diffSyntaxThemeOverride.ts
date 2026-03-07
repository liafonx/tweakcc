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
 * Three patterns supported:
 *
 * Pre-2.1.70 (direct return, inline render):
 *   let W=Math.max(1,Math.floor($));return J.render(q,W,A)
 *
 * 2.1.70 (React Compiler cached useMemo, inline render):
 *   let Z=Math.max(1,Math.floor(D)),N;if(R[6]!==J||...)N=J.render(h,Z,A)
 *
 * 2.1.71+ (render extracted to Ns$ wrapper function):
 *   The diff component calls Ns$(patch,firstLine,filePath,content,theme,width,dim)
 *   and Ns$ internally does: let Y=new H(_,q,T,K).render($,A,O)
 *   Anchored by factory-call + null-guard + WeakMap cache-check uniquely
 *   identifying the ColorDiff wrapper function.
 */

const BUILTIN_THEMES = `/^(${BUILTIN_THEME_IDS.join('|')})$/`;

export const writeDiffSyntaxThemeOverride = (
  oldFile: string
): string | null => {
  let replacement: string;
  let matchIndex: number;
  let matchLength: number;

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
  if (match2171 && match2171.index !== undefined) {
    const [, classVar, , , , a1, a2, a3, a4, themeVar, widthVar, dimVar] =
      match2171;
    const oldRender = `new ${classVar}(${a1},${a2},${a3},${a4}).render(${themeVar},${widthVar},${dimVar})`;
    const newRender =
      `new ${classVar}(${a1},${a2},${a3},${a4}).render(` +
      `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
      `,${widthVar},${dimVar})`;
    replacement = match2171[0].replace(oldRender, newRender);
    matchIndex = match2171.index;
    matchLength = match2171[0].length;
  } else {
    // 2.1.70: React Compiler cached useMemo pattern, inline render
    // let Z=Math.max(1,Math.floor(D)),N;if(R[6]!==J||...)N=J.render(h,Z,A)
    //
    // Capture groups: 1=widthVar 2=rawWidthVar 3=extraVar 4=assignVar
    //                 5=moduleVar 6=themeVar 7=widthRef 8=dimVar
    const pat2170 =
      /let ([$\w]+)=Math\.max\(1,Math\.floor\(([$\w]+)\)\),([$\w]+);if\((?:[^()]*\([^()]*\))*[^()]*\)([$\w]+)=([$\w]+)\.render\(([$\w]+),([$\w]+),([$\w]+)\)/;

    const match2170 = oldFile.match(pat2170);
    if (match2170 && match2170.index !== undefined) {
      const [, , , , , moduleVar, themeVar, widthRef, dimVar] = match2170;
      const oldRender = `${moduleVar}.render(${themeVar},${widthRef},${dimVar})`;
      const newRender =
        `${moduleVar}.render(` +
        `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
        `,${widthRef},${dimVar})`;
      replacement = match2170[0].replace(oldRender, newRender);
      matchIndex = match2170.index;
      matchLength = match2170[0].length;
    } else {
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
      replacement =
        `let ${widthVar}=Math.max(1,Math.floor(${rawWidthVar}));` +
        `return ${moduleVar}.render(` +
        `${BUILTIN_THEMES}.test(${themeVar})?${themeVar}:"dark-ansi"` +
        `,${widthVar},${dimVar})`;
      matchIndex = matchOld.index;
      matchLength = matchOld[0].length;
    }
  }

  const newFile =
    oldFile.slice(0, matchIndex) +
    replacement +
    oldFile.slice(matchIndex + matchLength);
  showDiff(oldFile, newFile, replacement, matchIndex, matchIndex + matchLength);
  return newFile;
};
