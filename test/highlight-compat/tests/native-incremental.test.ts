import { it, expect } from 'vitest';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { decodedSnapshot } from '../src/native/scope-output.ts';
import { Component } from '../src/native/component.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { prepareEdits } from '../src/native/edit-batch.ts';
import { validateMappings, mapIntervals, validateDescriptors } from '../src/native/injection-map.ts';
import { replayNative } from '../src/native/replay.ts';

it('preflights intermediate overflow before any actual tree mutation', async () => {
  const owner = await PilotDocument.open('json', 'abcdefgh', { index: 8, column: 8, row: 8 });
  const key = owner.key();
  try {
    await expect(owner.applyEdits({ base: key, edits: [{ from: 0, to: 2, insert: '' }, { from: 6, to: 6, insert: 'XY' }] })).rejects.toThrow('limit');
    expect(owner.source).toBe('abcdefgh'); expect(owner.key()).toEqual(key);
  } finally { owner.dispose(); }
});
it('replays same-shape edits, batches, Unicode and undo against fresh native', async () => {
  const pack = await loadLanguagePack('typescript');
  const owner = await PilotDocument.open('typescript', 'const value = JSON;\r\n');
  try {
    for (const source of ['const VALUE = Math;\r\n', 'const π = "😀";\n', 'const value = JSON;\r\n', '', '\ufeffconst x = `a\nb`;\r']) {
      const result = await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: owner.source.length, insert: source }] });
      expect(result.kind).toBe('ready');
      await compareFreshRoot(owner, pack);
    }
  } finally { owner.dispose(); pack.dispose(); }
});
it('reconciles Markdown grow, shrink and first-use language before ready', async () => {
  const owner = await MarkdownPilotDocument.open('```json\n1\n```\n');
  try {
    for (const source of ['prefix\n```typescript\nconst x = JSON;\n```\n```json\n2\n```\n', '```tsx\n<div/>\n```\n', '']) {
      expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: owner.source.length, insert: source }] })).kind).toBe('ready');
      await compareFreshMarkdown(owner);
    }
  } finally { owner.dispose(); }
});


it('rejects final, intermediate, row, column, fractional and overlapping batches without tree edits', async () => {
  const runtime = await Runtime.load(), prototype = foreign(foreign(runtime.binding.Tree).prototype), original = prototype.edit;
  let edits = 0;
  Object.defineProperty(prototype, 'edit', { configurable: true, value: function(this: Foreign, ...args: unknown[]) { edits++; return Reflect.apply(typeof original === 'function' ? original : () => {}, this, args); } });
  try {
    for (const input of [
      { source: 'abcdefgh', limits: { index: 8, column: 8, row: 8 }, edits: [{ from: 0, to: 2, insert: '' }, { from: 6, to: 6, insert: 'XY' }] },
      { source: 'abcdefgh', limits: { index: 8, column: 8, row: 8 }, edits: [{ from: 8, to: 8, insert: 'x' }] },
      { source: 'ab\ncd', limits: { index: 8, column: 2, row: 8 }, edits: [{ from: 2, to: 3, insert: '' }] },
      { source: 'a\nb', limits: { index: 8, column: 8, row: 1 }, edits: [{ from: 0, to: 0, insert: '\n' }] },
      { source: 'abc', limits: { index: 8, column: 8, row: 8 }, edits: [{ from: 0.5, to: 1, insert: '' }] },
      { source: 'abc', limits: { index: 8, column: 8, row: 8 }, edits: [{ from: 0, to: 2, insert: '' }, { from: 1, to: 2, insert: '' }] },
    ]) {
      await rejectBatch(input); expect(edits).toBe(0);
    }
    const prepared = prepareEdits('abcdefghij', [{ from: 2, to: 4, insert: 'X' }, { from: 7, to: 7, insert: 'YZ' }]);
    expect(prepared.source).toBe('abXefgYZhij'); expect(prepared.newTextSpans).toEqual([{ from: 2, to: 3 }, { from: 6, to: 8 }]);
    expect(prepared.schedule.map(item => item.binding.startIndex)).toEqual([7, 2]);
  } finally { Object.defineProperty(prototype, 'edit', { configurable: true, writable: true, value: original }); }
});

