// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Bypass api.anthropic.com domain check to enable Tool Search with proxy/relay endpoints.
 */
export function writeForceToolSearch(oldFile: string): string | null {
  const pattern =
    /return\["api\.anthropic\.com"\]\.includes\(([$\w]+)\)\}catch\{return!1\}/;
  const match = oldFile.match(pattern);
  if (!match) {
    console.error(
      'patch: forceToolSearch: failed to find api.anthropic.com domain check'
    );
    return null;
  }

  const idx = match.index!;
  const replacement = 'return!0}catch{return!0}';
  const newFile =
    oldFile.slice(0, idx) + replacement + oldFile.slice(idx + match[0].length);

  showDiff(oldFile, newFile, replacement, idx, idx + match[0].length);
  return newFile;
}
