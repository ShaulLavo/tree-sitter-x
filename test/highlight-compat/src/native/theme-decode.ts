import { span } from './decode.ts';
import { NONE } from './theme-contract.ts';
import type { BudgetCode, EffectiveStyle, Failure, Field, Location, Outcome, PartialMatch } from './theme-contract.ts';

export const THEME_LAYOUT = [30,24,4,0,4,8,12,16,20,12,4,0,4,8,24,4,0,4,8,12,16,20,24,4,0,4,8,12,16,20];
export function validateThemeLayout(heap: Uint8Array, pointer: number): void {
  span(heap,pointer,THEME_LAYOUT.length,4,4);
  const view = new DataView(heap.buffer,heap.byteOffset,heap.byteLength);
  if (THEME_LAYOUT.some((value,index) => view.getUint32(pointer + index*4,true) !== value)) throw new Error('Invalid native theme layout');
}
const BUDGETS: ReadonlyMap<number,BudgetCode> = new Map([[106,'input-bytes'],[107,'rules'],[108,'atoms'],[109,'context-edges'],
  [110,'atom-bytes'],[111,'context-atoms'],[112,'compile-steps'],[113,'trie-nodes'],[114,'context-rules'],[115,'owned-bytes'],
  [116,'resolve-steps'],[117,'output-bytes'],[118,'paths'],[119,'packet-bytes']]);
export function nativeFailure(status: number, detail: number, value: number, location: Location): Failure {
  if (status === 4 && detail === 120) return {kind:'no-memory',code:'allocation',location};
  if (status === 1 && detail === 102) return {kind:'unsupported',code:'trie-tail-atom',location};
  if (status === 3 && detail >= 100 && detail <= 105) return {kind:'invalid',code:'packet',location};
  const code = BUDGETS.get(detail);
  if (status === 2 && code) return {kind:'budget',code,limit:value,location};
  throw new Error(`Invalid native theme status/detail ${status}/${detail}`);
}
function header(heap: Uint8Array, pointer: number, expected: number): { readonly kind:'ok'; readonly view:DataView; readonly count:number; readonly records:number } | Failure {
  span(heap,pointer,6,4,4);
  const view = new DataView(heap.buffer,heap.byteOffset,heap.byteLength);
  const values = Array.from({length:6},(_,index) => view.getUint32(pointer + index*4,true));
  const [abi,status,detail,value,count,records] = values;
  if (abi !== 1) throw new Error('Invalid native theme result ABI');
  if (status !== 0) {
    if (count || records) throw new Error('Nonempty failed native theme result');
    return nativeFailure(status,detail,value,{kind:'request'});
  }
  if (detail || value || count !== expected || (count === 0 && records !== 0)) throw new Error('Invalid native theme result header');
  return {kind:'ok',view,count,records};
}
function style(view: DataView, at: number): EffectiveStyle {
  const foreground = view.getUint32(at,true), background = view.getUint32(at+4,true), fontMask = view.getUint32(at+8,true);
  if (fontMask > 15) throw new Error('Invalid native theme font mask');
  return Object.freeze({foreground,background,fontMask});
}
export function decodeThemeResult(heap: Uint8Array, pointer: number, expected: number): Outcome<readonly EffectiveStyle[]> {
  const result = header(heap,pointer,expected);
  if (result.kind !== 'ok') return result;
  if (result.count) span(heap,result.records,result.count,12,4);
  return {kind:'ok',value:Object.freeze(Array.from({length:result.count},(_,index) => style(result.view,result.records+index*12))),warnings:[]};
}
function field(present: number, bit: number, value: number): Field<number> {
  return present & bit ? Object.freeze({kind:'set',value}) : Object.freeze({kind:'inherit'});
}
export function decodeThemeMatch(heap: Uint8Array, pointer: number): Outcome<PartialMatch> {
  const result = header(heap,pointer,1);
  if (result.kind !== 'ok') return result;
  span(heap,result.records,1,24,4);
  const values = Array.from({length:6},(_,index) => result.view.getUint32(result.records+index*4,true));
  const [present,foreground,background,fontMask,rule,alternative] = values;
  if (present > 7 || fontMask > 15 || (!(present&1) && foreground) || (!(present&2) && background) || (!(present&4) && fontMask))
    throw new Error('Invalid native theme partial style');
  if ((rule === NONE) !== (alternative === NONE)) throw new Error('Invalid native theme match identity');
  return {kind:'ok',value:Object.freeze({rule,alternative,style:Object.freeze({
    foreground:field(present,1,foreground),
    background:field(present,2,background),
    fontMask:field(present,4,fontMask),
  })} satisfies PartialMatch),warnings:[]};
}
