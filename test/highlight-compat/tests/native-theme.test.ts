import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { Component } from '../src/native/component.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';
import type { OperationalFailure, Outcome } from '../src/native/theme-contract.ts';
import { invoke } from '../src/native/runtime.ts';
function value<T>(result: Outcome<T> | OperationalFailure): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
}
function input(color: string) {
  const bytes = new TextEncoder().encode(JSON.stringify({tokenColors:[{settings:{foreground:color,fontStyle:'underline'}},
    {scope:'variable',settings:{fontStyle:''}}]}));
  return value(normalizeTheme(value(snapshotInput({root:'theme',resources:[{id:'theme',format:'json',bytes}],edges:[]})),'raw','pinned-test-target'));
}
describe('native Wasm theme calls', () => {
  it('resolves defaults, inheritance and explicit clears without retaining caller packets', async () => {
    const component = await Component.load(), baseline = component.liveAllocations();
    const theme = value(await NativeTheme.compile(input('#12345678')));
    const paths = value(encodePathPacket([[],['meta'],['meta','variable.other']]));
    try {
      const styles = value(theme.resolve(paths));
      expect(styles[0].foreground).toBe(0x12345678);
      expect(styles[1].fontMask).toBe(4);
      expect(styles[2].fontMask).toBe(0);
      expect(value(theme.match(paths,2)).style.fontMask).toEqual({kind:'set',value:0});
      expect(theme.resolve(paths,{steps:0})).toMatchObject({kind:'budget',code:'resolve-steps',limit:0});
      expect(theme.resolve(paths,{outputBytes:35})).toMatchObject({kind:'budget',code:'output-bytes',limit:35});
      expect(value(theme.resolve(paths,{outputBytes:36}))).toEqual(styles);
    } finally { theme.dispose(); }
    expect(component.liveAllocations()).toBe(baseline);
    expect(() => theme.resolve(paths)).toThrow('Deleted native theme');
  });
  it('keeps concurrent themes and explicit leases independent', async () => {
    const component = await Component.load(), baseline = component.liveAllocations();
    const a = value(await NativeTheme.compile(input('#102030'))), b = value(await NativeTheme.compile(input('#405060')));
    const lease = a.retain(), paths = value(encodePathPacket([[]]));
    try {
      a.dispose(); a.dispose();
      expect(value(lease.theme.resolve(paths))[0].foreground).toBe(0x102030ff);
      expect(value(b.resolve(paths))[0].foreground).toBe(0x405060ff);
      b.dispose(); expect(component.liveAllocations()).toBeGreaterThan(baseline);
    } finally { lease.release(); lease.release(); a.dispose(); b.dispose(); }
    expect(component.liveAllocations()).toBe(baseline);
  });
  it('refreshes heap views and frees outputs even when decoding throws', async () => {
    const component = await Component.load(), theme = value(await NativeTheme.compile(input('#123456')));
    const paths = value(encodePathPacket([[],['variable']]));
    const observer = await component.runtime.extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm',import.meta.url))));
    const original = component.number;
    let grew = false;
    const call = vi.spyOn(component,'number').mockImplementation(function(name,args = []) {
      const result = original.call(component,name,args);
      if (name === 'scope_compat_theme_resolve' && !grew) { grew = true; invoke(observer,'scope_test_grow_heap'); }
      return result;
    });
    try {
      const baseline = component.liveAllocations(), before = component.runtime.heap().buffer;
      expect(value(theme.resolve(paths))).toHaveLength(2);
      expect(grew).toBe(true);
      expect(component.runtime.heap().buffer).not.toBe(before);
      expect(component.liveAllocations()).toBe(baseline);
      expect(() => theme.resolve({...paths,count:paths.count+1})).toThrow('Invalid native theme result header');
      expect(component.liveAllocations()).toBe(baseline);
    } finally { call.mockRestore(); theme.dispose(); }
  });
  it('unwinds bounded constructors and repeated compiled/output ownership', async () => {
    const component = await Component.load(), baseline = component.liveAllocations(), themeInput = input('#123456');
    const paths = value(encodePathPacket([[],['variable']]));
    expect(await NativeTheme.compile(themeInput,{steps:0})).toMatchObject({kind:'budget',code:'compile-steps',limit:0});
    expect(await NativeTheme.compile(themeInput,{ownedBytes:0})).toMatchObject({kind:'budget',code:'owned-bytes',limit:0});
    expect(await NativeTheme.compilePacket(new Uint8Array(3))).toMatchObject({kind:'invalid',code:'packet'});
    expect(component.liveAllocations()).toBe(baseline);
    for (let cycle = 0; cycle < 100; ++cycle) {
      const theme = value(await NativeTheme.compile(themeInput));
      expect(component.liveAllocations()).toBeGreaterThan(baseline);
      try { expect(value(theme.resolve(paths))).toHaveLength(2); } finally { theme.dispose(); }
      expect(component.liveAllocations()).toBe(baseline);
    }
  });
});