it('validates supplied disjoint and nested truth, and rejects fractional or stale source maps', async () => {
  const parent = '..........abc.......defg', child = 'abcdefg';
  const maps = validateMappings(child, parent, [{ childFrom: 0, childTo: 3, parentFrom: 10, parentTo: 13 }, { childFrom: 3, childTo: 7, parentFrom: 20, parentTo: 24 }]);
  expect(mapIntervals([{ from: 0, to: 7, scopes: ['child'] }], maps)).toEqual([{ from: 10, to: 13, scopes: ['child'] }, { from: 20, to: 24, scopes: ['child'] }]);
  for (const mapping of [{ childFrom: 0.5, childTo: 3.5, parentFrom: 10, parentTo: 13 }, { childFrom: 0, childTo: 3, parentFrom: 11, parentTo: 14 }, { childFrom: 0, childTo: 8, parentFrom: 10, parentTo: 18 }]) expect(() => validateMappings(child, parent, [mapping])).toThrow();
  const owner = await PilotDocument.open('json', '1'), key = owner.key();
  const root = { id: 'a', parent: null, owner: key, generation: key.syntax, language: 'json', frame: ['outer'], mappings: maps };
  try {
    validateDescriptors([root, { ...root, id: 'b', parent: 'a' }], key, 2, 2);
    expect(() => validateDescriptors([{ ...root, parent: 'a' }], key, 2, 2)).toThrow();
    expect(() => validateDescriptors([root], key, 2, 0)).toThrow();
  } finally { owner.dispose(); }
});

it('excludes borrowing and concurrent edits while child acquisition waits; close wins', async () => {
  const owner = await MarkdownPilotDocument.open('text\n');
  const language = Runtime.prototype.language;
  let resume: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { resume = resolve; });
  Object.defineProperty(Runtime.prototype, 'language', { configurable: true, writable: true, value: async function(this: Runtime, id: string) { await gate; return language.call(this, id); } });
  try {
    const pending = owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: owner.source.length, insert: '```tsx\n<div/>\n```\n' }] });
    expect(owner.observe().kind).toBe('updating'); expect(() => owner.intervals(new Map())).toThrow('updating');
    await expect(owner.applyEdits({ base: owner.key(), edits: [] })).rejects.toThrow();
    owner.dispose(); resume?.(); expect((await pending).kind).toBe('closed'); expect(owner.observe().kind).toBe('closed');
  } finally { resume?.(); Object.defineProperty(Runtime.prototype, 'language', { configurable: true, writable: true, value: language }); owner.dispose(); }
});

it('frees constructed siblings when a required second child fails, and recovers the committed source', async () => {
  const owner = await MarkdownPilotDocument.open('old'), runtime = await Runtime.load();
  const prototype = foreign(foreign(runtime.binding.Parser).prototype), parse = prototype.parse;
  let calls = 0;
  Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: function(this: Foreign, ...args: unknown[]) { if (++calls === 2) throw new Error('second child failure'); return Reflect.apply(typeof parse === 'function' ? parse : () => null, this, args); } });
  try {
    const source = '```json\n1\n```\n```tsx\n<div/>\n```\n';
    const result = await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: owner.source.length, insert: source }] });
    expect(result.kind).toBe('unavailable'); expect(owner.source).toBe(source); expect(owner.children).toHaveLength(0); expect(() => owner.intervals(new Map())).toThrow('unavailable');
    Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: parse });
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: source.length, insert: '```json\n2\n```\n' }] })).kind).toBe('ready');
    expect(owner.children).toHaveLength(1);
  } finally { Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: parse }); owner.dispose(); }
});

it.each(['json', 'javascript', 'jsx', 'typescript', 'tsx', 'markdown'] as const)('runs bounded seeded real replay for %s', async language => {
  for (const seed of [1, 0x12345678, 0xdeadbeef, 0xffffffff]) {
    const result = await replayNative({ seed, edits: 32, language });
    expect(result.complete).toBe(32); expect(result.viewportChecks).toBe(32);
  }
}, 30_000);

