import { it, expect } from 'vitest';
import { PilotDocument } from '../src/native/owner.ts';
import { ScopeSession, DEFAULT_SCOPE_LIMITS } from '../src/native/incremental.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Component } from '../src/native/component.ts';
import { Runtime, foreign, invoke, release } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { MarkdownResolver } from '../src/native/markdown-resolver.ts';
import { observeRuntimeAllocations } from './native-markdown-observer.ts';
import { decodedSnapshot } from '../src/native/scope-output.ts';
import { baselineScopes } from '../src/baselines/run.ts';

it('shares full output across two viewports and releases last detach without closing the owner', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]');
  const session = ScopeSession.attach(owner, new Map([['json', pack]]), DEFAULT_SCOPE_LIMITS);
  try {
    const left = session.attachView({ from: 0, to: 2 }), right = session.attachView({ from: 2, to: 5 });
    session.flushOne();
    const a = session.acquire(left), b = session.acquire(right);
    expect(a?.snapshot.dictionary).toBe(b?.snapshot.dictionary);
    a?.release(); b?.release(); expect(() => a?.snapshot).toThrow('Released scope lease');
    session.detachView(left); expect(session.acquire(left)).toBeUndefined();
    const retained = session.acquire(right); expect(retained).toBeDefined(); retained?.release();
    session.detachView(right); expect(session.retainedBytes()).toBe(0); expect(owner.observe().kind).toBe('ready');
  } finally { session.dispose(); owner.dispose(); pack.dispose(); }
});
it('drops edited output and never publishes canceled or over-budget output', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]');
  const session = ScopeSession.attach(owner, new Map([['json', pack]]), { ...DEFAULT_SCOPE_LIMITS, retainedBytes: 1 });
  try {
    const view = session.attachView({ from: 0, to: 5 });
    session.flushOne(); expect(session.outcome(view)?.kind).toBe('incomplete'); expect(session.acquire(view)).toBeUndefined();
    const interest = session.request(view, { viewport: { from: 0, to: 5 }, theme: 1 });
    session.cancel(view, interest); session.flushOne(); expect(session.acquire(view)).toBeUndefined();
  } finally { session.dispose(); owner.dispose(); pack.dispose(); }
});


const allocations = observeRuntimeAllocations();
let observer: Foreign;
beforeAll(async () => {
observer = await (await Runtime.load()).extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
invoke(observer, 'scope_test_install');
});
afterAll(() => { try { if (observer) invoke(observer, 'scope_test_reset'); } finally { allocations.restore(); } });

it('arms exact-engine allocator controls and returns to baseline through 1000 edit/view/fence cycles', async () => {
  const component = await Component.load(), runtime = await Runtime.load();
  const packs = new Map(await Promise.all(['json', 'typescript', 'tsx'].map(async id => [id, await loadLanguagePack(id)] as const)));
  const warm = await MarkdownPilotDocument.open('```json\n1\n```\n```tsx\n<div/>\n```\n'); warm.intervals(packs); warm.dispose();
  const core = allocations.live(), native = component.liveAllocations();
  const buffer = runtime.construct('TextBuffer', ['positive']); expect(allocations.live()).toBeGreaterThan(core); release(buffer); expect(allocations.live()).toBe(core);
  const parser = runtime.construct('Parser'); expect(allocations.live()).toBeGreaterThan(core); release(parser); expect(allocations.live()).toBe(core);
  const query = runtime.construct('Query', [await runtime.language('json'), '(number) @number']); expect(allocations.live()).toBeGreaterThan(core); release(query); expect(allocations.live()).toBe(core);
  const resolver = await MarkdownResolver.open('```json\n1\n```'); expect(allocations.live()).toBeGreaterThan(core); resolver.dispose(); expect(allocations.live()).toBe(core);
  const held = await MarkdownPilotDocument.open('```json\n1\n```\n'); expect(allocations.live()).toBeGreaterThan(core); held.dispose(); expect(allocations.live()).toBe(core);
  const owner = await PilotDocument.open('json', '[1,2]'), pack = packs.get('json');
  if (!pack) throw new Error('Missing test pack');
  owner.borrow(pack.sameLanguage, borrowed => {
    const result = pack.withHandle(handle => component.number('scope_compat_run', [handle, borrowed.tree, borrowed.source, borrowed.length, 1, 0, borrowed.length, 65536, 262144, 262144]));
    try { expect(component.liveAllocations()).toBeGreaterThan(native); } finally { component.call('scope_compat_result_delete', [result]); }
    expect(component.liveAllocations()).toBe(native);
  });
  owner.dispose(); expect(allocations.live()).toBe(core);
  try {
    const markdown = await MarkdownPilotDocument.open('```json\n1\n```\n');
    try {
      await cycleMarkdown(markdown, packs, native);
    } finally { markdown.dispose(); }
    expect(allocations.live()).toBe(core); expect(component.liveAllocations()).toBe(native);
  } finally { for (const pack of packs.values()) pack.dispose(); }
});

