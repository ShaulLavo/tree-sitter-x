import { it, expect } from 'vitest';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
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

it.each(['json', 'typescript', 'tsx', 'markdown'] as const)('runs bounded seeded real replay for %s', async language => {
  for (const seed of [1, 0x12345678, 0xdeadbeef, 0xffffffff]) {
    const result = await replayNative({ seed, edits: 32, language });
    expect(result.complete).toBe(32); expect(result.viewportChecks).toBe(32);
  }
});

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
