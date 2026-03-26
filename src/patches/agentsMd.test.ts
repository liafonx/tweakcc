import { describe, it, expect } from 'vitest';
import { writeAgentsMd } from './agentsMd';

// CC 2.1.80+: split-reader — XmK reads file, tq7 processes, eq7 handles errors
// function XmK(_,T){try{let K=OT().readFileSync(_,{encoding:"utf-8"});return tq7(K,_,T)}catch(q){return eq7(q,_),null}}
const mockSplitReader =
  'function XmK(_,T){try{' +
  'let K=OT().readFileSync(_,{encoding:"utf-8"});' +
  'return tq7(K,_,T)' +
  '}catch(q){return eq7(q,_),null}}';

const altNames = ['AGENTS.md', 'GEMINI.md', 'QWEN.md'];

describe('agentsMd', () => {
  describe('writeAgentsMd (CC 2.1.80+ split-reader)', () => {
    it('should inject ENOENT fallback in catch block', () => {
      const result = writeAgentsMd(mockSplitReader, altNames);
      expect(result).not.toBeNull();
      expect(result).toContain('didReroute');
      expect(result).toContain('endsWith("/CLAUDE.md")');
      expect(result).toContain('AGENTS.md');
    });

    it('should add didReroute parameter to function signature', () => {
      const result = writeAgentsMd(mockSplitReader, altNames)!;
      expect(result).toContain('function XmK(_,T,didReroute)');
    });

    it('should use recursive call with didReroute=true', () => {
      const result = writeAgentsMd(mockSplitReader, altNames)!;
      expect(result).toContain('let r=XmK(altPath,T,true)');
      expect(result).toContain('if(r)return r');
    });

    it('should preserve the original error handler call', () => {
      const result = writeAgentsMd(mockSplitReader, altNames)!;
      expect(result).toContain('return eq7(q,_),null');
    });
  });

  describe('null-return case', () => {
    it('should return null when no pattern matches', () => {
      const result = writeAgentsMd('not a valid file', altNames);
      expect(result).toBeNull();
    });
  });
});

// CC 2.1.83+: async sLq(path,type,resolvedPath) reads via readFile, returns {info,includePaths}
// async function sLq(_,T,q){try{let $=await AT().readFile(_,{encoding:"utf-8"});return gUK($,_,T,q)}catch(K){return dUK(K,_),{info:null,includePaths:[]}}}
const mockAsyncReader =
  'async function sLq(_,T,q){' +
  'try{' +
  'let $=await AT().readFile(_,{encoding:"utf-8"});' +
  'return gUK($,_,T,q)' +
  '}catch(K){' +
  'return dUK(K,_),{info:null,includePaths:[]}' +
  '}}';

describe('agentsMd (CC 2.1.83+ async reader)', () => {
  it('should inject ENOENT fallback in catch block', () => {
    const result = writeAgentsMd(mockAsyncReader, altNames);
    expect(result).not.toBeNull();
    expect(result).toContain('didReroute');
    expect(result).toContain('endsWith("/CLAUDE.md")');
    expect(result).toContain('AGENTS.md');
  });

  it('should add didReroute parameter to function signature', () => {
    const result = writeAgentsMd(mockAsyncReader, altNames)!;
    expect(result).toContain('async function sLq(_,T,q,didReroute)');
  });

  it('should use async recursive call with didReroute=true', () => {
    const result = writeAgentsMd(mockAsyncReader, altNames)!;
    expect(result).toContain('let r=await sLq(altPath,T,altPath,true)');
    expect(result).toContain('if(r.info)return r');
  });

  it('should preserve the original error handler', () => {
    const result = writeAgentsMd(mockAsyncReader, altNames)!;
    expect(result).toContain('return dUK(K,_),{info:null,includePaths:[]}');
  });
});
