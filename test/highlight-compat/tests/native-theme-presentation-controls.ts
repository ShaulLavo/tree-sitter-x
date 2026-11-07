import { expect } from 'vitest';
import { Theme } from '@shikijs/vscode-textmate';
import { generateNativeThemeSuite, observeNativeTheme } from '../src/oracles/native-theme-reference.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import type { OperationalFailure, Outcome, Profile } from '../src/native/theme-contract.ts';
import type { PresentationLease } from '../src/native/theme-presentation.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import type { NativePack } from '../src/native/component.ts';
import { Component } from '../src/native/component.ts';
import { MarkdownResolver } from '../src/native/markdown-resolver.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';

export function value<T>(result: Outcome<T> | OperationalFailure): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
}
export const suite = generateNativeThemeSuite();
export function fixture(id: string, profile: Profile = 'raw') {
  const found = suite.fixtures.find(item => item.id === id && item.profile === profile);
  if (!found) throw new Error('Missing independent theme fixture');
  return found;
}
export function theme(id = 'inheritance', profile: Profile = 'raw') {
  const source = fixture(id, profile);
  const input = { root: source.input.root, edges: source.input.edges, resources: source.input.resources.map(resource => ({
    id: resource.id, format: 'json' as const, bytes: new TextEncoder().encode(resource.bytes),
  })) };
  return normalizeTheme(value(snapshotInput(input)), profile, JSON.stringify(suite.targets));
}
export function acquisition(id = 'inheritance', profile: Profile = 'raw') { return async () => theme(id, profile); }
export function complete(result: Awaited<ReturnType<ThemePresentation['select']>>) {
  if (result.kind !== 'complete') throw new Error(JSON.stringify(result));
  return result;
}
export function stylesAt(output: PresentationLease, from: number, to: number) {
  return output.snapshot.runs.flatMap(run => Array.from({ length: Math.max(0, Math.min(to, run.to) - Math.max(from, run.from)) }, () => run.style));
}
export function reference(output: PresentationLease, source: string, id = 'inheritance', profile: Profile = 'raw'): void {
  const expected = Theme.createFromRawTheme(fixture(id, profile).normalized), snapshot = output.snapshot, scopes = snapshot.scopes;
  expect(snapshot.metadata).toBeNull(); expect(scopes.metadata).toBeNull(); expect(scopes.sourceLength).toBe(source.length);
  const observed = snapshot.runs.flatMap(run => Array.from({ length: run.to - run.from }, () => run.style));
  const wanted = Array.from({ length: scopes.coverage.to - scopes.coverage.from }, (_, offset) => {
    const position = offset + scopes.coverage.from, separator = source[position] === '\n' || source[position] === '\r' && source[position + 1] === '\n';
    if (separator) return {};
    const index = scopes.segments.findIndex((from, i) => i % 3 === 0 && from <= position && scopes.segments[i + 1] > position);
    if (index < 0) throw new Error('Scope output gap');
    const names = scopes.dictionary.paths[scopes.segments[index + 2]].map(name => scopes.dictionary.names[name]);
    return observeNativeTheme(expected, names, profile).applied;
  });
  expect(observed).toEqual(wanted);
}
export function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Deferred not initialized'); };
  let reject: (error: Error) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<T>((pass, fail) => { resolve = pass; reject = fail; });
  return { promise, resolve, reject };
}
export async function context(language = 'json', source = '[1,2]\r\n') {
  const packs = new Map<string, NativePack>();
  for (const id of language === 'markdown' ? ['json', 'typescript', 'tsx'] : [language]) packs.set(id, await loadLanguagePack(id));
  const owner = language === 'markdown' ? await MarkdownPilotDocument.open(source) : await PilotDocument.open(language, source);
  const session = ScopeSession.attach(owner, packs), presentation = new ThemePresentation(session);
  const view = session.attachView({ from: 0, to: source.length });
  for (let i = 0; i <= (owner instanceof MarkdownPilotDocument ? owner.children.length : 0); i++) session.flushOne();
  return { owner, packs, session, presentation, view, dispose: () => {
    presentation.dispose(); session.dispose(); owner.dispose(); for (const pack of packs.values()) pack.dispose();
  } };
}
export async function observe() {
  const runtime = await Runtime.load(), proto = foreign(foreign(runtime.binding.Parser).prototype), parse = proto.parse;
  const call = Component.prototype.call, resolver = MarkdownResolver.prototype.call;
  let counts = { parse: 0, classify: 0, resolver: 0 };
  if (typeof parse !== 'function') throw new Error('Missing real parser');
  Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: function(this: unknown, ...args: unknown[]) {
    counts.parse++; return Reflect.apply(parse, this, args);
  } });
  Component.prototype.call = function(name, args = []) {
    if (name === 'scope_compat_run' || name === 'scope_compat_explain') counts.classify++;
    return call.call(this, name, args);
  };
  MarkdownResolver.prototype.call = function(name, args = []) { counts.resolver++; return resolver.call(this, name, args); };
  return { read: () => ({ ...counts }), reset: () => { counts = { parse: 0, classify: 0, resolver: 0 }; }, restore: () => {
    Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: parse }); Component.prototype.call = call; MarkdownResolver.prototype.call = resolver;
  } };
}
export function acquired(current: Awaited<ReturnType<typeof context>>, view = current.view): PresentationLease {
  const output = current.presentation.acquire(view);
  if (!output) throw new Error('Missing current presentation');
  return output;
}
