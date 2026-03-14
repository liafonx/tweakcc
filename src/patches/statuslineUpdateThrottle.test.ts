import { describe, expect, it } from 'vitest';

import { writeStatuslineUpdateThrottle } from './statuslineUpdateThrottle';

describe('writeStatuslineUpdateThrottle', () => {
  it('rewrites an existing supported callback-wrapper form to a throttle', () => {
    const result = writeStatuslineUpdateThrottle(
      'x=1,O=Pc.useCallback(async()=>{let D=statusLineText;return D},[_,A]),' +
        'W=Gr(()=>O(A),300),tail'
    );

    expect(result).not.toBeNull();
    expect(result).toContain('lastCall=Pc.useRef(0)');
    expect(result).toContain(
      'W=Pc.useCallback(()=>{let now=Date.now();if(now-lastCall.current>=300){lastCall.current=now;O(A);}},[O, A])'
    );
    expect(result).not.toContain('Gr(()=>O(A),300)');
  });

  it('rewrites the CC 2.1.76 timeout callback form to a throttle', () => {
    const result = writeStatuslineUpdateThrottle(
      'x=1,' +
        'J=pw.useCallback(async()=>{q.current?.abort();let Z=new AbortController();q.current=Z;try{let D=await foo(statusLineText,Z.signal);if(!Z.signal.aborted)w(j=>({...j,statusLineText:D}))}catch{}},[_,A]),' +
        'W=pw.useCallback(()=>{if(Y.current!==void 0)clearTimeout(Y.current);Y.current=setTimeout((Z,N)=>{Z.current=void 0,N()},300,Y,J)},[J]),tail'
    );

    expect(result).not.toBeNull();
    expect(result).toContain('lastCall=pw.useRef(0)');
    expect(result).toContain(
      'W=pw.useCallback(()=>{let now=Date.now();if(now-lastCall.current>=300){lastCall.current=now;J();}},[J])'
    );
    expect(result).not.toContain(
      'setTimeout((Z,N)=>{Z.current=void 0,N()},300,Y,J)'
    );
  });

  it('returns null when the pattern is absent', () => {
    const result = writeStatuslineUpdateThrottle(
      'const x=pw.useCallback(()=>doSomethingElse(),[])'
    );

    expect(result).toBeNull();
  });
});
