import { describe, expect, it } from 'vitest';
import { normalizeTheme, normalizedPacket, snapshotInput } from '../src/native/theme-input.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';
import { decodeThemeMatch, decodeThemeResult, nativeFailure, validateThemeLayout, THEME_LAYOUT } from '../src/native/theme-decode.ts';
import type { AcquiredInput, Outcome, Profile } from '../src/native/theme-contract.ts';

function value<T>(result: Outcome<T>): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
}
function acquired(document: unknown): AcquiredInput {
  return {root:'theme',resources:[{id:'theme',format:'json',bytes:new TextEncoder().encode(JSON.stringify(document))}],edges:[]};
}
function normalized(document: unknown, profile: Profile = 'raw') {
  return normalizeTheme(value(snapshotInput(acquired(document))),profile,'pinned-test-target');
}
describe('native theme acquisition and normalization', () => {
  it('owns exact bytes and distinguishes same-name content and profiles', () => {
    const input = acquired({name:'same',tokenColors:[{scope:'variable',settings:{foreground:'#12345678',fontStyle:''}}]});
    const snapshot = value(snapshotInput(input));
    const before = value(normalizeTheme(snapshot,'raw','target'));
    input.resources[0].bytes.fill(32);
    const after = value(normalizeTheme(snapshot,'raw','target'));
    expect(after.contentRevision).toBe(before.contentRevision);
    expect(normalizedPacket(after)).toEqual(normalizedPacket(before));
    expect(value(normalized({name:'same',tokenColors:[{scope:'variable',settings:{foreground:'#12345679'}}]})).contentRevision).not.toBe(before.contentRevision);
    expect(value(normalizeTheme(snapshot,'product','target')).contentRevision).not.toBe(before.contentRevision);
    const first = normalizedPacket(before); first.fill(0);
    expect(normalizedPacket(before)[0]).toBe(0x53);
  });
  it('requires a complete authorized acyclic include closure and hashes included bytes', () => {
    const root = {id:'root',format:'json' as const,bytes:new TextEncoder().encode('{"include":"base","tokenColors":[]}')};
    const base = {id:'base',format:'json' as const,bytes:new TextEncoder().encode('{"tokenColors":[]}')};
    const input = {root:'root',resources:[root,base],edges:[{from:'root',to:'base',ordinal:0}]};
    const first = value(snapshotInput(input));
    expect(snapshotInput({...input,edges:[]})).toMatchObject({kind:'invalid',code:'include-graph'});
    expect(snapshotInput({...input,edges:[{from:'root',to:'missing',ordinal:0}]})).toMatchObject({kind:'invalid',code:'include-authority'});
    expect(snapshotInput({...input,edges:input.edges.concat(input.edges)})).toMatchObject({kind:'invalid',code:'include-graph'});
    base.bytes = new TextEncoder().encode('{"include":"root"}');
    expect(snapshotInput({...input,edges:input.edges.concat([{from:'base',to:'root',ordinal:0}])})).toMatchObject({kind:'invalid',code:'include-graph'});
    base.bytes = new TextEncoder().encode('{ "tokenColors": [] }');
    expect(value(snapshotInput(input)).acquisitionRevision).not.toBe(first.acquisitionRevision);
  });
  it('honors zero, exact and first-over input caps', () => {
    const input = acquired({});
    expect(snapshotInput(input,{inputBytes:2})).toMatchObject({kind:'ok'});
    expect(snapshotInput(input,{inputBytes:1})).toMatchObject({kind:'budget',code:'input-bytes',limit:1});
    expect(snapshotInput(input,{resources:0})).toMatchObject({kind:'budget',code:'resources',limit:0});
    expect(snapshotInput(input,{includeDepth:0})).toMatchObject({kind:'ok'});
    expect(snapshotInput(input,{rules:-1})).toMatchObject({kind:'invalid',code:'schema'});
    expect(snapshotInput(input,{rules:0.5})).toMatchObject({kind:'invalid',code:'schema'});
    expect(snapshotInput(input,{rules:65537})).toMatchObject({kind:'invalid',code:'schema'});
  });
  it.each([
    ['a > > b','invalid','selector'],['a>b','invalid','selector'],['a  b','invalid','selector'],
    ['a\tb','invalid','selector'],['a,','invalid','selector'],['*','unsupported','selector'],
    ['a - b','unsupported','selector'],['a | b','unsupported','selector'],['L:a','unsupported','selector'],
    ['a.__proto__','unsupported','trie-tail-atom'],['hasOwnProperty','unsupported','trie-tail-atom'],
  ])('rejects selector %s as %s/%s', (scope,kind,code) => {
    expect(normalized({tokenColors:[{scope,settings:{foreground:'#123'}}]})).toMatchObject({kind,code});
  });
  it('accepts context special names and constructor tails, and rejects comma array members', () => {
    expect(normalized({tokenColors:[{scope:'__proto__ > constructor',settings:{foreground:'#0000'}}]})).toMatchObject({kind:'ok'});
    expect(normalized({tokenColors:[{scope:['a,b'],settings:{foreground:'#123'}}]})).toMatchObject({kind:'invalid',code:'selector'});
    expect(normalized({tokenColors:[{scope:[],settings:{foreground:'#123'}}]})).toMatchObject({kind:'invalid',code:'selector'});
  });
  it.each([
    [{foreground:'#12'},'invalid','color'],[{foreground:'red'},'unsupported','color-format'],
    [{foreground:null},'invalid','schema'],[{fontStyle:'   '},'invalid','font-style'],
    [{fontStyle:'bold  italic'},'invalid','font-style'],[{fontStyle:'other'},'unsupported','font-style'],
    [{fontStyle:1},'invalid','schema'],[{other:true},'unsupported','syntax-property'],
  ])('returns exact property diagnostics for %j', (settings,kind,code) => {
    expect(normalized({tokenColors:[{scope:'a',settings}]})).toMatchObject({kind,code,location:{kind:'setting',resource:'theme',rule:0}});
  });
  it('keeps transparent black present and serializes RGBA words little endian', () => {
    const packet = normalizedPacket(value(normalized({tokenColors:[{scope:'a',settings:{foreground:'#12345678',background:'#0000',fontStyle:''}}]})));
    const view = new DataView(packet.buffer), at = view.getUint32(16,true) + 36;
    expect(view.getUint32(at+20,true)).toBe(7);
    expect(Array.from(packet.subarray(at+24,at+28))).toEqual([0x78,0x56,0x34,0x12]);
    expect(view.getUint32(at+28,true)).toBe(0);
    expect(view.getUint32(at+32,true)).toBe(0);
  });
  it('bounds the raw palette while keeping product separate', () => {
    const tokenColors = Array.from({length:254},(_,i) => ({scope:`s${i}`,settings:{foreground:`#${(i+1).toString(16).padStart(6,'0')}`}}));
    // Explicit black/white defaults avoid counting the raw adapter's extra fallback colors.
    const colors = {'editor.foreground':'#000000','editor.background':'#ffffff'};
    expect(normalized({colors,tokenColors:tokenColors.slice(0,253)})).toMatchObject({kind:'ok'});
    expect(normalized({colors,tokenColors})).toMatchObject({kind:'unsupported',code:'raw-palette'});
    expect(normalized({colors,tokenColors},'product')).toMatchObject({kind:'ok'});
  });
});
describe('request-owned paths and strict theme decoding', () => {
  it('interns shared parent-first paths and preserves distinct full stacks', () => {
    const result = value(encodePathPacket([[],['source'],['source','a'],['source','a'],['a']]));
    expect(result.count).toBe(4); expect(result.ids).toEqual([0,1,2,2,3]);
    expect(encodePathPacket([['a']],{paths:1})).toMatchObject({kind:'budget',code:'paths',limit:1});
    expect(encodePathPacket([],{paths:0})).toMatchObject({kind:'ok',value:{count:0}});
    expect(() => encodePathPacket([['a\ud800']])).toThrow('Invalid decoded scope name');
  });
  it('rejects unknown layouts, statuses, short spans and failed arrays', () => {
    const heap = new Uint8Array(256), view = new DataView(heap.buffer);
    THEME_LAYOUT.forEach((word,i) => view.setUint32(4+i*4,word,true));
    expect(() => validateThemeLayout(heap,4)).not.toThrow();
    view.setUint32(8,28,true); expect(() => validateThemeLayout(heap,4)).toThrow();
    expect(() => decodeThemeResult(heap,252,0)).toThrow();
    expect(() => nativeFailure(5,120,0,{kind:'request'})).toThrow();
    [1,2,117,12,0,0].forEach((word,i) => view.setUint32(4+i*4,word,true));
    expect(decodeThemeResult(heap,4,1)).toMatchObject({kind:'budget',code:'output-bytes',limit:12});
    view.setUint32(20,1,true); expect(() => decodeThemeResult(heap,4,1)).toThrow('Nonempty failed');
    [1,0,0,0,1,64].forEach((word,i) => view.setUint32(4+i*4,word,true));
    [0,1,0,0,0,0].forEach((word,i) => view.setUint32(64+i*4,word,true));
    expect(() => decodeThemeMatch(heap,4)).toThrow('Invalid native theme partial');
  });
});