it('performs zero scope-triggered parses after an actual baseline positive control', async () => {
  const runtime = await Runtime.load(), prototype = foreign(foreign(runtime.binding.Parser).prototype), original = prototype.parse;
  if (typeof original !== 'function') throw new Error('Missing parser');
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]');
  const session = ScopeSession.attach(owner, new Map([['json', pack]]));
  let parses = 0;
  Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: function(this: Foreign, ...args: unknown[]) { parses++; return Reflect.apply(original, this, args); } });
  try {
    await baselineScopes('baseline:captures', 'json', owner.source); expect(parses).toBe(1); parses = 0;
    const view = session.attachView({ from: 0, to: 5 }); session.flushOne();
    session.request(view, { viewport: { from: 1, to: 3 }, theme: 7 }); session.flushOne(); expect(parses).toBe(0);
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 1, to: 2, insert: '3' }] })).kind).toBe('ready'); expect(parses).toBe(1); parses = 0;
    session.flushOne(); expect(parses).toBe(0);
  } finally { Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: original }); session.dispose(); owner.dispose(); pack.dispose(); }
});

it('cancels after native output copying and protects a reopened epoch with reused request 1', async () => {
  const pack = await loadLanguagePack('json'), oldOwner = await PilotDocument.open('json', '[1]'), newOwner = await PilotDocument.open('json', '[2]');
  const oldSession = ScopeSession.attach(oldOwner, new Map([['json', pack]])), newSession = ScopeSession.attach(newOwner, new Map([['json', pack]]));
  const oldView = oldSession.attachView({ from: 0, to: 3 }), newView = newSession.attachView({ from: 0, to: 3 });
  const call = Component.prototype.call;
  let fired = false;
  Object.defineProperty(Component.prototype, 'call', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) {
    const result = call.call(this, name, args);
    if (name === 'scope_compat_result_delete' && !fired) { fired = true; oldSession.dispose(); newSession.flushOne(); }
    return result;
  } });
  try {
    oldSession.flushOne(); expect(fired).toBe(true); expect(oldSession.acquire(oldView)).toBeUndefined();
    const lease = newSession.acquire(newView);
    try { expect(lease?.snapshot.work.request).toBe(1); expect(lease?.snapshot.owner.epoch).not.toBe(oldOwner.key().epoch); expect(lease && decodedSnapshot(lease.snapshot).length).toBeGreaterThan(0); }
    finally { lease?.release(); }
    expect(newSession.outcome(newView)?.kind).toBe('complete');
  } finally { Object.defineProperty(Component.prototype, 'call', { configurable: true, writable: true, value: call }); oldSession.dispose(); newSession.dispose(); oldOwner.dispose(); newOwner.dispose(); pack.dispose(); }
});

it('releases actual native results on budget and malformed decode without publishing arrays', async () => {
  const component = await Component.load(), pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]');
  const native = component.liveAllocations(), core = allocations.live();
  const session = ScopeSession.attach(owner, new Map([['json', pack]]), { ...DEFAULT_SCOPE_LIMITS, maxIntervals: 1 });
  const view = session.attachView({ from: 0, to: 5 });
  try { session.flushOne(); expect(session.outcome(view)).toMatchObject({ kind: 'incomplete', reason: 'budget' }); expect(session.acquire(view)).toBeUndefined(); }
  finally { session.dispose(); }
  const number = Component.prototype.number;
  Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) {
    const pointer = number.call(this, name, args);
    if (name === 'scope_compat_run') new Uint32Array(this.runtime.heap().buffer)[pointer / 4] = 2;
    return pointer;
  } });
  const malformed = ScopeSession.attach(owner, new Map([['json', pack]]));
  try {
    const view = malformed.attachView({ from: 0, to: 5 }); malformed.flushOne();
    expect(malformed.outcome(view)).toMatchObject({ kind: 'incomplete', reason: 'invalid' }); expect(malformed.acquire(view)).toBeUndefined();
    expect(component.liveAllocations()).toBe(native); expect(allocations.live()).toBe(core);
  } finally { Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: number }); malformed.dispose(); owner.dispose(); pack.dispose(); }
});

