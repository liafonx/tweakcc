// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Find the PackageManagerAutoUpdater component body start index.
 *
 * Steps:
 * 1. Find the string literal "Update available! Run: " (stable across CC versions)
 * 2. Get 4000 chars before that occurrence
 * 3. Find the LAST /function [$\w]+\([^)]*\)\{/ in that subsection
 * 4. Return the index after the `{`
 */
const findUpdateNotificationComponent = (oldFile: string): number | null => {
  const anchor = 'Update available! Run: ';
  const anchorIndex = oldFile.indexOf(anchor);

  if (anchorIndex === -1) {
    console.error(
      'patch: suppressUpdateNotification: failed to find "Update available! Run: " string'
    );
    return null;
  }

  const lookbackStart = Math.max(0, anchorIndex - 4000);
  const beforeText = oldFile.slice(lookbackStart, anchorIndex);

  const functionPattern = /function [$\w]+\([^)]*\)\{/g;
  let lastFunctionMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = functionPattern.exec(beforeText)) !== null) {
    lastFunctionMatch = match;
  }

  if (!lastFunctionMatch) {
    console.error(
      'patch: suppressUpdateNotification: failed to find enclosing function'
    );
    return null;
  }

  return lookbackStart + lastFunctionMatch.index + lastFunctionMatch[0].length;
};

export const writeSuppressUpdateNotification = (
  oldFile: string
): string | null => {
  const insertIndex = findUpdateNotificationComponent(oldFile);

  if (insertIndex === null) {
    return null;
  }

  const insertCode = 'return null;';
  const newFile =
    oldFile.slice(0, insertIndex) + insertCode + oldFile.slice(insertIndex);

  showDiff(oldFile, newFile, insertCode, insertIndex, insertIndex);
  return newFile;
};
