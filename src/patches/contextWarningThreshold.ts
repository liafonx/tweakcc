// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Suppress the "Context low" warning by setting the gap constant to 0.
 *
 * In DK_() the warning fires when: tokenUsage >= effectiveLimit - hrR
 * where hrR=20000. Setting hrR=0 means the warning only fires at 100%
 * usage — effectively never.
 *
 * The anchor uses the adjacent 13000 constant (vZq) that precedes hrR in
 * the var declaration. CC 2.1.73 form:
 *   var GrR=20000,vZq=13000,hrR=20000,ZrR=20000,VZq=3000;
 */
export function writeContextWarningThreshold(oldFile: string): string | null {
  // Anchored by the unique 13000 constant immediately before the warning gap.
  // Group 1 captures everything up to and including the `=` before the gap value.
  // Group 2 captures the rest of the declaration (error threshold + beyond).
  const pattern = /(,[$\w]+=13000,[$\w]+=)20000(,[$\w]+=20000,[$\w]+=3000)/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: contextWarningThreshold: failed to find context warning gap constant'
    );
    return null;
  }

  const idx = match.index!;
  const replacement = `${match[1]}0${match[2]}`;
  const newFile =
    oldFile.slice(0, idx) + replacement + oldFile.slice(idx + match[0].length);

  showDiff(oldFile, newFile, replacement, idx, idx + match[0].length);
  return newFile;
}
