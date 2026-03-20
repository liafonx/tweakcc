// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patches the CLAUDE.md file reading function to also check for alternative
 * filenames (e.g., AGENTS.md) when CLAUDE.md doesn't exist.
 *
 * This finds the function that reads CLAUDE.md files and modifies it to:
 * 1. Add a `didReroute` parameter to the function
 * 2. At the early `return null` (when the file doesn't exist), check if the
 *    path ends with CLAUDE.md and try alternative names (unless didReroute
 *    is true)
 * 3. Recursive calls pass didReroute=true to avoid infinite loops
 *
 * CC ~2.1.62 (single all-in-one function):
 * ```diff
 * -function _t7(A, q) {
 * +function _t7(A, q, didReroute) {
 *    try {
 *      let K = x1();
 * -    if (!K.existsSync(A) || !K.statSync(A).isFile()) return null;
 * +    if (!K.existsSync(A) || !K.statSync(A).isFile()) {
 * +      if (!didReroute && (A.endsWith("/CLAUDE.md") || A.endsWith("\\CLAUDE.md"))) {
 * +        for (let alt of ["AGENTS.md", "GEMINI.md", "QWEN.md"]) {
 * +          let altPath = A.slice(0, -9) + alt;
 * +          if (K.existsSync(altPath) && K.statSync(altPath).isFile())
 * +            return _t7(altPath, q, true);
 * +        }
 * +      }
 * +      return null;
 * +    }
 *      ...
 *  }
 * ```
 *
 * CC 2.1.80+: file reading was split — the sync reader (XmK) calls a separate
 * content processor (tq7). The ENOENT/EISDIR error is handled in a separate
 * error-handler function (eq7). We patch XmK's catch block instead:
 * ```diff
 * -function XmK(_, T) {
 * +function XmK(_, T, didReroute) {
 *    try {
 *      let K = OT().readFileSync(_, { encoding: "utf-8" });
 *      return tq7(K, _, T);
 *    } catch(q) {
 * +    if (!didReroute && q.code === "ENOENT" &&
 * +        (_.endsWith("/CLAUDE.md") || _.endsWith("\\CLAUDE.md"))) {
 * +      for (let alt of ["AGENTS.md", "GEMINI.md", "QWEN.md"]) {
 * +        let altPath = _.slice(0, -9) + alt;
 * +        let r = XmK(altPath, T, true);
 * +        if (r) return r;
 * +      }
 * +    }
 *      return eq7(q, _), null;
 *    }
 * }
 * ```
 */
export const writeAgentsMd = (
  file: string,
  altNames: string[]
): string | null => {
  const altNamesJson = JSON.stringify(altNames);

  // ── Strategy A: CC 2.1.80+ split-reader pattern ──────────────────────────
  // function XmK(_,T){try{let K=OT().readFileSync(_,{encoding:"utf-8"});return tq7(K,_,T)}catch(q){return eq7(q,_),null}}
  const splitReaderPattern =
    /function ([$\w]+)\(([$\w]+),([$\w]+)\)\{try\{let [$\w]+=[$\w]+\(\)\.readFileSync\(\2,\{encoding:"utf-8"\}\);return [$\w]+\([^)]+\)\}catch\(([$\w]+)\)\{return [$\w]+\(\4,\2\),null\}\}/;
  const splitReaderMatch = file.match(splitReaderPattern);

  if (splitReaderMatch && splitReaderMatch.index !== undefined) {
    const [fullMatch, funcName, pathParam, typeParam, errVar] =
      splitReaderMatch;

    // Add didReroute param and inject ENOENT fallback in catch block
    const fallback = `if(!didReroute&&${errVar}.code==="ENOENT"&&(${pathParam}.endsWith("/CLAUDE.md")||${pathParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${pathParam}.slice(0,-9)+alt;let r=${funcName}(altPath,${typeParam},true);if(r)return r;}}`;
    const newFunc = fullMatch
      .replace(
        `function ${funcName}(${pathParam},${typeParam})`,
        `function ${funcName}(${pathParam},${typeParam},didReroute)`
      )
      .replace(
        `}catch(${errVar}){return`,
        `}catch(${errVar}){${fallback}return`
      );

    const newFile =
      file.slice(0, splitReaderMatch.index) +
      newFunc +
      file.slice(splitReaderMatch.index + fullMatch.length);

    showDiff(
      file,
      newFile,
      newFunc,
      splitReaderMatch.index,
      splitReaderMatch.index + fullMatch.length
    );
    return newFile;
  }

  // ── Strategy B: CC ~2.1.62–2.1.79 all-in-one function ───────────────────
  const funcPattern =
    /(function ([$\w]+)\(([$\w]+),([^)]+?))\)(?:.|\n){0,500}Skipping non-text file in @include/;

  const funcMatch = file.match(funcPattern);
  if (!funcMatch || funcMatch.index === undefined) {
    console.error('patch: agentsMd: failed to find CLAUDE.md reading function');
    return null;
  }
  const upToFuncParamsClosingParen = funcMatch[1];
  const functionName = funcMatch[2];
  const firstParam = funcMatch[3];
  const restParams = funcMatch[4];
  const funcStart = funcMatch.index;

  const fsPattern = /([$\w]+(?:\(\))?)\.(?:readFileSync|existsSync|statSync)/;
  const fsMatch = funcMatch[0].match(fsPattern);
  if (!fsMatch) {
    console.error('patch: agentsMd: failed to find fs expression in function');
    return null;
  }
  const fsExpr = fsMatch[1];

  // Step 1: Add didReroute parameter to function signature
  const sigIndex = funcStart + upToFuncParamsClosingParen.length;
  let newFile = file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

  showDiff(file, newFile, ',didReroute', sigIndex, sigIndex);

  // Step 2: Inject fallback at the early return null (when file doesn't exist)
  const funcBody = newFile.slice(funcStart);

  // Try pre-2.1.70 pattern first (existsSync/statSync/isFile guard)
  const earlyReturnOld = /\.isFile\(\)\)return null/;
  const earlyReturnMatchOld = funcBody.match(earlyReturnOld);

  if (earlyReturnMatchOld && earlyReturnMatchOld.index !== undefined) {
    const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;if(${fsExpr}.existsSync(altPath)&&${fsExpr}.statSync(altPath).isFile())return ${functionName}(altPath,${restParams},true);}}`;

    const earlyReturnStart = funcStart + earlyReturnMatchOld.index;
    const oldStr = earlyReturnMatchOld[0];
    const newStr = `.isFile()){${fallback}return null;}`;

    newFile =
      newFile.slice(0, earlyReturnStart) +
      newStr +
      newFile.slice(earlyReturnStart + oldStr.length);

    showDiff(file, newFile, newStr, earlyReturnStart, earlyReturnStart);
  } else {
    // 2.1.70+: try/catch with ENOENT/EISDIR instead of isFile guard
    const earlyReturnNew = /==="ENOENT"\|\|([$\w]+)==="EISDIR"\)return null;/;
    const earlyReturnMatchNew = funcBody.match(earlyReturnNew);

    if (!earlyReturnMatchNew || earlyReturnMatchNew.index === undefined) {
      console.error(
        'patch: agentsMd: failed to find early return null for injection'
      );
      return null;
    }

    // Recursive call — the function handles ENOENT gracefully
    const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;let r=${functionName}(altPath,${restParams},true);if(r)return r;}}`;

    const earlyReturnStart = funcStart + earlyReturnMatchNew.index;
    const oldStr = earlyReturnMatchNew[0];
    const newStr = oldStr.replace(
      ')return null;',
      `){${fallback}return null;}`
    );

    newFile =
      newFile.slice(0, earlyReturnStart) +
      newStr +
      newFile.slice(earlyReturnStart + oldStr.length);

    showDiff(file, newFile, newStr, earlyReturnStart, earlyReturnStart);
  }

  return newFile;
};
