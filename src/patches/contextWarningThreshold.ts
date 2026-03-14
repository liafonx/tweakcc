// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Override the context-low warning gap (default 20000 tokens).
 *
 * In DK_() the warning fires when: tokenUsage >= effectiveLimit - hrR
 * where hrR=20000. With a 200k context window and 20k output reservation,
 * effectiveLimit=180k and the warning fires at 160k (80% of 200k).
 *
 * The anchor uses the adjacent 13000 constant (vZq) that precedes hrR in
 * the var declaration. CC 2.1.73 form:
 *   var GrR=20000,vZq=13000,hrR=20000,ZrR=20000,VZq=3000;
 */
export function writeContextWarningThreshold(
  oldFile: string,
  gapTokens: number
): string | null {
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
  const replacement = `${match[1]}${gapTokens}${match[2]}`;
  const newFile =
    oldFile.slice(0, idx) + replacement + oldFile.slice(idx + match[0].length);

  showDiff(oldFile, newFile, replacement, idx, idx + match[0].length);
  return newFile;
}