async function cycleMarkdown(markdown: MarkdownPilotDocument, packs: ReadonlyMap<string, Awaited<ReturnType<typeof loadLanguagePack>>>, native: number): Promise<void> {
  const component = await Component.load();
  for (let cycle = 0; cycle < 1000; cycle++) {
    const source = cycle % 2 ? '```json\n1\n```\n' : '```tsx\n<div/>\n```\n';
    expect((await markdown.applyEdits({ base: markdown.key(), edits: [{ from: 0, to: markdown.source.length, insert: source }] })).kind).toBe('ready');
    const session = ScopeSession.attach(markdown, packs), view = session.attachView({ from: 0, to: source.length });
    let lease: ReturnType<ScopeSession['acquire']> = undefined;
    try {
      flushMarkdown(session, markdown);
      expect(session.outcome(view)?.kind).toBe('complete'); lease = session.acquire(view); expect(lease).toBeDefined();
      session.detachView(view); expect(session.retainedBytes()).toBeGreaterThan(0); lease?.release(); expect(session.retainedBytes()).toBe(0);
    } finally { lease?.release(); session.dispose(); }
    expect(component.liveAllocations()).toBe(native);
  }
}

it('retains old leased dictionaries across edits, publishes exact replacement coordinates, and reuses current scopes on theme changes', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1]');
  const session = ScopeSession.attach(owner, new Map([['json', pack]])), view = session.attachView({ from: 0, to: 3 });
  const original = Component.prototype.number;
  let calls = 0;
  Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) { if (name === 'scope_compat_run') calls++; return original.call(this, name, args); } });
  let old: ReturnType<ScopeSession['acquire']> = undefined, current: ReturnType<ScopeSession['acquire']> = undefined;
  try {
    session.flushOne(); old = session.acquire(view); expect(old?.publication?.change.kind).toBe('reset'); expect(calls).toBe(1);
    session.request(view, { viewport: { from: 1, to: 2 }, theme: 5 }); session.flushOne(); expect(calls).toBe(1);
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 1, to: 2, insert: 'true' }] })).kind).toBe('ready');
    expect(session.acquire(view)).toBeUndefined(); session.request(view, { viewport: { from: 0, to: 6 }, theme: 6 }); session.flushOne(); current = session.acquire(view);
    expect(current?.publication?.change).toEqual({ kind: 'replace', old: old?.snapshot.owner, generation: old?.snapshot.generation, coverage: { from: 1, to: 2 } });
    expect(old?.snapshot.coverage).toEqual({ from: 0, to: 3 }); expect(current?.snapshot.sourceLength).toBe(6); expect(calls).toBe(2);
    expect(old?.snapshot.dictionary).not.toBe(current?.snapshot.dictionary); expect(old && decodedSnapshot(old.snapshot).at(0)?.from).toBe(0);
    old?.release(); expect(current && decodedSnapshot(current.snapshot).at(-1)?.to).toBe(6);
    pack.dispose(); session.request(view, { viewport: { from: 0, to: 6 }, theme: 7 }); session.flushOne(); expect(session.outcome(view)?.kind).toBe('complete');
  } finally { old?.release(); current?.release(); Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: original }); session.dispose(); owner.dispose(); pack.dispose(); }
});

it('rejects bounded views and descriptors before native work, reports real native segment budgets, and never admits no-memory', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]');
  const views = ScopeSession.attach(owner, new Map([['json', pack]]), { ...DEFAULT_SCOPE_LIMITS, views: 1 });
  try { views.attachView({ from: 0, to: 5 }); expect(() => views.attachView({ from: 0, to: 5 })).toThrow('view limit'); } finally { views.dispose(); }
  const segments = ScopeSession.attach(owner, new Map([['json', pack]]), { ...DEFAULT_SCOPE_LIMITS, maxSegments: 1 });
  try { const view = segments.attachView({ from: 0, to: 5 }); segments.flushOne(); expect(segments.outcome(view)).toMatchObject({ kind: 'incomplete', reason: 'budget' }); } finally { segments.dispose(); }
  const original = Component.prototype.number;
  Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) { return name === 'scope_compat_run' ? 0 : original.call(this, name, args); } });
  const failure = ScopeSession.attach(owner, new Map([['json', pack]]));
  try { const view = failure.attachView({ from: 0, to: 5 }); failure.flushOne(); expect(failure.outcome(view)).toMatchObject({ kind: 'incomplete', reason: 'no-memory' }); expect(failure.acquire(view)).toBeUndefined(); }
  finally { failure.dispose(); Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: original }); owner.dispose(); pack.dispose(); }
  const markdown = await MarkdownPilotDocument.open('```unknown\na\n```\n```unknown\nb\n```\n');
  const descriptor = ScopeSession.attach(markdown, new Map(), { ...DEFAULT_SCOPE_LIMITS, descriptors: 1 });
  try { const view = descriptor.attachView({ from: 0, to: markdown.source.length }); descriptor.flushOne(); expect(descriptor.outcome(view)).toMatchObject({ kind: 'incomplete', reason: 'unsupported' }); }
  finally { descriptor.dispose(); markdown.dispose(); }
});

