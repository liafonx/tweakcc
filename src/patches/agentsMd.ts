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

  console.error('patch: agentsMd: failed to find CLAUDE.md reading function');
  return null;
};