it('defers disposal during synchronous child parsing and returns closed after the call', async () => {
  const owner = await MarkdownPilotDocument.open('old'), runtime = await Runtime.load();
  const prototype = foreign(foreign(runtime.binding.Parser).prototype), parse = prototype.parse;
  if (typeof parse !== 'function') throw new Error('Missing parser');
  let during = '';
  Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: function(this: Foreign, ...args: unknown[]) {
    const tree: unknown = Reflect.apply(parse, this, args);
    owner.dispose(); during = owner.observe().kind; return tree;
  } });
  try {
    const result = await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: 3, insert: '```json\n1\n```\n' }] });
    expect(during).toBe('updating'); expect(result.kind).toBe('closed'); expect(owner.observe().kind).toBe('closed');
  } finally { Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: parse }); owner.dispose(); }
});

async function compareFreshRoot(owner: PilotDocument, pack: Awaited<ReturnType<typeof loadLanguagePack>>): Promise<void> {
  const fresh = await PilotDocument.open(owner.languageId, owner.source);
  try { expect(nativeScopes(pack, owner)).toEqual(nativeScopes(pack, fresh)); } finally { fresh.dispose(); }
}
async function compareFreshMarkdown(owner: MarkdownPilotDocument): Promise<void> {
  const fresh = await MarkdownPilotDocument.open(owner.source);
  try { expect(owner.children).toEqual(fresh.children); expect(owner.diagnostics).toEqual(fresh.diagnostics); } finally { fresh.dispose(); }
}
async function rejectBatch(input: { source: string; limits: { index: number; column: number; row: number }; edits: readonly { from: number; to: number; insert: string }[] }): Promise<void> {
  const owner = await PilotDocument.open('json', input.source, input.limits), key = owner.key();
  try {
    await expect(owner.applyEdits({ base: key, edits: input.edits })).rejects.toThrow();
    expect(owner.source).toBe(input.source); expect(owner.key()).toEqual(key); expect(owner.observe().kind).toBe('ready');
  } finally { owner.dispose(); }
}

it('keeps a failed target revision unavailable, resets its parser, and recovers through the same owner', async () => {
  const runtime = await Runtime.load(), owner = await PilotDocument.open('json', '[1]'), pack = await loadLanguagePack('json');
  const prototype = foreign(foreign(runtime.binding.Parser).prototype), parse = prototype.parse, reset = prototype.reset;
  let resets = 0;
  Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: () => null });
  Object.defineProperty(prototype, 'reset', { configurable: true, writable: true, value: function(this: Foreign) { resets++; if (typeof reset !== 'function') throw new Error('Missing reset'); return Reflect.apply(reset, this, []); } });
  try {
    const before = owner.key(), outcome = await owner.applyEdits({ base: before, edits: [{ from: 1, to: 2, insert: 'true' }] });
    expect(outcome.kind).toBe('unavailable'); expect(owner.source).toBe('[true]'); expect(owner.key().revision).toBe(before.revision + 1); expect(resets).toBe(1);
    expect(() => nativeScopes(pack, owner)).toThrow('unavailable'); expect((await owner.applyEdits({ base: owner.key(), edits: [] })).kind).toBe('unavailable');
    Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: parse });
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 1, to: 5, insert: '2' }] })).kind).toBe('ready'); await compareFreshRoot(owner, pack);
  } finally { Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: parse }); Object.defineProperty(prototype, 'reset', { configurable: true, writable: true, value: reset }); owner.dispose(); pack.dispose(); }
});

it('rejects reentrant transactions during both updating and ready notifications', async () => {
  const owner = await PilotDocument.open('json', '[1]'), attempts: Promise<unknown>[] = [], observations: string[] = [];
  const unsubscribe = owner.onCommit(() => { observations.push(`${owner.observe().kind}:${owner.source}`); attempts.push(owner.applyEdits({ base: owner.key(), edits: [] }).then(() => 'accepted', () => 'rejected')); });
  try {
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 1, to: 2, insert: '2' }] })).kind).toBe('ready');
    expect(observations).toEqual(['updating:[2]', 'ready:[2]']); expect(await Promise.all(attempts)).toEqual(['rejected', 'rejected']);
  } finally { unsubscribe(); owner.dispose(); }
});

