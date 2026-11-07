import { Component } from './component.ts';
import { span, u32 } from './decode.ts';
import { COMPILE_DEFAULTS, RESOLVE_DEFAULTS, NONE, attempt, limits } from './theme-contract.ts';
import type { CompileLimits, EffectiveStyle, OperationalFailure, Outcome, PartialMatch, ResolveLimits } from './theme-contract.ts';
import { decodeThemeMatch, decodeThemeResult, nativeFailure, validateThemeLayout } from './theme-decode.ts';
import type { PathPacket } from './theme-packet.ts';
import { normalizedPacket } from './theme-input.ts';
import type { NormalizedTheme } from './theme-input.ts';

const allocation = {kind:'no-memory',code:'allocation',location:{kind:'request'}} satisfies Outcome<never>;
function withBytes<T>(component: Component, bytes: Uint8Array, action: (pointer: number) => Outcome<T>): Outcome<T> {
  const pointer = component.number('scope_compat_bytes_new',[bytes.length]);
  if (!pointer) return allocation;
  try {
    const heap = component.runtime.heap(); span(heap,pointer,bytes.length,1,1); heap.set(bytes,pointer);
    return action(pointer);
  } finally { component.call('scope_compat_bytes_delete',[pointer]); }
}
export interface ThemeLease { readonly theme: NativeTheme; release(): void }
export class NativeTheme {
  readonly #component: Component;
  #pointer: number;
  #references = 1;
  #disposed = false;
  private constructor(component: Component, pointer: number) { this.#component = component; this.#pointer = pointer; }
  static compile(input: NormalizedTheme, options: Partial<CompileLimits> = {}): Promise<Outcome<NativeTheme> | OperationalFailure> {
    return NativeTheme.compilePacket(normalizedPacket(input),options);
  }
  static async compilePacket(packet: Uint8Array, options: Partial<CompileLimits> = {}): Promise<Outcome<NativeTheme> | OperationalFailure> {
    const checked = attempt(() => limits(COMPILE_DEFAULTS,options));
    if (checked.kind !== 'ok') return checked;
    const ownedPacket = packet.slice();
    let component: Component;
    try { component = await Component.load(); }
    catch { return {kind:'error',code:'runtime-failed',location:{kind:'request'}}; }
    if (component.number('scope_compat_theme_abi_version') !== 1) throw new Error('Invalid theme ABI');
    validateThemeLayout(component.runtime.heap(),component.number('scope_compat_theme_layout'));
    return withBytes(component,ownedPacket,pointer => NativeTheme.construct(component,pointer,ownedPacket.length,checked.value));
  }
  private static construct(component: Component, packet: number, length: number, bounds: CompileLimits): Outcome<NativeTheme> {
    const pointer = component.number('scope_compat_theme_new',[packet,length,bounds.steps,bounds.trieNodes,bounds.contextRules,bounds.ownedBytes]);
    if (!pointer) return allocation;
    let retained = false;
    try {
      const status = component.number('scope_compat_theme_status',[pointer]);
      if (!status) { retained = true; return {kind:'ok',value:new NativeTheme(component,pointer),warnings:[]}; }
      const detail = component.number('scope_compat_theme_detail',[pointer]), value = component.number('scope_compat_theme_detail_value',[pointer]);
      const offset = component.number('scope_compat_theme_error_offset',[pointer]);
      return nativeFailure(status,detail,value,offset === NONE ? {kind:'request'} : {kind:'packet',byteOffset:offset});
    } finally { if (!retained) component.call('scope_compat_theme_delete',[pointer]); }
  }
  retain(): ThemeLease {
    this.assertLive(); ++this.#references;
    let released = false;
    return {theme:this,release:() => { if (released) return; released = true; this.release(); }};
  }
  dispose(): void { if (this.#disposed) return; this.#disposed = true; this.release(); }
  private release(): void {
    if (--this.#references) return;
    const pointer = this.#pointer; this.#pointer = 0; this.#component.call('scope_compat_theme_delete',[pointer]);
  }
  private assertLive(): void { if (!this.#pointer) throw new Error('Deleted native theme'); }
  resolve(paths: PathPacket, options: Partial<ResolveLimits> = {}): Outcome<readonly EffectiveStyle[]> {
    this.assertLive();
    const checked = attempt(() => limits(RESOLVE_DEFAULTS,options));
    if (checked.kind !== 'ok') return checked;
    const bounds = checked.value;
    return withBytes(this.#component,paths.bytes,input => {
      const pointer = this.#component.number('scope_compat_theme_resolve',[this.#pointer,input,paths.bytes.length,bounds.steps,bounds.outputBytes]);
      if (!pointer) return allocation;
      try { return decodeThemeResult(this.#component.runtime.heap(),pointer,paths.count); }
      finally { this.#component.call('scope_compat_theme_result_delete',[pointer]); }
    });
  }
  match(paths: PathPacket, pathId: number, steps = RESOLVE_DEFAULTS.steps): Outcome<PartialMatch> {
    this.assertLive(); u32(pathId);
    const checked = attempt(() => limits(RESOLVE_DEFAULTS,{steps}));
    if (checked.kind !== 'ok') return checked;
    return withBytes(this.#component,paths.bytes,input => {
      const pointer = this.#component.number('scope_compat_theme_match',[this.#pointer,input,paths.bytes.length,pathId,checked.value.steps]);
      if (!pointer) return allocation;
      try { return decodeThemeMatch(this.#component.runtime.heap(),pointer); }
      finally { this.#component.call('scope_compat_theme_match_delete',[pointer]); }
    });
  }
}
