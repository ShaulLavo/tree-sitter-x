import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { Runtime, invoke } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { observeRuntimeAllocations } from './native-markdown-observer.ts';

const allocations = observeRuntimeAllocations();
let observer: Foreign;
beforeAll(async () => {
  observer = await (await Runtime.load()).extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
  invoke(observer, 'scope_test_install');
});
afterAll(() => { try { if (observer) invoke(observer, 'scope_test_reset'); } finally { allocations.restore(); } });

async function openOwner(kind: string, source: string): Promise<PilotDocument | MarkdownPilotDocument> {
  return kind === 'markdown' ? MarkdownPilotDocument.open(source) : PilotDocument.open('json', source);
}

it.each([
  { kind: 'json', always: false }, { kind: 'markdown', always: false },
  { kind: 'json', always: true }, { kind: 'markdown', always: true },
])('preserves committed keys, invalidates every listener and releases $kind resources when listeners throw, always=$always', async ({ kind, always }) => {
  const source = kind === 'markdown' ? '```json\n1\n```\n```tsx\n<div/>\n```\n' : '[1]';
  const warm = await openOwner(kind, source); warm.dispose();
  const baseline = allocations.live(), owner = await openOwner(kind, source), before = owner.key();
  const states: string[] = [];
  const first = owner.onCommit(() => { if (always || owner.observe().kind === 'updating') throw new Error('notification failure'); });
  const second = owner.onCommit(() => { states.push(owner.observe().kind); });
  try {
    const from = source.indexOf('1');
    const outcome = await owner.applyEdits({ base: before, edits: [{ from, to: from + 1, insert: '2' }] });
    expect(outcome.kind).toBe('unavailable');
    expect(outcome.key).toEqual(owner.key());
    expect(outcome.key.revision).toBe(before.revision + 1);
    expect(outcome.key.syntax).toBe(before.syntax + 1);
    expect(owner.source).toBe(source.replace('1', '2'));
    expect(states).toEqual(['updating', 'unavailable']);
    first(); second();
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from, to: from + 1, insert: '3' }] })).kind).toBe('ready');
    expect(owner.source).toBe(source.replace('1', '3'));
  } finally { first(); second(); owner.dispose(); expect(allocations.live()).toBe(baseline); }
});

it.each(['json', 'markdown'])('releases $0 resources before propagating a close-listener failure', async kind => {
  const source = kind === 'markdown' ? '```json\n1\n```\n' : '[1]';
  const warm = await openOwner(kind, source); warm.dispose();
  const baseline = allocations.live(), owner = await openOwner(kind, source), states: string[] = [];
  owner.onCommit(() => { throw new Error('close notification failure'); });
  owner.onCommit(() => { states.push(owner.observe().kind); });
  try {
    expect(() => owner.dispose()).toThrow();
    expect(states).toEqual(['closed']);
    expect(owner.observe().kind).toBe('closed');
    expect(allocations.live()).toBe(baseline);
  } finally { owner.dispose(); }
});

function expectOuterOnly(owner: MarkdownPilotDocument): void {
  expect(owner.children).toHaveLength(0);
  expect(owner.diagnostics.some(reason => reason.includes('unsupported nested fence'))).toBe(true);
  expect(owner.injectionCoverage).toHaveLength(1);
  expect(owner.injectionCoverage[0]).toMatchObject({ language: null, reason: expect.stringContaining('unsupported nested fence') });
}

it.each([
  '- item\n\n  ```json\n  1\n  ```\n',
  '1. item\n\n   ```json\n   1\n   ```\n',
])('keeps a list-contained fence outer-only on open and edit replay: %s', async source => {
  const owner = await MarkdownPilotDocument.open(source), flat = '```json\n1\n```\n';
  try {
    expectOuterOnly(owner);
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: source.length, insert: flat }] })).kind).toBe('ready');
    expect(owner.children).toHaveLength(1);
    expect(owner.injectionCoverage[0]?.reason).toBeNull();
    expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: flat.length, insert: source }] })).kind).toBe('ready');
    expectOuterOnly(owner);
  } finally { owner.dispose(); }
});

it.each([0, 1, 2, 3])('retains supported top-level fences with %s spaces of indentation', async indentation => {
  const prefix = ' '.repeat(indentation), owner = await MarkdownPilotDocument.open(`${prefix}\`\`\`json\n1\n${prefix}\`\`\`\n`);
  try { expect(owner.children).toHaveLength(1); expect(owner.injectionCoverage[0]?.reason).toBeNull(); }
  finally { owner.dispose(); }
});
