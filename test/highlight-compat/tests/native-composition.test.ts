import { describe, expect, it } from 'vitest';
import { Component, PackLoadError } from '../src/native/component.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { Runtime, foreign, invoke, release } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import type { NativePack } from '../src/native/component.ts';

function allocationControl(component:Component,pack:NativePack,owner:PilotDocument,expected:ReturnType<typeof nativeScopes>,size:number):void {
  const allocation=component.number('scope_compat_bytes_new',[size]);
  try {expect(nativeScopes(pack,owner)).toEqual(expected);}
  finally {component.call('scope_compat_bytes_delete',[allocation]);}
}

function webAccepts(runtime:Runtime,language:Foreign,query:string,source:string):boolean {
  const compiled=runtime.construct('Query',[language,query]), parser=runtime.construct('Parser');
  invoke(parser,'setLanguage',[language]); const tree=foreign(invoke(parser,'parse',[source]));
  try { const matches:unknown=invoke(compiled,'matches',[tree.rootNode]); return Array.isArray(matches)&&matches.length>0; }
  finally { release(tree); release(parser); release(compiled); }
}

function pack(query: string) {
  return Component.load().then(component => component.loadPack({id:'test',version:'1',languageId:'json',rootScope:'source.json',suffix:'.json',files:[{path:'control.scm',query}]}));
}
async function unsupportedOperator(operator:string):Promise<void> {
  try { await pack(`\n((number) @n (#${operator} @n "x"))`); throw new Error('Expected rejection'); }
  catch(error) {
    expect(error).toBeInstanceOf(PackLoadError);
    if(!(error instanceof PackLoadError)) throw error;
    expect(error.status).toBe(1); expect(error.detail).toBe(2); expect(error.operator).toBe(operator); expect(error.pattern).toBe(0);
    expect(error.message).toContain('control.scm:2');
  }
}
async function compose(query: string, source: string) {
  const scopes=await pack(query), owner=await PilotDocument.open('json',source);
  try {
    const result=nativeScopes(scopes,owner);
    if(result.status!==0) throw new Error(`Native status ${result.status}/${result.detail}`);
    return { rows:Array.from({length:result.segments.length/3},(_,i)=>[
      result.segments[i*3],result.segments[i*3+1],result.paths[result.segments[i*3+2]].map(id=>scopes.scopes[id]),
    ]), statistics:result.statistics };
  } finally { owner.dispose(); scopes.dispose(); }
}

