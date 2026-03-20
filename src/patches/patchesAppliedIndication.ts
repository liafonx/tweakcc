import {
  LocationResult,
  escapeIdent,
  findBoxComponent,
  findChalkVar,
  findTextComponent,
  getReactVar,
  showDiff,
} from './index';

/**
 * PATCH 1: Finds the location of the version output pattern in Claude Code's cli.js
 */
export const findVersionOutputLocation = (
  fileContents: string
): LocationResult | null => {
  // Pattern: }.VERSION} (Claude Code)
  const versionPattern = '}.VERSION} (Claude Code)';
  const versionIndex = fileContents.indexOf(versionPattern);
  if (versionIndex == -1) {
    console.error(
      'patch: patchesAppliedIndication: failed to find versionIndex'
    );
    return null;
  }

  return {
    startIndex: 0,
    endIndex: versionIndex + versionPattern.length,
  };
};

/**
 * PATCH 2: Finds the location to insert tweakcc version in the header
 *
 * Pre-2.1.70 (contiguous):
 *   createElement(TEXT,{bold:!0},"Claude Code")," ",createElement(TEXT,{dimColor:!0},"v",VER)
 *
 * 2.1.70+ (React Compiler cached):
 *   createElement(TEXT,null,cachedBold," ",createElement(TEXT,{dimColor:!0},"v",VER))
 */
const findTweakccVersionLocation = (
  fileContents: string
): LocationResult | null => {
  // 2.1.70+: createElement(TEXT,null,VAR," ",createElement(TEXT,{dimColor:!0},"v",VAR))
  const pat =
    /[^$\w]([$\w]+)\.createElement\(([$\w]+),null,([$\w]+)," ",\1\.createElement\(\2,\{dimColor:!0\},"v",([$\w]+)\)\)/;
  const match = fileContents.match(pat);
  if (match && match.index !== undefined) {
    // Insert before the last ) to add children to the outer createElement
    const insertIndex = match.index + match[0].length - 1;
    return { startIndex: insertIndex, endIndex: insertIndex };
  }

  console.error(
    'patch: patchesAppliedIndication: failed to find Claude Code version pattern'
  );
  return null;
};

/**
 * PATCH 3: Finds the location to insert the patches applied list
 *
 * Uses createElement(TEXT,{bold:!0},"Claude Code") as anchor — simpler
 * than the full version display pattern and unaffected by Patch 2's
 * insertion (which modifies the dimColor version element downstream).
 */
const findPatchesListLocation = (
  fileContents: string
): LocationResult | null => {
  // 1. Find the bold "Claude Code" element (works for both old and 2.1.70+)
  const pattern =
    /[^$\w]([$\w]+)\.createElement\(([$\w]+),\{bold:!0\},"Claude Code"\)/;
  const match = fileContents.match(pattern);
  if (!match || match.index === undefined) {
    console.error(
      'patch: patchesAppliedIndication: failed to find Claude Code version pattern for patch 3'
    );
    return null;
  }

  // 2. Go back 1500 chars from the match start
  const lookbackStart = Math.max(0, match.index - 1500);
  const lookbackSubstring = fileContents.slice(lookbackStart, match.index);

  // 3. Take the last `}function ([$\w]+)\(`
  const functionPattern = /\}function ([$\w]+)\(/g;
  const functionMatches = Array.from(
    lookbackSubstring.matchAll(functionPattern)
  );
  if (functionMatches.length === 0) {
    console.error(
      'patch: patchesAppliedIndication: failed to find header component function'
    );
    return null;
  }
  const lastFunctionMatch = functionMatches[functionMatches.length - 1];
  const headerComponentName = lastFunctionMatch[1];

  // 4. Search for the createElement call with the header component
  const createHeaderPattern = new RegExp(
    `[^$\\w]([$\\w]+)\\.createElement\\(${escapeIdent(headerComponentName)},null\\),?`
  );
  const createHeaderMatch = fileContents.match(createHeaderPattern);
  if (!createHeaderMatch || createHeaderMatch.index === undefined) {
    console.error(
      'patch: patchesAppliedIndication: failed to find createElement call for header'
    );
    return null;
  }

  // 5. Insert after this line
  const insertIndex = createHeaderMatch.index + createHeaderMatch[0].length;
  return {
    startIndex: insertIndex,
    endIndex: insertIndex,
  };
};