it('keeps the exact included source range when a JSON syntax root excludes leading blank text', async () => {
  const source = '```json\n\nx":2}\n```\n', owner = await MarkdownPilotDocument.open(source), pack = await loadLanguagePack('json');
  try {
    expect(owner.children).toHaveLength(1); expect(owner.children[0].start).toBe(8); expect(owner.children[0].rootStart).toBeGreaterThan(8);
    expect(owner.intervals(new Map([['json', pack]])).at(-1)?.to).toBe(source.length);
  } finally { owner.dispose(); pack.dispose(); }
});

async function assertSessionMatchesFresh(
  language: 'json' | 'javascript' | 'jsx' | 'typescript' | 'tsx',
  session: ScopeSession,
  view: Parameters<ScopeSession['acquire']>[0],
  owner: PilotDocument,
  pack: Awaited<ReturnType<typeof loadLanguagePack>>,
): Promise<void> {
  const lease = session.acquire(view);
  const fresh = await PilotDocument.open(language, owner.source);
  const freshSession = ScopeSession.attach(fresh, new Map([[language, pack]]));
  const freshView = freshSession.attachView({ from: 0, to: fresh.source.length });
  freshSession.flushOne();
  const freshLease = freshSession.acquire(freshView);
  try {
    expect(lease && decodedSnapshot(lease.snapshot)).toEqual(freshLease && decodedSnapshot(freshLease.snapshot));
  } finally {
    lease?.release(); freshLease?.release(); freshSession.dispose(); fresh.dispose();
  }
}

