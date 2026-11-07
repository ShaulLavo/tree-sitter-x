import { describe, expect, it } from 'vitest';
import { Component } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import { encodePathPacket } from '../src/native/theme-packet.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { MarkdownResolver } from '../src/native/markdown-resolver.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import type { OperationalFailure, Outcome } from '../src/native/theme-contract.ts';

function value<T>(outcome: Outcome<T> | OperationalFailure): T {
  if (outcome.kind !== 'ok') throw new Error(JSON.stringify(outcome));
  return outcome.value;
}
async function theme(color: string): Promise<NativeTheme> {
  const bytes = new TextEncoder().encode(JSON.stringify({name:'same-name',tokenColors:[{settings:{foreground:color}}]}));
  const snapshot = value(snapshotInput({root:'theme',resources:[{id:'theme',format:'json',bytes}],edges:[]}));
  return value(await NativeTheme.compile(value(normalizeTheme(snapshot,'product','pinned-test-target'))));
}
function observe(runtime: Runtime) {
  const proto = foreign(foreign(runtime.binding.Parser).prototype), originalParse = proto.parse;
  const originalCall = Component.prototype.call, originalResolver = MarkdownResolver.prototype.call;
  let counts = {parse:0,classify:0,resolver:0};
  if (typeof originalParse !== 'function') throw new Error('Missing parser method');
  Object.defineProperty(proto,'parse',{configurable:true,writable:true,value:function(this: unknown,...args: unknown[]) {
    ++counts.parse; return Reflect.apply(originalParse,this,args);
  }});
  Component.prototype.call = function(name: string,args: readonly number[] = []) {
    if (name === 'scope_compat_run' || name === 'scope_compat_explain') ++counts.classify;
    return originalCall.call(this,name,args);
  };
  MarkdownResolver.prototype.call = function(name: string,args: readonly number[] = []) {
    ++counts.resolver; return originalResolver.call(this,name,args);
  };
  return {
    read:() => ({...counts}),
    reset:() => { counts = {parse:0,classify:0,resolver:0}; },
    restore:() => {
      Object.defineProperty(proto,'parse',{configurable:true,writable:true,value:originalParse});
      Component.prototype.call = originalCall; MarkdownResolver.prototype.call = originalResolver;
    },
  };
}
type Observer = ReturnType<typeof observe>;
function repaint(paths: readonly (readonly string[])[], themes: readonly NativeTheme[], observer: Observer): void {
  const packet = value(encodePathPacket(paths)), before = JSON.stringify(paths);
  observer.reset();
  const styles = themes.map(current => value(current.resolve(packet)));
  expect(styles[0][0].foreground).not.toBe(styles[1][0].foreground);
  expect(styles[0][0].foreground).not.toBe(styles[2][0].foreground);
  expect(JSON.stringify(paths)).toBe(before);
  expect(observer.read()).toEqual({parse:0,classify:0,resolver:0});
}
async function languageControl(language: string, source: string, pack: NativePack, themes: readonly NativeTheme[], observer: Observer): Promise<void> {
  observer.reset();
  const owner = await PilotDocument.open(language,source);
  try {
    const scopes = nativeScopes(pack,owner);
    expect(observer.read().parse).toBe(1); expect(observer.read().classify).toBe(1);
    if (scopes.status !== 0) throw new Error('Incomplete current scopes');
    const before = JSON.stringify(scopes), paths = scopes.paths.map(path => Object.freeze(path.map(id => pack.scopes[id])));
    repaint(Object.freeze(paths),themes,observer);
    expect(JSON.stringify(scopes)).toBe(before);
  } finally { owner.dispose(); }
}
async function markdownControl(packs: ReadonlyMap<string,NativePack>, themes: readonly NativeTheme[], observer: Observer): Promise<void> {
  observer.reset();
  const owner = await MarkdownPilotDocument.open('```typescript\nconst a = 1\n```\n```json\n{"a":1}\n```\n');
  try {
    const intervals = owner.intervals(packs);
    expect(owner.children).toHaveLength(2);
    expect(observer.read().parse).toBe(2); expect(observer.read().classify).toBe(2);
    expect(observer.read().resolver).toBeGreaterThan(0);
    const before = JSON.stringify(intervals);
    repaint(Object.freeze(intervals.map(interval => Object.freeze(Array.from(interval.scopes)))),themes,observer);
    expect(JSON.stringify(intervals)).toBe(before);
  } finally { owner.dispose(); }
}
describe('stateless theme-only recomputation over retained current scopes', () => {
  it('arms same-engine parser/classifier/resolver controls, then changes themes with zero calls', async () => {
    const observer = observe(await Runtime.load()), themes: NativeTheme[] = [], packs = new Map<string,NativePack>();
    try {
      for (const color of ['#123456','#abcdef','#654321']) themes.push(await theme(color));
      for (const language of ['json','typescript','tsx']) packs.set(language,await loadLanguagePack(language));
      await languageControl('json','{"a":1}',required(packs,'json'),themes,observer);
      await languageControl('typescript','const a = 1',required(packs,'typescript'),themes,observer);
      await languageControl('tsx','const a = <p>x</p>',required(packs,'tsx'),themes,observer);
      await markdownControl(packs,themes,observer);
    } finally {
      themes.forEach(current => current.dispose()); packs.forEach(pack => pack.dispose()); observer.restore();
    }
  });
});
function required(packs: ReadonlyMap<string,NativePack>, language: string): NativePack {
  const pack = packs.get(language);
  if (!pack) throw new Error('Missing test pack');
  return pack;
}
