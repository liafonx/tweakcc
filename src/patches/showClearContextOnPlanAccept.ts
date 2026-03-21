// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Force showClearContextOnPlanAccept to always return true.
 *
 * CC 2.1.81 added a showClearContextOnPlanAccept setting (default: false) that
 * gates the "clear context and auto-accept edits" option in the plan mode exit
 * dialog. When false, only the keep-context variants are shown.
 *
 * The runtime read is:
 *   f=zT((t)=>t.settings.showClearContextOnPlanAccept)??!1
 *
 * Changing ??!1 (nullish-coalesce to false) to ??!0 (nullish-coalesce to true)
 * ensures the clear-context option always appears regardless of the CC setting.
 */
export function writeShowClearContextOnPlanAccept(
  oldFile: string
): string | null {
  const needle = '.showClearContextOnPlanAccept)??!1';
  const idx = oldFile.indexOf(needle);
  if (idx === -1) {
    console.error(
      'patch: showClearContextOnPlanAccept: failed to find showClearContextOnPlanAccept default'
    );
    return null;
  }

  const replacement = '.showClearContextOnPlanAccept)??!0';
  const newFile =
    oldFile.slice(0, idx) + replacement + oldFile.slice(idx + needle.length);

  showDiff(oldFile, newFile, replacement, idx, idx + needle.length);
  return newFile;
}