/**
 * Modifies the CLI to show patches applied indication
 * - PATCH 1: Modifies version output text
 * - PATCH 2: Adds tweakcc version to header
 * - PATCH 3: Adds patches applied list
 */
export const writePatchesAppliedIndication = (
  fileContents: string,
  tweakccVersion: string,
  patchesApplies: string[],
  showTweakccVersion: boolean = true,
  showPatchesApplied: boolean = true
): string | null => {
  // PATCH 1: Version output modification
  const versionOutputLocation = findVersionOutputLocation(fileContents);
  if (!versionOutputLocation) {
    console.error(
      'patch: patchesAppliedIndication: failed to version output location'
    );
    return null;
  }

  const newText = `\\n${tweakccVersion} (tweakcc)`;
  let content =
    fileContents.slice(0, versionOutputLocation.endIndex) +
    newText +
    fileContents.slice(versionOutputLocation.endIndex);

  showDiff(
    fileContents,
    content,
    newText,
    versionOutputLocation.endIndex,
    versionOutputLocation.endIndex
  );

  // Find shared components needed by multiple patches
  const chalkVar = findChalkVar(fileContents);
  if (!chalkVar) {
    console.error(
      'patch: patchesAppliedIndication: failed to find chalk variable'
    );
    return null;
  }

  const textComponent = findTextComponent(fileContents);
  if (!textComponent) {
    console.error(
      'patch: patchesAppliedIndication: failed to find text component'
    );
    return null;
  }

  const reactVar = getReactVar(fileContents);
  if (!reactVar) {
    console.error(
      'patch: patchesAppliedIndication: failed to find React variable'
    );
    return null;
  }

  const boxComponent = findBoxComponent(fileContents);
  if (!boxComponent) {
    console.error(
      'patch: patchesAppliedIndication: failed to find Box component'
    );
    return null;
  }

  // PATCH 2: Add tweakcc version to header (if enabled)
  if (showTweakccVersion) {
    const tweakccVersionLoc = findTweakccVersionLocation(content);
    if (!tweakccVersionLoc) {
      console.error('patch: patchesAppliedIndication: patch 2 failed');
      return null;
    }

    const tweakccVersionCode = `, " ",${reactVar}.createElement(${textComponent}, null, ${chalkVar}.blue.bold('+ tweakcc v${tweakccVersion}'))`;

    const oldContent2 = content;
    content =
      content.slice(0, tweakccVersionLoc.startIndex) +
      tweakccVersionCode +
      content.slice(tweakccVersionLoc.endIndex);

    showDiff(
      oldContent2,
      content,
      tweakccVersionCode,
      tweakccVersionLoc.startIndex,
      tweakccVersionLoc.endIndex
    );
  }

  // PATCH 3: Add patches applied list (if enabled)
  if (showPatchesApplied) {
    const patchesListLoc = findPatchesListLocation(content);
    if (!patchesListLoc) {
      console.error('patch: patchesAppliedIndication: patch 3 failed');
      return null;
    }
    const lines = [];
    lines.push(
      `${reactVar}.createElement(${boxComponent}, { flexDirection: "column" },`
    );
    lines.push(
      `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "✓ tweakcc patches are applied")),`
    );
    for (let item of patchesApplies) {
      item = item.replace('CHALK_VAR', chalkVar);
      lines.push(
        `${reactVar}.createElement(${boxComponent}, null, ${reactVar}.createElement(${textComponent}, {color: "success", bold: true}, "┃ "), ${reactVar}.createElement(${textComponent}, {dimColor: true}, \`  * ${item}\`)),`
      );
    }
    lines.push('),');
    const patchesListCode = lines.join('\n');

    const oldContent3 = content;
    content =
      content.slice(0, patchesListLoc.startIndex) +
      patchesListCode +
      content.slice(patchesListLoc.endIndex);

    showDiff(
      oldContent3,
      content,
      patchesListCode,
      patchesListLoc.startIndex,
      patchesListLoc.endIndex
    );
  }

  return content;
};
