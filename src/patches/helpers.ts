import { escapeIdent } from '.';

function throwPatchError(msg: string): never {
  console.error(msg);
  throw new Error(msg);
}

export const findChalkVar = (fileContents: string): string => {
  // Find chalk variable using the counting method
  const chalkPattern =
    /[^$\w]([$\w]+)(?:\.(?:cyan|gray|green|red|yellow|ansi256|bgAnsi256|bgHex|bgRgb|hex|rgb|bold|dim|inverse|italic|strikethrough|underline)\b)+\(/g;
  const chalkMatches = Array.from(fileContents.matchAll(chalkPattern));

  // Count occurrences of each variable
  const chalkCounts: Record<string, number> = {};
  for (const match of chalkMatches) {
    const varName = match[1];
    chalkCounts[varName] = (chalkCounts[varName] || 0) + 1;
  }

  // Find the variable with the most occurrences
  let chalkVar: string | undefined;
  let maxCount = 0;
  for (const [varName, count] of Object.entries(chalkCounts)) {
    if (count > maxCount) {
      maxCount = count;
      chalkVar = varName;
    }
  }
  if (!chalkVar) {
    throwPatchError('patch: findChalkVar: failed to find chalk variable');
  }
  return chalkVar;
};

/**
 * Find the module loader function
 */
export const getModuleLoaderFunction = (fileContents: string): string => {
  // Native bundles: look for ,j=(H,$,A)=>{A=H!=null? pattern (module loader)
  // This is distinct from other 3-param functions because of the H!=null check
  const nativeLoaderPattern =
    /[,;]([$\w]+)=\([$\w]+,[$\w]+,[$\w]+\)=>\{[$\w]+=[$\w]+!=null\?/;
  const nativeMatch = fileContents.slice(0, 2000).match(nativeLoaderPattern);
  if (nativeMatch) {
    return nativeMatch[1];
  }

  // NPM bundles: var T=(H,$,A)=>{ at the start
  // In newer versions there are more than one, and the one with the shortest name
  // is the most common one and therefore the correct one.
  const firstChunk = fileContents.slice(0, 10000);
  const pattern = /(?:var |,)([$\w]+)=\([$\w]+,[$\w]+,[$\w]+\)=>\{/g;
  const matches = Array.from(firstChunk.matchAll(pattern));
  if (matches.length > 0) {
    let shortest = matches[0][1];
    for (const m of matches) {
      if (m[1].length < shortest.length) {
        shortest = m[1];
      }
    }
    return shortest;
  }

  throwPatchError(
    'patch: getModuleLoaderFunction: failed to find module loader function'
  );
};

/**
 * Find the React module name
 */
export const getReactModuleNameNonBun = (fileContents: string): string => {
  // Pattern: var X=Y((Z)=>{var W=Symbol.for("react.element") or "react.transitional.element"
  const pattern =
    /var ([$\w]+)=[$\w]+\(\([$\w]+\)=>\{var [$\w]+=Symbol\.for\("react\.(transitional\.)?element"\)/;
  const match = fileContents.match(pattern);
  if (!match) {
    throwPatchError(
      'patch: getReactModuleNameNonBun: failed to find React module name'
    );
  }
  return match[1];
};

/**
 * Find the React module function (Bun variant)
 *
 * Steps:
 * 1. Get "reactModuleNameNonBun" via getReactModuleNameNonBun()
 * 2. Search for /var ([$\w]+)=[$\w]+\(\([$\w]+,[$\w]+\)=>\{[$\w]+\.exports=${reactModuleNameNonBun}\(\)/
 * 3. The first match is it
 *
 * Example code:
 * ```
 * var fH = N((AtM, r7L) => {
 *     r7L.exports = n7L();
 * });
 * ```
 * `n7L` is `reactModuleNameNonBun`, and `fH` is `reactModuleFunctionBun`
 */
export const getReactModuleFunctionBun = (fileContents: string): string => {
  const reactModuleNameNonBun = getReactModuleNameNonBun(fileContents);

  // Pattern: var X=Y((Z,W)=>{W.exports=reactModuleNameNonBun()
  const pattern = new RegExp(
    `var ([$\\w]+)=[$\\w]+\\(\\([$\\w]+,[$\\w]+\\)=>\\{[$\\w]+\\.exports=${escapeIdent(reactModuleNameNonBun)}\\(\\)`
  );
  const match = fileContents.match(pattern);
  if (!match) {
    throwPatchError(
      `patch: getReactModuleFunctionBun: failed to find React module function (Bun) (reactModuleNameNonBun=${reactModuleNameNonBun})`
    );
  }
  return match[1];
};

// Cache for React variable to avoid recomputing
let reactVarCache: string | null = null;

// Cache for require function name to avoid recomputing
let requireFuncNameCache: string | null = null;

/**
 * Get the React variable name (cached)
 */
export const getReactVar = (fileContents: string): string => {
  // Return cached value if available
  if (reactVarCache != null) {
    return reactVarCache;
  }

  const moduleLoader = getModuleLoaderFunction(fileContents);
  const reactModuleVarNonBun = getReactModuleNameNonBun(fileContents);

  // Pattern: X=moduleLoader(reactModule,1)
  const nonBunPattern = new RegExp(
    `[^$\\w]([$\\w]+)=${escapeIdent(moduleLoader)}\\(${escapeIdent(reactModuleVarNonBun)}\\(\\),1\\)`
  );
  const nonBunMatch = fileContents.match(nonBunPattern);
  if (nonBunMatch) {
    reactVarCache = nonBunMatch[1];
    return reactVarCache;
  } else {
    // DON'T fail just because we can't find the non-bun pattern.
  }

  // If reactModuleNameNonBun fails, try reactModuleFunctionBun
  const reactModuleFunctionBun = getReactModuleFunctionBun(fileContents);
  // ;([$\w]+)=T\(fH\(\),1\)
  // Pattern: ;X=moduleLoader(reactModuleBun,1)
  const bunPattern = new RegExp(
    `[^$\\w]([$\\w]+)=${escapeIdent(moduleLoader)}\\(${escapeIdent(reactModuleFunctionBun)}\\(\\),1\\)`
  );
  const bunMatch = fileContents.match(bunPattern);
  if (!bunMatch) {
    throwPatchError(
      `patch: getReactVar: failed to find bunPattern (moduleLoader=${moduleLoader}, reactModuleVarNonBun=${reactModuleVarNonBun}, reactModuleFunctionBun=${reactModuleFunctionBun})`
    );
  }

  reactVarCache = bunMatch[1];
  return reactVarCache;
};

/**
 * Clear the React var cache (useful for testing or multiple runs)
 */
export const clearReactVarCache = (): void => {
  reactVarCache = null;
};

/**
 * Find the require function variable name (no caching)
 *
 * This finds the variable name used to call require() in esbuild-bundled code.
 * Bun uses "require" directly, but esbuild uses a variable that points to
 * the result of createRequire(import.meta.url).
 *
 * Steps:
 * 1. Find the createRequire import: import{createRequire as X}from"node:module";
 * 2. Find the variable that calls it: var Y=X(import.meta.url)
 * 3. Return Y (the require function variable)
 */
export const findRequireFunc = (fileContents: string): string | undefined => {
  // Step 1: Find createRequire import
  // Pattern: import{createRequire as X}from"node:module";
  const createRequirePattern =
    /import\{createRequire as ([$\w]+)\}from"node:module";/;
  const createRequireMatch = fileContents.match(createRequirePattern);
  if (!createRequireMatch) {
    // If this is not found it's not necessarily a bug because we use its absence to detect Bun...
    // console.log(
    //   'patch: findRequireFunc: failed to find createRequire import'
    // );
    return undefined;
  }
  const createRequireVar = createRequireMatch[1];

  // Step 2: Find the variable that calls createRequire
  // Pattern: var X=createRequireVar(import.meta.url)
  const requireFuncPattern = new RegExp(
    `var ([$\\w]+)=${escapeIdent(createRequireVar)}\\(import\\.meta\\.url\\)`
  );
  const requireFuncMatch = fileContents.match(requireFuncPattern);
  if (!requireFuncMatch) {
    throwPatchError(
      `patch: findRequireFunc: failed to find require function variable (createRequireVar=${createRequireVar})`
    );
  }

  return requireFuncMatch[1];
};

/**
 * Get the appropriate require function name for the current environment (cached)
 *
 * - Bun native installations use "require" directly
 * - esbuild-bundled code uses a variable that points to createRequire(import.meta.url)
 *
 * This function detects which environment we're in and returns the correct name.
 *
 * @param fileContents The file content to analyze
 * @returns "require" for Bun, or the require function variable name for esbuild
 */
export const getRequireFuncName = (fileContents: string): string => {
  // Return cached value if available
  if (requireFuncNameCache != null) {
    return requireFuncNameCache;
  }

  // Try to find the esbuild-style require function
  const requireFunc = findRequireFunc(fileContents);

  // If we found it, we're in esbuild environment
  if (requireFunc) {
    requireFuncNameCache = requireFunc;
    return requireFuncNameCache;
  }

  // Otherwise, assume Bun environment which uses "require" directly
  requireFuncNameCache = 'require';
  return requireFuncNameCache;
};

/**
 * Clear the require func name cache (useful for testing or multiple runs)
 */
export const clearRequireFuncNameCache = (): void => {
  requireFuncNameCache = null;
};

/**
 * Clear all helper caches.
 *
 * Call this when processing multiple different cli.js files in one session.
 * The caches store minified variable names that are specific to each file.
 */
export const clearCaches = (): void => {
  clearReactVarCache();
  clearRequireFuncNameCache();
};

export const escapeForRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Find the Text component variable name from Ink
 */
export const findTextComponent = (fileContents: string): string => {
  // Find the Text component function definition from Ink.
  //
  // Pre-2.1.70: parameter destructuring
  //   function X({color:A,backgroundColor:B,dimColor:C=!1,bold:D=!1,...})
  //
  // 2.1.70+ (React Compiler): body destructuring
  //   function k(T){let _=Mj8.c(15),{color:R,backgroundColor:q,dimColor:A,...}=T
  //
  // Using {0,30} covers both: 2 chars before color in old style, ~22 in new style.
  const textComponentPattern =
    /\bfunction ([$\w]+).{0,30}color:[$\w]+,backgroundColor:[$\w]+,dimColor:[$\w]+(?:=![01])?,bold:[$\w]+(?:=![01])?/;
  const match = fileContents.match(textComponentPattern);
  if (!match) {
    throwPatchError('patch: findTextComponent: failed to find text component');
  }
  return match[1];
};

/**
 * Find the Box component variable name
 */
export const findBoxComponent = (fileContents: string): string => {
  // Method 2: Find Box by direct return of createElement("ink-box"...) (CC 2.1.20+)
  // Pattern: function NAME({children:T,...}){...createElement("ink-box",...),T)}
  const directReturnPattern =
    /function ([$\w]+)\(\{children:[$\w]+,flexWrap:[$\w]+.{0,2000}?\.createElement\("ink-box"/;
  const directReturnMatch = fileContents.match(directReturnPattern);
  if (directReturnMatch) {
    return directReturnMatch[1];
  }

  // Method 4: React Compiler cached Box (CC 2.1.80+)
  // CC 2.1.80-2.1.83: function NAME(_){let T=VAR.c(N),...{children:...,flexWrap:...
  //   (parameter is `_`, cache is the first named var)
  // CC 2.1.84+: function NAME(H){let _=VAR.c(42),...;if(_[0]!==H){let{children:C,flexWrap:V...
  //   (parameter is any ident, cache var is `_`, destructuring is inside if block)
  // Generalised: any single param, any cache var, `.{0,200}` to cross the `if` block boundary.
  const reactCompilerBoxPattern =
    /function ([$\w]+)\([$\w]+\)\{let [$\w]+=[$\w]+\.c\(\d+\).{0,200}children:[$\w]+,flexWrap:/;
  const reactCompilerBoxMatch = fileContents.match(reactCompilerBoxPattern);
  if (reactCompilerBoxMatch) {
    return reactCompilerBoxMatch[1];
  }

  throwPatchError(
    'patch: findBoxComponent: failed to find Box component (neither ink-box createElement nor displayName found)'
  );
};