it.each(['close', 'failure'] as const)('releases real partial siblings after async %s', async mode => {
  const warm = await MarkdownPilotDocument.open('```json\n1\n```\n```tsx\n<div/>\n```\n'); warm.dispose();
  const baseline = allocations.live(), owner = await MarkdownPilotDocument.open('old');
  const language = Runtime.prototype.language;
  let entered: (() => void) | undefined, reject: ((error: Error) => void) | undefined;
  const second = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<never>((_resolve, fail) => { reject = fail; });
  Object.defineProperty(Runtime.prototype, 'language', { configurable: true, writable: true, value: function(this: Runtime, id: string) {
    if (id === 'tsx') { entered?.(); return gate; }
    return language.call(this, id);
  } });
  try {
    const pending = owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: 3, insert: '```json\n1\n```\n```tsx\n<div/>\n```\n' }] });
    await second; expect(owner.observe().kind).toBe('updating'); expect(allocations.live()).toBeGreaterThan(baseline);
    if (mode === 'close') owner.dispose();
    reject?.(new Error('required child acquisition failed'));
    expect((await pending).kind).toBe(mode === 'close' ? 'closed' : 'unavailable');
    owner.dispose(); expect(allocations.live()).toBe(baseline);
  } finally { reject?.(new Error('test cleanup')); Object.defineProperty(Runtime.prototype, 'language', { configurable: true, writable: true, value: language }); owner.dispose(); }
});

it('keeps another view complete when one window exceeds the retained-byte cap', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1]');
  const packs = new Map([['json', pack]]), calibration = ScopeSession.attach(owner, packs);
  const first = calibration.attachView({ from: 0, to: 3 }); calibration.flushOne();
  const ceiling = calibration.retainedBytes(); expect(calibration.outcome(first)?.kind).toBe('complete'); calibration.dispose();
  const session = ScopeSession.attach(owner, packs, { ...DEFAULT_SCOPE_LIMITS, retainedBytes: ceiling });
  try {
    const left = session.attachView({ from: 0, to: 3 }), right = session.attachView({ from: 0, to: 3 }); session.flushOne();
    expect(session.outcome(left)?.kind).toBe('complete'); expect(session.outcome(right)).toMatchObject({ kind: 'incomplete', reason: 'budget' });
    const lease = session.acquire(left); expect(lease).toBeDefined(); lease?.release(); expect(session.retainedBytes()).toBeLessThanOrEqual(ceiling);
  } finally { session.dispose(); owner.dispose(); pack.dispose(); }
});

it('replaces resolver text on the same handle after heap growth, copies outputs, and invalidates failed replacement', async () => {
  const warm = await MarkdownResolver.open('```json\n1\n```\n'); warm.dispose();
  const baseline = allocations.live(), runtime = await Runtime.load(), resolver = await MarkdownResolver.open('```json\n1\n```\n');
  const call = MarkdownResolver.prototype.call;
  const first = resolver.records(true), copy = JSON.stringify(first), before = runtime.heap().length;
  try {
    allocations.growOnNextAllocation(); const source = 'prefix\n'.repeat(1000) + '```json\n2\n```\n'; resolver.replaceText(source);
    expect(runtime.heap().length).toBeGreaterThan(before); expect(resolver.length).toBe(source.length); expect(resolver.records(true)[0].start).toBe(source.indexOf('2\n'));
    resolver.records(false); expect(JSON.stringify(first)).toBe(copy); resolver.replaceText(''); expect(resolver.length).toBe(0); expect(resolver.records(true)).toEqual([]);
    Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: function(this: MarkdownResolver, name: string, args: readonly number[] = []) { if (name === 'tsmd_set_text') throw new Error('replacement failure'); return call.call(this, name, args); } });
    expect(() => resolver.replaceText('new text')).toThrow('replacement failure'); expect(() => resolver.records(true)).toThrow(); expect(() => resolver.replaceText('again')).toThrow();
  } finally { Object.defineProperty(MarkdownResolver.prototype, 'call', { configurable: true, writable: true, value: call }); resolver.dispose(); }
  expect(allocations.live()).toBe(baseline);
});

