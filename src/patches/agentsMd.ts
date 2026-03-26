// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patches the CLAUDE.md file reading function to also check for alternative
 * filenames (e.g., AGENTS.md) when CLAUDE.md doesn't exist.
 *
 * This finds the function that reads CLAUDE.md files and modifies it to:
 * 1. Add a `didReroute` parameter to the function
 * 2. At the early return-null (when the file doesn't exist), check if the
 *    path ends with CLAUDE.md and try alternative names (unless didReroute
 *    is true)
 * 3. Recursive calls pass didReroute=true to avoid infinite loops
 *
 * CC 2.1.80–2.1.82: file reading was split — the sync reader (XmK) calls a
 * separate content processor (tq7). The ENOENT error is handled in a separate
 * error-handler function (eq7). We patch XmK's catch block:
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
 *
 * CC 2.1.83+: reading became async — sLq(path,type,resolvedPath) calls
 * readFile and returns {info,includePaths}. We patch sLq's catch block:
 * ```diff
 * -async function sLq(_, T, q) {
 * +async function sLq(_, T, q, didReroute) {
 *    try {
 *      let $ = await AT().readFile(_, { encoding: "utf-8" });
 *      return gUK($, _, T, q);
 *    } catch(K) {
 * +    if (!didReroute && K.code === "ENOENT" &&
 * +        (_.endsWith("/CLAUDE.md") || _.endsWith("\\CLAUDE.md"))) {
 * +      for (let alt of ["AGENTS.md", "GEMINI.md", "QWEN.md"]) {
 * +        let altPath = _.slice(0, -9) + alt;
 * +        let r = await sLq(altPath, T, altPath, true);
 * +        if (r.info) return r;
 * +      }
 * +    }
 *      return dUK(K, _), { info: null, includePaths: [] };
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

  // ── Strategy B: CC 2.1.83+ async reader pattern ──────────────────────────
  // async function sLq(_,T,q){try{let $=await AT().readFile(_,{encoding:"utf-8"});return gUK($,_,T,q)}catch(K){return dUK(K,_),{info:null,includePaths:[]}}}
  const asyncReaderPattern =
    /async function ([$\w]+)\(([$\w]+),([$\w]+),([$\w]+)\)\{try\{let ([$\w]+)=await [$\w]+\(\)\.readFile\(\2,\{encoding:"utf-8"\}\);return [$\w]+\(\5,\2,\3,\4\)\}catch\(([$\w]+)\)\{return [$\w]+\(\6,\2\),\{info:null,includePaths:\[\]\}\}\}/;
  const asyncReaderMatch = file.match(asyncReaderPattern);

  if (asyncReaderMatch && asyncReaderMatch.index !== undefined) {
    const [fullMatch, funcName, pathParam, typeParam, resolvedParam, , errVar] =
      asyncReaderMatch;

    const fallback = `if(!didReroute&&${errVar}.code==="ENOENT"&&(${pathParam}.endsWith("/CLAUDE.md")||${pathParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${pathParam}.slice(0,-9)+alt;let r=await ${funcName}(altPath,${typeParam},altPath,true);if(r.info)return r;}}`;
    const newFunc = fullMatch
      .replace(
        `async function ${funcName}(${pathParam},${typeParam},${resolvedParam})`,
        `async function ${funcName}(${pathParam},${typeParam},${resolvedParam},didReroute)`
      )
      .replace(
        `}catch(${errVar}){return`,
        `}catch(${errVar}){${fallback}return`
      );

    const newFile =
      file.slice(0, asyncReaderMatch.index) +
      newFunc +
      file.slice(asyncReaderMatch.index + fullMatch.length);

    showDiff(
      file,
      newFile,
      newFunc,
      asyncReaderMatch.index,
      asyncReaderMatch.index + fullMatch.length
    );
    return newFile;
  }

  console.error('patch: agentsMd: failed to find CLAUDE.md reading function');
  return null;
};
