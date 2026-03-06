// Please see the note about writing patches in ./index

import { Theme } from '../types';
import { LocationResult, showDiff } from './index';

// Built-in theme IDs that ship with Claude Code — leave their diff colors untouched.
// Exported so other patches (e.g. diffSyntaxThemeOverride) can derive their own
// forms (regex string, Set, etc.) from a single source of truth.
export const BUILTIN_THEME_IDS = [
  'dark',
  'light',
  'dark-ansi',
  'light-ansi',
  'dark-daltonized',
  'light-daltonized',
  'monochrome',
] as const;
const BUILTIN_THEME_IDS_SET = new Set<string>(BUILTIN_THEME_IDS);

// ANSI diff colors for dark-background custom themes.
//
// Two reasons for ansi:* instead of rgb():
//   1. The Rust/bat renderer treats rgb() values as background fills on each
//      diff line, which looks heavy and over-bright on dark terminals.
//   2. ansi:* values are rendered as foreground-only (text colour, no background
//      fill), matching the behaviour of the built-in "Dark mode (ANSI colours
//      only)" theme — the style the user prefers.
//
// IMPORTANT: Do NOT switch these to rgb() values. That would re-introduce
// background fills on diff lines and defeat the purpose of this patch.
const CUSTOM_DARK_DIFF_COLORS = {
  diffAdded: 'ansi:green',
  diffRemoved: 'ansi:red',
  diffAddedDimmed: 'ansi:green',
  diffRemovedDimmed: 'ansi:red',
  diffAddedWord: 'ansi:greenBright',
  diffRemovedWord: 'ansi:redBright',
  diffAddedWordDimmed: 'ansi:green',
  diffRemovedWordDimmed: 'ansi:red',
} as const;

function getThemesLocation(oldFile: string): {
  switchStatement: LocationResult;
  objArr: LocationResult;
  obj: LocationResult;
} | null {
  // Look for switch statement pattern: switch(A){case"light":return ...;}
  const switchPattern =
    /switch\s*\(([^)]+)\)\s*\{[^}]*case\s*["']light["'][^}]+\}/s;
  const switchMatch = oldFile.match(switchPattern);

  if (!switchMatch || switchMatch.index == undefined) {
    console.error('patch: themes: failed to find switchMatch');
    return null;
  }

  // CC 2.1.70+: array starts with [...[], prefix (React Compiler cache sentinel)
  const objArrPat =
    /\[(?:\.\.\.\[\],)?(?:\{label:"(?:Dark|Light).+?",value:".+?"\},?)+\]/;
  // CC 2.1.70+: lookup object {auto:"Auto...",dark:"Dark mode",...}[WT.value...]
  const objPatNew =
    /\{auto:"[^"]+",(?:(?:[$\w]+|"[$\w-]+"): ?"[^"]+",?)+\}(?=\[)/;
  const objPat = /return\{(?:[$\w]+?:"(?:Dark|Light).+?",?)+\}/;

  const objArrMatch = oldFile.match(objArrPat);
  const objMatch = oldFile.match(objPat) ?? oldFile.match(objPatNew);

  if (!objArrMatch || objArrMatch.index == undefined) {
    console.error('patch: themes: failed to find objArrMatch');
    return null;
  }

  if (!objMatch || objMatch.index == undefined) {
    console.error('patch: themes: failed to find objMatch');
    return null;
  }

  return {
    switchStatement: {
      startIndex: switchMatch.index,
      endIndex: switchMatch.index + switchMatch[0].length,
      identifiers: [switchMatch[1].trim()],
    },
    objArr: {
      startIndex: objArrMatch.index,
      endIndex: objArrMatch.index + objArrMatch[0].length,
    },
    obj: {
      startIndex: objMatch.index,
      endIndex: objMatch.index + objMatch[0].length,
    },
  };
}

export const writeThemes = (
  oldFile: string,
  themes: Theme[]
): string | null => {
  const locations = getThemesLocation(oldFile);
  if (!locations) {
    return null;
  }

  if (themes.length === 0) {
    return oldFile;
  }

  let newFile = oldFile;

  // Process in reverse order to avoid index shifting

  // Update theme mapping object (obj)
  // CC 2.1.70+: {auto:"Auto...",dark:"Dark mode",...} — preserve the auto: entry
  // Pre-2.1.70: return{dark:"Dark",...}
  const existingObj = newFile.slice(
    locations.obj.startIndex,
    locations.obj.startIndex + 6
  );
  const themeEntries = Object.fromEntries(
    themes.map(theme => [theme.id, theme.name])
  );
  let obj: string;
  if (existingObj.startsWith('{')) {
    const fullObjText = newFile.slice(
      locations.obj.startIndex,
      locations.obj.endIndex
    );
    const autoMatch = fullObjText.match(/^\{auto:"([^"]+)"/);
    const autoEntry = autoMatch ? `"auto":"${autoMatch[1]}",` : '';
    obj = '{' + autoEntry + JSON.stringify(themeEntries).slice(1);
  } else {
    obj = 'return' + JSON.stringify(themeEntries);
  }
  newFile =
    newFile.slice(0, locations.obj.startIndex) +
    obj +
    newFile.slice(locations.obj.endIndex);
  showDiff(
    oldFile,
    newFile,
    obj,
    locations.obj.startIndex,
    locations.obj.endIndex
  );
  oldFile = newFile;

  // Update theme options array (objArr)
  const objArr = JSON.stringify(
    themes.map(theme => ({ label: theme.name, value: theme.id }))
  );
  newFile =
    newFile.slice(0, locations.objArr.startIndex) +
    objArr +
    newFile.slice(locations.objArr.endIndex);
  showDiff(
    oldFile,
    newFile,
    objArr,
    locations.objArr.startIndex,
    locations.objArr.endIndex
  );
  oldFile = newFile;

  // Update switch statement
  // For custom (non-builtin) themes, override diff colors with ANSI values so
  // the Rust/bat renderer uses the terminal's own palette instead of rgb().
  const resolveColors = (theme: Theme): Theme['colors'] => {
    if (BUILTIN_THEME_IDS_SET.has(theme.id)) return theme.colors;
    return { ...theme.colors, ...CUSTOM_DARK_DIFF_COLORS };
  };

  let switchStatement = `switch(${locations.switchStatement.identifiers?.[0]}){\n`;
  themes.forEach(theme => {
    switchStatement += `case"${theme.id}":return${JSON.stringify(
      resolveColors(theme)
    )};\n`;
  });
  switchStatement += `default:return${JSON.stringify(resolveColors(themes[0]))};\n}`;

  newFile =
    newFile.slice(0, locations.switchStatement.startIndex) +
    switchStatement +
    newFile.slice(locations.switchStatement.endIndex);
  showDiff(
    oldFile,
    newFile,
    switchStatement,
    locations.switchStatement.startIndex,
    locations.switchStatement.endIndex
  );

  return newFile;
};