describe('native composition on real JSON trees',()=>{
  it('chooses first pattern or higher priority and stacks captures within one pattern',async()=>{
    expect((await compose('(number) @first (number) @second','1')).rows).toEqual([[0,1,['source.json','first.json']]]);
    expect((await compose('(number) @first ((number) @second (#set! priority "10"))','1')).rows).toEqual([[0,1,['source.json','second.json']]]);
    expect((await compose('(number) @first @second','1')).rows).toEqual([[0,1,['source.json','first.json','second.json']]]);
    expect((await compose('(number) @child (document) @parent','1')).rows).toEqual([[0,1,['source.json','parent.json','child.json']]]);
    const duplicate=await compose('(number) @same @same','1');
    expect(duplicate.rows).toEqual([[0,1,['source.json','same.json']]]); expect(duplicate.statistics[4]).toBe(1);
    const rangeDuplicate=await compose('((number) @same @_a @_b (#make-range! "same" @_a @_b))','1');
    expect(rangeDuplicate.statistics[4]).toBe(1);
  });

  it('orders nesting and crossing ranges independently of query enumeration',async()=>{
    expect((await compose('(object) @object (array) @array (number) @number','{"x":[1]}')).rows).toEqual([
      [0,5,['source.json','object.json']], [5,6,['source.json','object.json','array.json']],
      [6,7,['source.json','object.json','array.json','number.json']], [7,8,['source.json','object.json','array.json']],
      [8,9,['source.json','object.json']],
    ]);
    const query='((array . (number) @_a (number) @_b (number) @_c .) (#make-range! "one" @_a @_b))\n'+
      '((array . (number) @_a (number) @_b (number) @_c .) (#make-range! "two" @_b @_c))';
    const expected=[[0,1,['source.json']],[1,3,['source.json','one.json']],[3,4,['source.json','one.json','two.json']],
      [4,6,['source.json','two.json']],[6,7,['source.json']]];
    expect((await compose(query,'[1,2,3]')).rows).toEqual(expected);
    const component=await Component.load(), scopes=await pack(query), owner=await PilotDocument.open('json','[1,2,3]');
    try {
      const first=nativeScopes(scopes,owner);
      for(let i=0;i<3;++i) {
        allocationControl(component,scopes,owner,first,997+i);
      }
      owner.borrow(scopes.sameLanguage,borrow=>{
        const explain=scopes.explain(borrow,{start:0,end:7});
        expect(explain.status).toBe(0);
        if(explain.status!==0) throw new Error('Expected explain');
        expect(Array.from(explain.intervals)).toEqual([1,4,1,0,0,0,0,0, 3,6,2,1,0,0,0,0]);
      });
    } finally { owner.dispose(); scopes.dispose(); }
  });

  it('drops terminators, keeps lone CR, and handles empty and malformed Unicode input',async()=>{
    expect((await compose('(number) @n','1\r\n2\n3\r')).rows).toEqual([
      [0,1,['source.json','n.json']],[1,3,[]],[3,4,['source.json','n.json']],[4,5,[]],
      [5,6,['source.json','n.json']],[6,7,['source.json']],
    ]);
    for(const source of ['', '\r', '\r\n', '\n\r\n\r', '\ufeff["😀","\ud800"]','[','@@@']) {
      const result=await compose('(document) @meta (ERROR) @invalid (MISSING) @missing',source);
      expect(result.rows.length===0).toBe(source.length===0);
    }
    expect((await compose('(ERROR) @invalid','@@@')).rows).toEqual([[0,3,['source.json','invalid.json']]]);
  });

  it('reports unsupported and malformed packs with operator, pattern and source location',async()=>{
    for(const operator of ['match?','not-match?','any-match?','any-not-match?','is?','is-not?','offset!','select-adjacent!','strip!','unknown!']) {
      await unsupportedOperator(operator);
    }
    for(const query of ['((number) @n (#eq? @n))','((number) @n (#eq? "x" @n))','((number) @n (#set! local "x"))',
      '((number) @n (#set! priority "-1"))','((number) @n (#set! priority "1001"))','(unknown_node) @n']) {
      await expect(pack(query)).rejects.toBeInstanceOf(PackLoadError);
    }
  });

  it('matches the accepted web predicate dialect for empty, mixed and unequal capture sets',async()=>{
    const runtime=await Runtime.load(), language=await runtime.language('json');
    const operators=['eq?','not-eq?','any-eq?','any-not-eq?','any-of?','not-any-of?'];
    const sources=['[]','[1]','[2]','[1,2]','[2,3]'];
    const truth=[[true,true,false,false,false,true],[true,false,true,false,true,false],
      [false,true,false,true,false,true],[false,false,true,true,false,false],[false,true,false,true,false,true]];
    for(let row=0;row<sources.length;++row) {
      for(let column=0;column<operators.length;++column) {
        const captures=row===0?'(string)? @_a':Array.from({length:row<3?1:2},()=>'(number) @_a').join(' ');
        const query=`((array ${captures}) @visible (#${operators[column]} @_a "1"))`;
        const native=await compose(query,sources[row]);
        expect(native.rows.some(entry=>Array.isArray(entry[2])&&entry[2].includes('visible.json')),`${sources[row]} ${operators[column]}`).toBe(truth[row][column]);
        expect(webAccepts(runtime,language,query,sources[row])).toBe(truth[row][column]);
      }
    }
    const pairs=[{source:'[1,2,2]',a:'(number) (number)',b:'(number)',truth:[false,false,true,true]},
      {source:'[2,1,2]',a:'(number) (number)',b:'(number)',truth:[false,false,true,true]},
      {source:'[2,1,2]',a:'(number)',b:'(number) (number)',truth:[true,true,true,true]},
      {source:'[2,2,1]',a:'(number)',b:'(number) (number)',truth:[true,true,true,true]},
      {source:'[]',a:'(number)*',b:'(number)*',truth:[true,true,false,false]},
      {source:'[1]',a:'(number)',b:'(number)*',truth:[false,false,false,false]}];
    for(const pair of pairs) {
      for(let i=0;i<4;++i) {
        const a=pair.a==='(number) (number)'?'(number) @_a (number) @_a':`${pair.a} @_a`;
        const b=pair.b==='(number) (number)'?'(number) @_b (number) @_b':`${pair.b} @_b`;
        const text=`((array . ${a} ${b} .) @visible (#${operators[i]} @_a @_b))`;
        const native=await compose(text,pair.source);
        expect(native.rows.some(entry=>Array.isArray(entry[2])&&entry[2].includes('visible.json'))).toBe(pair.truth[i]);
        expect(webAccepts(runtime,language,text,pair.source)).toBe(pair.truth[i]);
      }
    }
  });
});