it('allows one live shared scope session per document and permits attachment after disposal', async () => {
  const owner = await PilotDocument.open('json', '1'), pack = await loadLanguagePack('json'), packs = new Map([['json', pack]]);
  const session = ScopeSession.attach(owner, packs);
  try { expect(() => ScopeSession.attach(owner, packs)).toThrow('already attached'); }
  finally { session.dispose(); }
  const replacement = ScopeSession.attach(owner, packs);
  try { const view = replacement.attachView({ from: 0, to: 1 }); replacement.flushOne(); expect(replacement.outcome(view)?.kind).toBe('complete'); }
  finally { replacement.dispose(); owner.dispose(); pack.dispose(); }
});

it('yields at required child boundaries and cancels before the next native call', async () => {
  const owner = await MarkdownPilotDocument.open('```json\n1\n```\n```json\n2\n```\n'), pack = await loadLanguagePack('json');
  const session = ScopeSession.attach(owner, new Map([['json', pack]])), view = session.attachView({ from: 0, to: owner.source.length });
  const interest = session.request(view, { viewport: { from: 0, to: owner.source.length }, theme: 0 }), number = Component.prototype.number;
  let calls = 0;
  Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) { if (name === 'scope_compat_run') calls++; return number.call(this, name, args); } });
  try {
    session.flushOne(); expect(calls).toBe(1); expect(session.acquire(view)).toBeUndefined(); expect(session.retainedBytes()).toBeGreaterThan(0);
    await Promise.resolve(); session.cancel(view, interest); session.flushOne(); expect(calls).toBe(1); expect(session.retainedBytes()).toBe(0); expect(owner.observe().kind).toBe('ready');
  } finally { Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: number }); session.dispose(); owner.dispose(); pack.dispose(); }
});

it('does not let an old same-revision completion overwrite or clear a newer request', async () => {
  const owner = await PilotDocument.open('json', '[1]'), pack = await loadLanguagePack('json'), session = ScopeSession.attach(owner, new Map([['json', pack]]));
  const view = session.attachView({ from: 0, to: 3 }), interest = session.request(view, { viewport: { from: 0, to: 3 }, theme: 0 });
  const call = Component.prototype.call;
  let fired = false;
  Object.defineProperty(Component.prototype, 'call', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) {
    const result = call.call(this, name, args);
    if (name === 'scope_compat_result_delete' && !fired) { fired = true; session.cancel(view, interest); session.request(view, { viewport: { from: 0, to: 3 }, theme: 1 }); session.flushOne(); }
    return result;
  } });
  try {
    session.flushOne(); expect(fired).toBe(true); expect(session.outcome(view)).toMatchObject({ kind: 'complete', work: { request: 2 } });
    const lease = session.acquire(view); expect(lease?.snapshot.work.request).toBe(2); lease?.release();
  } finally { Object.defineProperty(Component.prototype, 'call', { configurable: true, writable: true, value: call }); session.dispose(); owner.dispose(); pack.dispose(); }
});

function flushMarkdown(session: ScopeSession, markdown: MarkdownPilotDocument): void {
  for (let turn = 0; turn <= markdown.children.length; turn++) session.flushOne();
}

it.each(['empty', 'CR', 'LF', 'surrogate'] as const)('clips the complete native context at an exact %s boundary', async boundary => {
  const source = 'const value = "😀";\r\n', owner = await PilotDocument.open('typescript', source), pack = await loadLanguagePack('typescript');
  const from = boundary === 'empty' ? 0 : boundary === 'CR' ? source.length - 2 : boundary === 'LF' ? source.length - 1 : source.indexOf('😀') + 1;
  const to = boundary === 'empty' ? 0 : from + 1;
  const session = ScopeSession.attach(owner, new Map([['typescript', pack]])), view = session.attachView({ from, to });
  try {
    const full = owner.borrow(pack.sameLanguage, borrowed => pack.run(borrowed, { start: 0, end: source.length }));
    if (full.status !== 0) throw new Error('Full native control incomplete');
    const expected = Array.from({ length: full.segments.length / 3 }, (_, i) => ({ from: Math.max(from, full.segments[i * 3]), to: Math.min(to, full.segments[i * 3 + 1]), scopes: full.paths[full.segments[i * 3 + 2]].map(id => pack.scopes[id]) })).filter(item => item.from < item.to);
    session.flushOne(); const lease = session.acquire(view);
    expect(lease && decodedSnapshot(lease.snapshot)).toEqual(expected); expect(lease?.snapshot.metadata).toBeNull();
    if (boundary === 'CR' || boundary === 'LF') expect(lease && decodedSnapshot(lease.snapshot)[0].scopes).toEqual([]);
    lease?.release();
  } finally { session.dispose(); owner.dispose(); pack.dispose(); }
});
