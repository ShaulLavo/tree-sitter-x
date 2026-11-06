import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { address, decodeExplain, decodeResult, nativeString, validateLayout, sourceSpan } from '../src/native/decode.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { loadJsonPack, nativeScopes, nativeDocument } from '../src/native/adapter.ts';
import { parseResult } from '../src/validate.ts';
import { Component } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import { Runtime, foreign, invoke, release } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { withBorrowed } from '../src/native/borrow.ts';
import { baselineScopes } from '../src/baselines/run.ts';
import { observeRuntimeAllocations } from './native-observer.ts';
import { fixtures } from '../src/fixtures/registry.ts';
import { originalFixtures } from '../src/original-fixtures.ts';

const allocations = observeRuntimeAllocations();
let observer: Foreign;
beforeAll(async () => {
  const runtime = await Runtime.load();
  observer = await runtime.extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm',import.meta.url))));
  invoke(observer,'scope_test_install');
});
afterAll(() => { try { if(observer) invoke(observer,'scope_test_reset'); } finally { allocations.restore(); } });

function resultHeap(): Uint8Array {
  const heap = new Uint8Array(256), words = new Uint32Array(heap.buffer);
  words.set([1,0,0,0,0,2,1,96,2,112,1,1,0,0,0],2);
  words.set([0,2,1],24);
  words.set([0xffffffff,0xffffffff,0,0],28);
  return heap;
}