it('uses local-range invalidation on localized TypeScript, JavaScript, JSX, TSX, and JSON edits with exact fresh equality', async () => {
  const tsBlocks = Array.from({ length: 40 }, (_, i) => `export function fn${i}(x: number): number {\n  const val = x + ${i};\n  return val * 2;\n}\n`).join('\n');
  const tsClass = `class Sample {\n  @first\n  /* note */\n  @second\n  value = 7;\n  ${Array.from({ length: 30 }, (_, i) => `m${i}() { return ${i}; }`).join('\n  ')}\n}\n`;
  const tsDecl = `const BIG = {\n  ${Array.from({ length: 30 }, (_, i) => `k${i}: ${i},`).join('\n  ')}\n} /* trailing */;\n`;
  const tsSource = `${tsBlocks}\n${tsClass}\n${tsDecl}`;
  const tsPack = await loadLanguagePack('typescript');
  const tsOwner = await PilotDocument.open('typescript', tsSource);
  const tsSession = ScopeSession.attach(tsOwner, new Map([['typescript', tsPack]]));
  const tsView = tsSession.attachView({ from: 0, to: tsSource.length });
  try {
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('full-document');

    // 1. Localized edit inside one function body
    const needle = 'return val * 2;';
    const pos = tsOwner.source.indexOf(needle, tsOwner.source.indexOf('fn20'));
    expect((await tsOwner.applyEdits({ base: tsOwner.key(), edits: [{ from: pos, to: pos + needle.length, insert: 'return val * 3;' }] })).kind).toBe('ready');
    tsSession.request(tsView, { viewport: { from: 0, to: tsOwner.source.length }, theme: 1 });
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('local-range');
    expect((tsSession.lastInvalidation?.newRange.to ?? 0) - (tsSession.lastInvalidation?.newRange.from ?? 0)).toBeLessThan(tsOwner.source.length / 4);
    await assertSessionMatchesFresh('typescript', tsSession, tsView, tsOwner, tsPack);

    // 2. Edit a stacked decorator in a class body (must widen across comment/decorator/field)
    const decPos = tsOwner.source.indexOf('@first');
    expect((await tsOwner.applyEdits({ base: tsOwner.key(), edits: [{ from: decPos, to: decPos + 6, insert: '@alpha' }] })).kind).toBe('ready');
    tsSession.request(tsView, { viewport: { from: 0, to: tsOwner.source.length }, theme: 2 });
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('local-range');
    await assertSessionMatchesFresh('typescript', tsSession, tsView, tsOwner, tsPack);

    // 3. Edit inside lexical_declaration with trailing comment (must preserve meta.var.expr over trailing comment)
    const kPos = tsOwner.source.indexOf('k15: 15');
    expect((await tsOwner.applyEdits({ base: tsOwner.key(), edits: [{ from: kPos, to: kPos + 7, insert: 'k15: 99' }] })).kind).toBe('ready');
    tsSession.request(tsView, { viewport: { from: 0, to: tsOwner.source.length }, theme: 3 });
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('local-range');
    await assertSessionMatchesFresh('typescript', tsSession, tsView, tsOwner, tsPack);

    // 4. Introduce syntax error (must fall back cleanly to full-document) and recover
    const errPos = tsOwner.source.indexOf('fn5');
    expect((await tsOwner.applyEdits({ base: tsOwner.key(), edits: [{ from: errPos, to: errPos, insert: '/* ' }] })).kind).toBe('ready');
    tsSession.request(tsView, { viewport: { from: 0, to: tsOwner.source.length }, theme: 4 });
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('full-document');
    await assertSessionMatchesFresh('typescript', tsSession, tsView, tsOwner, tsPack);

    expect((await tsOwner.applyEdits({ base: tsOwner.key(), edits: [{ from: errPos, to: errPos + 3, insert: '' }] })).kind).toBe('ready');
    tsSession.request(tsView, { viewport: { from: 0, to: tsOwner.source.length }, theme: 5 });
    tsSession.flushOne();
    expect(tsSession.lastInvalidation?.mode).toBe('full-document');
    await assertSessionMatchesFresh('typescript', tsSession, tsView, tsOwner, tsPack);
  } finally { tsSession.dispose(); tsOwner.dispose(); tsPack.dispose(); }

  // 5. Large nested JSON document (respects legacy_order nested-object guard!)
  const jsonSource = `{\n${Array.from({ length: 60 }, (_, i) => `  "entry_${i}": { "nested": { "value": ${i}, "items": [1, 2, ${i}] } }`).join(',\n')}\n}\n`;
  const jsonPack = await loadLanguagePack('json');
  const jsonOwner = await PilotDocument.open('json', jsonSource);
  const jsonSession = ScopeSession.attach(jsonOwner, new Map([['json', jsonPack]]));
  const jsonView = jsonSession.attachView({ from: 0, to: jsonSource.length });
  try {
    jsonSession.flushOne();
    const target = '"value": 30';
    const at = jsonOwner.source.indexOf(target);
    expect((await jsonOwner.applyEdits({ base: jsonOwner.key(), edits: [{ from: at, to: at + target.length, insert: '"value": 3000' }] })).kind).toBe('ready');
    jsonSession.request(jsonView, { viewport: { from: 0, to: jsonOwner.source.length }, theme: 1 });
    jsonSession.flushOne();
    expect(jsonSession.lastInvalidation?.mode).toBe('local-range');
    expect((jsonSession.lastInvalidation?.newRange.to ?? 0) - (jsonSession.lastInvalidation?.newRange.from ?? 0)).toBeLessThan(jsonOwner.source.length / 4);
    await assertSessionMatchesFresh('json', jsonSession, jsonView, jsonOwner, jsonPack);
  } finally { jsonSession.dispose(); jsonOwner.dispose(); jsonPack.dispose(); }

  // 6. JavaScript, JSX, and TSX localized edits
  for (const [language, body] of [
    ['javascript', (i: number) => `function step${i}(n) {\n  const x = n + ${i};\n  return x * 2;\n}\n`],
    ['jsx', (i: number) => `function Card${i}({ title }) {\n  return <section data-id="${i}">{title}</section>;\n}\n`],
    ['tsx', (i: number) => `function Badge${i}(props: { label: string }) {\n  return <span data-id="${i}">{props.label}</span>;\n}\n`],
  ] as const) {
    const src = Array.from({ length: 30 }, (_, i) => body(i)).join('\n');
    const pack = await loadLanguagePack(language);
    const owner = await PilotDocument.open(language, src);
    const session = ScopeSession.attach(owner, new Map([[language, pack]]));
    const view = session.attachView({ from: 0, to: src.length });
    try {
      session.flushOne();
      const needle = language === 'javascript' ? 'n + 15;' : 'data-id="15"';
      const replacement = language === 'javascript' ? 'n + 999;' : 'data-id="999"';
      const at = owner.source.indexOf(needle);
      expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: at, to: at + needle.length, insert: replacement }] })).kind).toBe('ready');
      session.request(view, { viewport: { from: 0, to: owner.source.length }, theme: 1 });
      session.flushOne();
      expect(session.lastInvalidation?.mode).toBe('local-range');
      expect((session.lastInvalidation?.newRange.to ?? 0) - (session.lastInvalidation?.newRange.from ?? 0)).toBeLessThan(owner.source.length / 4);
      await assertSessionMatchesFresh(language, session, view, owner, pack);
    } finally { session.dispose(); owner.dispose(); pack.dispose(); }
  }
});