async function checkJsonFixture(pack:NativePack,source:string,label:string,reference:'raw'|'product'):Promise<void> {
  const owner=await PilotDocument.open('json',source);
  try {
    const result=await nativeDocument(pack,owner,reference);
    expect(result.status,label).toBe('complete'); expect(parseResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
  } finally {owner.dispose();}
}

describe('native pilot contracts', () => {
  it('rejects unreadable headers and unrepresentable source spans before dereferencing', () => {
    const heap = new Uint8Array(128);
    for (const pointer of [0, 2, 72, 0xffffffff, NaN, -1, 1.5]) {
      expect(() => decodeResult(heap, pointer, { start: 0, end: 1 }, 1)).toThrow();
    }
    expect(() => validateLayout(heap, 32)).toThrow();
    for (const [address, length] of [[1, 1], [2, 0x80000000], [126, 2], [-1, 0], [NaN, 1]]) {
      expect(() => sourceSpan(heap, address, length)).toThrow();
    }
  });

  it('copies valid output and rejects every malformed header, path and segment shape', () => {
    const good = resultHeap();
    const decoded = decodeResult(good,8,{start:0,end:2},1);
    expect(decoded.status).toBe(0);
    if (decoded.status !== 0) throw new Error('Expected complete');
    good.fill(0);
    expect(Array.from(decoded.segments)).toEqual([0,2,1]);
    expect(decoded.paths).toEqual([[],[0]]);
    const mutations: readonly (readonly [number,number])[] = [
      [2,2], [3,5], [4,1], [5,1], [6,1], [7,3], [8,0], [9,0], [9,97], [9,248],
      [8,0xffffffff], [10,0], [11,0], [11,113], [11,252], [28,0], [29,0],
      [30,1], [31,1], [24,1], [25,0], [25,3], [26,2],
    ];
    for (const [index,value] of mutations) {
      const heap=resultHeap(); new Uint32Array(heap.buffer)[index]=value;
      expect(() => decodeResult(heap,8,{start:0,end:2},1), `word ${index}: ${value}`).toThrow();
    }
    for (const status of [1,2,3,4]) {
      const heap=resultHeap(), words=new Uint32Array(heap.buffer);
      words.set([1,status,status===1?16:status===2?23:0,0,0,2,0,0,0,0,0,0,0,0,0],2);
      expect(decodeResult(heap,8,{start:0,end:2},1).status).toBe(status);
      for (let index=8;index<17;++index) {
        words[index]=1;
        expect(() => decodeResult(heap,8,{start:0,end:2},1)).toThrow();
        words[index]=0;
      }
    }
    expect(address(-0x80000000)).toBe(0x80000000);
    expect(() => address(-0x80000001)).toThrow();
  });

  it('validates explain spans, failures and bounded UTF-8 strings', () => {
    const heap=new Uint8Array(256), words=new Uint32Array(heap.buffer);
    words.set([1,0,0,0,1,64],2); words.set([0,2,0,0,10,0,0,0],16);
    expect(decodeExplain(heap,8,{start:0,end:2},1,1).status).toBe(0);
    for (const [index,value] of [[7,252],[16,3],[17,3],[18,1],[19,1],[20,1001],[23,4]]) {
      const original=words[index]; words[index]=value;
      expect(() => decodeExplain(heap,8,{start:0,end:2},1,1)).toThrow(); words[index]=original;
    }
    words[3]=4; expect(() => decodeExplain(heap,8,{start:0,end:2},1,1)).toThrow();
    words[6]=words[7]=0; expect(decodeExplain(heap,8,{start:0,end:2},1,1).status).toBe(4);
    heap.fill(65,128); expect(() => nativeString(heap,128)).toThrow();
    heap[255]=0; expect(nativeString(heap,128).length).toBe(127);
    heap[128]=0xff; expect(() => nativeString(heap,128)).toThrow();
    expect(() => nativeString(heap,256)).toThrow();
  });

  it('returns a complete real JSON document and round trips its schema', async () => {
    const pack = await loadJsonPack();
    const owner = await PilotDocument.open('json', '{"a": [1, true, null]}\r\n');
    try {
      expect(nativeScopes(pack, owner).status).toBe(0);
      const result = await nativeDocument(pack, owner, 'raw');
      expect(result.status).toBe('complete');
      expect(parseResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
    } finally { owner.dispose(); pack.dispose(); }
    expect(() => nativeScopes(pack, owner)).toThrow();
  });

  it('observes a real baseline parse, then zero extra native parses on the same runtime', async () => {
    const runtime=await Runtime.load(), pack=await loadJsonPack();
    const owner=await PilotDocument.open('json','{"a":1}');
    const prototype=foreign(foreign(runtime.binding.Parser).prototype), original=prototype.parse;
    if(typeof original!=='function') throw new Error('Missing parser prototype');
    let parses=0;
    Object.defineProperty(prototype,'parse',{configurable:true,writable:true,value:function(this:Foreign,...args:unknown[]) { ++parses; return Reflect.apply(original,this,args); }});
    try {
      await baselineScopes('baseline:captures','json',owner.source);
      expect(parses).toBe(1);
      parses=0;
      const result=await nativeDocument(pack,owner,'product');
      expect(result.status).toBe('complete'); expect(parses).toBe(0);
    } finally { Object.defineProperty(prototype,'parse',{configurable:true,writable:true,value:original}); owner.dispose(); pack.dispose(); }
  });

  it.each([
    {languageId:'typescript',source:'const x: number = 1;',root:'source.ts',suffix:'.ts'},
    {languageId:'tsx',source:'const x = <div/>;',root:'source.tsx',suffix:'.tsx'},
  ])('observes zero extra parses for the $languageId tree control without a language pack',async control=>{
    const component=await Component.load();
    const pack=await component.loadPack({id:'parse-control',version:'test',languageId:control.languageId,rootScope:control.root,suffix:control.suffix,files:[{path:'parse-control.scm',query:'(program) @meta'}]});
    const owner=await PilotDocument.open(control.languageId,control.source);
    const prototype=foreign(foreign(component.runtime.binding.Parser).prototype), original=prototype.parse;
    if(typeof original!=='function') throw new Error('Missing parser prototype');
    let parses=0;
    Object.defineProperty(prototype,'parse',{configurable:true,writable:true,value:function(this:Foreign,...args:unknown[]) {++parses;return Reflect.apply(original,this,args);}});
    try {
      await baselineScopes('baseline:captures',control.languageId,control.source); expect(parses).toBe(1);
      parses=0; expect(nativeScopes(pack,owner).status).toBe(0); expect(parses).toBe(0);
    } finally { Object.defineProperty(prototype,'parse',{configurable:true,writable:true,value:original}); owner.dispose();pack.dispose(); }
  });

  it('keeps JavaScript explicitly deferred with a schema-valid reason',async()=>{
    const owner=await PilotDocument.open('javascript','let x=1');
    try {
      const result=await nativeDocument(undefined,owner,'raw');
      expect(result.status).toBe('unsupported'); expect(result.diagnostics.join(' ')).toContain('distinct variant');
      expect(parseResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
    } finally {owner.dispose();}
  });

  it('rejects deleted, foreign-buffer and other-language borrows before calling native code', async () => {
    const runtime=await Runtime.load(), language=await runtime.language('json'), other=await runtime.language('typescript');
    const buffer=runtime.construct('TextBuffer',['1']), different=runtime.construct('TextBuffer',['2']), parser=runtime.construct('Parser');
    invoke(parser,'setLanguage',[language]); const tree=foreign(invoke(parser,'parse',[buffer]));
    let calls=0, deleted=false;
    const consume=()=>{ ++calls; return 0; };
    try {
      withBorrowed(runtime,language,tree,buffer,1,()=>true,consume); expect(calls).toBe(1);
      expect(()=>withBorrowed(runtime,language,tree,different,1,()=>true,consume)).toThrow('source buffer');
      expect(()=>withBorrowed(runtime,other,tree,buffer,1,()=>true,consume)).toThrow('language');
      expect(()=>withBorrowed(runtime,language,tree,buffer,1,()=>false,consume)).toThrow('language');
      release(tree); deleted=true;
      expect(()=>withBorrowed(runtime,language,tree,buffer,1,()=>true,consume)).toThrow('Deleted');
      expect(calls).toBe(1);
    } finally { if(!deleted) release(tree); release(parser); release(buffer); release(different); }
  });

  it('observes all native owners, retained-result deltas, failure cleanup and repeated release', async () => {
    const component=await Component.load(), pack=await loadJsonPack();
    const warm=await PilotDocument.open('json','{"x":[1,2]}'); nativeScopes(pack,warm); warm.dispose();
    const baseline=allocations.live(), blocks=component.liveAllocations();
    const language=await component.runtime.language('json');
    const coreQuery=component.runtime.construct('Query',[language,'(number) @core']);
    expect(allocations.live()).toBeGreaterThan(baseline);
    release(coreQuery); expect(allocations.live()).toBe(baseline);
    const bufferOnly=component.runtime.construct('TextBuffer',['native buffer control']);
    expect(allocations.live()).toBeGreaterThan(baseline);
    release(bufferOnly); expect(allocations.live()).toBe(baseline);
    const retained=await PilotDocument.open('json','{"x":[1,2]}');
    expect(allocations.live()).toBeGreaterThan(baseline);
    retained.dispose(); expect(allocations.live()).toBe(baseline);
    try {
      for(let i=0;i<100;++i) {
        const owner=await PilotDocument.open('json','{"x":[1,2]}');
        expect(nativeScopes(pack,owner).status).toBe(0);
        owner.dispose();
        expect(allocations.live()).toBe(baseline); expect(component.liveAllocations()).toBe(blocks);
      }
      const owner=await PilotDocument.open('json','1');
      try {
        owner.borrow(pack.sameLanguage,borrow=> {
          const before=component.liveAllocations();
          const pointer=pack.withHandle(handle=>component.number('scope_compat_run',[handle,borrow.tree,borrow.source,1,1,0,1,0,0,0]));
          try { expect(component.liveAllocations()).toBeGreaterThan(before); }
          finally { component.call('scope_compat_result_delete',[pointer]); }
          expect(component.liveAllocations()).toBe(before);
          expect(()=>component.withResult(pack,borrow,{start:0,end:1},{},(heap,pointer)=>decodeResult(heap,pointer,{start:0,end:1},0))).toThrow();
          expect(()=>component.withExplain(pack,borrow,{start:0,end:1},{},(heap,pointer)=>decodeExplain(heap,pointer,{start:0,end:1},0,1))).toThrow();
          expect(component.liveAllocations()).toBe(before);
        });
      } finally { owner.dispose(); }
      expect(allocations.live()).toBe(baseline);
      await expect(component.loadPack({id:'bad',version:'test',languageId:'json',rootScope:'source.json',suffix:'.json',files:[{path:'bad.scm',query:'((number) @n (#match? @n "x"))'}]})).rejects.toThrow('bad.scm:1');
      expect(allocations.live()).toBe(baseline); expect(component.liveAllocations()).toBe(blocks);
      const number=Component.prototype.number;
      Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:function(this:Component,name:string,args:readonly number[]=[]) {
        return name==='scope_compat_pack_scope_name'?this.runtime.heap().length:number.call(this,name,args);
      }});
      try { await expect(loadJsonPack()).rejects.toThrow(); }
      finally { Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:number}); }
      expect(allocations.live()).toBe(baseline); expect(component.liveAllocations()).toBe(blocks);
      let grow=true;
      Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:function(this:Component,name:string,args:readonly number[]=[]) {
        const pointer=number.call(this,name,args);
        if(name==='scope_compat_pack_scope_name'&&grow) {
          grow=false;
          const temporary=number.call(this,'scope_compat_bytes_new',[this.runtime.heap().length*2]);
          this.call('scope_compat_bytes_delete',[temporary]);
        }
        return pointer;
      }});
      try {const grown=await loadJsonPack(); grown.dispose();}
      finally {Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:number});}
      expect(allocations.live()).toBe(baseline); expect(component.liveAllocations()).toBe(blocks);
      expect(allocations.calls.get('free')).toBeGreaterThan(0);
    } finally { pack.dispose(); }
  });

  it('unwinds native parser and TextBuffer resources on constructor failure', async () => {
    const runtime=await Runtime.load(); await runtime.language('json');
    const proto=foreign(foreign(runtime.binding.Parser).prototype);
    for(const key of ['setLanguage','parse']) {
      const original=proto[key], baseline=allocations.live();
      Object.defineProperty(proto,key,{configurable:true,writable:true,value:()=>{throw new Error(`injected ${key}`);}});
      try { await expect(PilotDocument.open('json','1')).rejects.toThrow(`injected ${key}`); }
      finally { Object.defineProperty(proto,key,{configurable:true,writable:true,value:original}); }
      expect(allocations.live()).toBe(baseline);
    }
    const original=proto.parse, baseline=allocations.live();
    Object.defineProperty(proto,'parse',{configurable:true,writable:true,value:()=>null});
    try { await expect(PilotDocument.open('json','1')).rejects.toThrow('no tree'); }
    finally { Object.defineProperty(proto,'parse',{configurable:true,writable:true,value:original}); }
    expect(allocations.live()).toBe(baseline);
  });

  it('passes the owner buffer address directly and keeps mutable handles private',async()=>{
    const pack=await loadJsonPack(), owner=await PilotDocument.open('json','[1,2]');
    const original=Component.prototype.number;
    let source=0, seen=0;
    owner.borrow(pack.sameLanguage,borrow=>{source=borrow.source;});
    Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:function(this:Component,name:string,args:readonly number[]=[]) {
      if(name==='scope_compat_run') {seen=args[2];}
      return original.call(this,name,args);
    }});
    try {
      expect(Object.isFrozen(owner)).toBe(true); expect(Reflect.set(owner,'source','stale')).toBe(false);
      expect('tree' in owner).toBe(false); expect('buffer' in owner).toBe(false);
      expect(nativeScopes(pack,owner,{start:1,end:4}).status).toBe(0); expect(seen).toBe(source);
      const empty=nativeScopes(pack,owner,{start:2,end:2});
      expect(empty.status).toBe(0); if(empty.status===0) expect(empty.segments.length).toBe(0);
    } finally { Object.defineProperty(Component.prototype,'number',{configurable:true,writable:true,value:original}); owner.dispose(); pack.dispose(); }
  });

  it('reacquires memory after growth during a pass and settles on a 4 MiB source', async () => {
    const component=await Component.load(), pack=await loadJsonPack();
    const owner=await PilotDocument.open('json',' '.repeat(2*1024*1024-2)+'{}');
    try {
      nativeScopes(pack,owner);
      const oldLength=component.runtime.heap().length; allocations.growOnNextAllocation();
      expect(nativeScopes(pack,owner).status).toBe(0);
      expect(component.runtime.heap().length).toBeGreaterThan(oldLength);
      const capacity=component.runtime.heap().length, blocks=component.liveAllocations(), core=allocations.live();
      for(let i=0;i<10;++i) expect(nativeScopes(pack,owner).status).toBe(0);
      expect(component.runtime.heap().length).toBe(capacity);
      expect(component.liveAllocations()).toBe(blocks); expect(allocations.live()).toBe(core);
    } finally { owner.dispose(); pack.dispose(); }
  });

  it('returns explicit statuses without partial output for encoding, source and work limits',async()=>{
    const pack=await loadJsonPack(), owner=await PilotDocument.open('json','[1,2]');
    try {
      owner.borrow(pack.sameLanguage,borrow=>{
        expect(pack.run(borrow,{start:0,end:5},{encoding:2})).toEqual({status:1,detail:16,value:2});
        expect(pack.run({...borrow,length:1},{start:0,end:1})).toEqual({status:3,detail:20,value:10});
        expect(pack.run(borrow,{start:0,end:5},{maxIntervals:1}).status).toBe(2);
        expect(pack.run(borrow,{start:0,end:5},{maxSegments:1}).status).toBe(2);
        expect(()=>pack.run({...borrow,source:borrow.source+1},{start:0,end:5})).toThrow();
        expect(()=>pack.run({...borrow,length:0x80000000},{start:0,end:5})).toThrow();
        expect(()=>pack.run({...borrow,source:0xffffffff},{start:0,end:5})).toThrow();
        expect(()=>pack.run(borrow,{start:-1,end:5})).toThrow();
      });
      const reversed=await (await Component.load()).loadPack({id:'reverse',version:'1',languageId:'json',rootScope:'source.json',suffix:'.json',
        files:[{path:'reverse.scm',query:'((array . (number) @_last (number) @_first .) (#make-range! "meta" @_first @_last))'}]});
      try { expect(nativeScopes(reversed,owner).status).toBe(3); } finally { reversed.dispose(); }
    } finally { owner.dispose(); pack.dispose(); }
  });

  it('completes every real and original JSON fixture without changing the corpus',async()=>{
    const pack=await loadJsonPack();
    const real=fixtures.filter(fixture=>fixture.languageId==='json');
    const original=originalFixtures().filter(fixture=>fixture.languageId==='json');
    expect(real.length+original.length).toBeGreaterThan(0);
    try {
      for(const fixture of real) {
        await checkJsonFixture(pack,await readFile(new URL(`../${fixture.path}`,import.meta.url),'utf8'),fixture.id,'raw');
      }
      for(const fixture of original) {
        await checkJsonFixture(pack,fixture.source,fixture.fixtureId,'product');
      }
    } finally { pack.dispose(); }
  });
});