it('reuses untouched Markdown child trees and cached child scopes across localized fence edits', async () => {
  const source = [
    '# Doc',
    '```typescript',
    'const first = 1;',
    '```',
    '```json',
    '{"middle": 2}',
    '```',
    '```tsx',
    'const view = <div>{JSON.stringify(3)}</div>;',
    '```',
    '',
  ].join('\n');
  const packs = new Map(await Promise.all(['typescript', 'json', 'tsx'].map(async id => [id, await loadLanguagePack(id)] as const)));
  const owner = await MarkdownPilotDocument.open(source);
  const session = ScopeSession.attach(owner, packs);
  const view = session.attachView({ from: 0, to: source.length });
  const original = Component.prototype.number;
  let scopeCalls = 0;
  Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: function(this: Component, name: string, args: readonly number[] = []) {
    if (name === 'scope_compat_run') scopeCalls++;
    return original.call(this, name, args);
  } });
  try {
    for (let turn = 0; turn <= owner.children.length; turn++) session.flushOne();
    expect(owner.observation.childParses).toBe(3);
    expect(scopeCalls).toBe(3);

    // Edit only the middle JSON fence (changing its length so fence #3 shifts!)
    scopeCalls = 0;
    const at = owner.source.indexOf('2');
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: at, to: at + 1, insert: '20000' }] })).kind).toBe('ready');
    expect(owner.observation.childParses).toBe(4); // only 1 fence re-parsed, 2 reused!
    expect(owner.lastChange).toMatchObject({ reusedChildren: 2, parsedChildren: 1 });

    session.request(view, { viewport: { from: 0, to: owner.source.length }, theme: 1 });
    for (let turn = 0; turn <= owner.children.length; turn++) session.flushOne();
    expect(scopeCalls).toBe(1); // only the edited fence ran scope_compat_run!
    expect(session.lastInvalidation).toMatchObject({ mode: 'local-range', reusedChildren: 2, rescopedChildren: 1 });

    const lease = session.acquire(view);
    const fresh = await MarkdownPilotDocument.open(owner.source);
    const freshSession = ScopeSession.attach(fresh, packs);
    const freshView = freshSession.attachView({ from: 0, to: fresh.source.length });
    for (let turn = 0; turn <= fresh.children.length; turn++) freshSession.flushOne();
    const freshLease = freshSession.acquire(freshView);
    try {
      expect(lease && decodedSnapshot(lease.snapshot)).toEqual(freshLease && decodedSnapshot(freshLease.snapshot));
      expect(owner.children).toEqual(fresh.children);
    } finally {
      lease?.release(); freshLease?.release(); freshSession.dispose(); fresh.dispose();
    }
  } finally {
    Object.defineProperty(Component.prototype, 'number', { configurable: true, writable: true, value: original });
    session.dispose(); owner.dispose(); for (const pack of packs.values()) pack.dispose();
  }
});
