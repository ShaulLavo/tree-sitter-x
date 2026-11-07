import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { nativeDocument, nativeScopes } from '../src/native/adapter.ts';
import { Component } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import type { DecodedResult } from '../src/native/decode.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { Runtime, invoke } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { referenceTheme, styleForScopes } from '../src/baselines/theme.ts';
import type { StyleReference } from '../src/baselines/theme.ts';
import { ORACLE_THEMES } from '../src/oracles/pins.ts';
import type { CompleteResult } from '../src/schema.ts';
import { parseResult } from '../src/validate.ts';
import { observeRuntimeAllocations } from './native-observer.ts';

const allocations = observeRuntimeAllocations();
let observer: Foreign | undefined;
beforeAll(async () => {
  const runtime = await Runtime.load();
  observer = await runtime.extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
  invoke(observer, 'scope_test_install');
});
afterAll(() => {
  try { if (observer) invoke(observer, 'scope_test_reset'); }
  finally { allocations.restore(); }
});

const exactSources = [
  { label: 'empty', source: '', bytes: '', length: 0 },
  { label: 'BOM, CRLF, astral and combining text', source: '\ufeff["😀é",1]\r\n', bytes: 'efbbbf5b22f09f988065cc81222c315d0d0a', length: 13 },
  { label: 'LF', source: '[1]\n', bytes: '5b315d0a', length: 4 },
  { label: 'bare CR', source: '[1]\r', bytes: '5b315d0d', length: 4 },
  { label: 'lone high surrogate', source: '"\ud800"', bytes: '22eda08022', length: 3 },
  { label: 'lone low surrogate', source: '"\udc00"', bytes: '22edb08022', length: 3 },
  { label: 'replacement character', source: '"\ufffd"', bytes: '22efbfbd22', length: 3 },
] as const;

function scopeUnits(spans: ArrayLike<number>, paths: readonly (readonly number[])[], names: readonly string[]): string[][] {
  const units: string[][] = [];
  for (let i = 0; i < spans.length; i += 3) {
    const scopes = paths[spans[i + 2]].map(id => names[id]);
    units.push(...Array.from({ length: spans[i + 1] - spans[i] }, () => scopes));
  }
  return units;
}

function successfulScopes(pack: NativePack, owner: PilotDocument): DecodedResult {
  const result = nativeScopes(pack, owner);
  if (result.status !== 0) throw new Error(`Unexpected native status ${result.status}`);
  return result;
}

async function checkDocument(pack: NativePack, owner: PilotDocument, reference: StyleReference): Promise<CompleteResult> {
  const raw = successfulScopes(pack, owner);
  const result = await nativeDocument(pack, owner, reference);
  if (result.status !== 'complete') throw new Error(result.diagnostics.join('\n'));
  expect(parseResult(JSON.parse(JSON.stringify(result)), owner.source)).toEqual(result);
  expect(scopeUnits(result.spans, result.paths, result.scopeNames)).toEqual(scopeUnits(raw.segments, raw.paths, pack.scopes));
  expect(result.documentRevision).toBe(0);
  expect(result.metadata).toBeUndefined();
  expect(result.engine).toEqual({ ...pack.engine, styleReference: reference, themeMatcher: '@shikijs/vscode-textmate@10.0.2 Theme' });
  expect(Object.keys(result.styles ?? {})).toEqual(owner.source.length ? ORACLE_THEMES : []);
  return result;
}

async function checkReferenceStyles(result: CompleteResult, reference: StyleReference, offset: number): Promise<void> {
  const scopes = scopeUnits(result.spans, result.paths, result.scopeNames)[offset];
  for (const themeId of ORACLE_THEMES) {
    const track = result.styles?.[themeId];
    if (!track) throw new Error(`Missing reference theme ${themeId}`);
    const position = track.spans.findIndex((from, i) => i % 3 === 0 && from <= offset && track.spans[i + 1] > offset);
    expect(position).toBeGreaterThanOrEqual(0);
    expect(track.styles[track.spans[position + 2]]).toEqual(styleForScopes(await referenceTheme(themeId, reference), scopes));
  }
}

it.each(exactSources)('preserves exact $label source through raw scopes, reference painting and disposal', async fixture => {
  const pack = await loadLanguagePack('json');
  let owner: PilotDocument | undefined;
  try {
    owner = await PilotDocument.open('json', fixture.source);
    const result = await checkDocument(pack, owner, 'product');
    expect(owner.source).toBe(fixture.source);
    expect(result.sourceLength).toBe(fixture.length);
    expect(result.sourceSha256).toBe(createHash('sha256').update(Buffer.from(fixture.bytes, 'hex')).digest('hex'));
    const units = scopeUnits(result.spans, result.paths, result.scopeNames);
    if (fixture.source.endsWith('\n')) expect(units.slice(fixture.source.endsWith('\r\n') ? -2 : -1)).toEqual(fixture.source.endsWith('\r\n') ? [[], []] : [[]]);
    const snapshot = structuredClone(result);
    owner.dispose();
    pack.dispose();
    expect(result).toEqual(snapshot);
    expect(parseResult(result, fixture.source)).toEqual(snapshot);
  } finally { owner?.dispose(); pack.dispose(); }
});

it('keeps overlapping reference calls, fresh owners and copied outputs independent across disposal and heap growth', async () => {
  const component = await Component.load();
  await component.runtime.language('json');
  const coreBaseline = allocations.live(), nativeBaseline = component.liveAllocations();
  const mallocBefore = allocations.calls.get('malloc') ?? 0;
  const packs: NativePack[] = [], owners: PilotDocument[] = [];
  try {
    packs.push(await loadLanguagePack('json'));
    packs.push(await loadLanguagePack('json'));
    expect(packs[0].scopes).not.toBe(packs[1].scopes);
    owners.push(await PilotDocument.open('json', '[1,"😀"]\r\n'));
    owners.push(await PilotDocument.open('json', '[2,"😀"]\r\n'));
    expect(allocations.calls.get('malloc') ?? 0).toBeGreaterThan(mallocBefore);
    expect(allocations.live()).toBeGreaterThan(coreBaseline);
    const left = successfulScopes(packs[0], owners[0]), right = successfulScopes(packs[1], owners[1]);
    const retainedRaw = structuredClone(left), retainedRight = structuredClone(right);
    const pendingLeft = nativeDocument(packs[0], owners[0], 'raw');
    const pendingRight = nativeDocument(packs[1], owners[1], 'product');
    owners[0].dispose(); owners[0].dispose(); packs[0].dispose(); packs[0].dispose();
    const [leftDocument, rightDocument] = await Promise.all([pendingLeft, pendingRight]);
    if (leftDocument.status !== 'complete' || rightDocument.status !== 'complete') throw new Error('Independent reference calls failed');
    expect(leftDocument.sourceLength).toBe(rightDocument.sourceLength);
    expect(leftDocument.sourceSha256).not.toBe(rightDocument.sourceSha256);
    expect(() => nativeScopes(packs[1], owners[0])).toThrow('Deleted native document');
    await checkReferenceStyles(leftDocument, 'raw', 1);
    await checkReferenceStyles(rightDocument, 'product', 1);
    const fresh = await PilotDocument.open('json', owners[0].source);
    owners.push(fresh);
    expect(await nativeDocument(packs[1], fresh, 'raw')).toEqual(leftDocument);
    left.segments.fill(0);
    expect(Reflect.set(left.paths[1], '0', 999)).toBe(true);
    expect(successfulScopes(packs[1], fresh)).toEqual(retainedRaw);
    expect(right).toEqual(retainedRight);
    const logicalSnapshot = structuredClone(rightDocument);
    expect(Reflect.set(leftDocument.spans, '0', 999)).toBe(true);
    expect(rightDocument).toEqual(logicalSnapshot);
    const capacity = component.runtime.heap().length;
    allocations.growOnNextAllocation();
    expect(successfulScopes(packs[1], owners[1])).toEqual(retainedRight);
    expect(component.runtime.heap().length).toBeGreaterThan(capacity);
    expect(right).toEqual(retainedRight);
    expect(rightDocument).toEqual(logicalSnapshot);
  } finally {
    owners.forEach(owner => owner.dispose()); packs.forEach(pack => pack.dispose());
    expect(component.liveAllocations()).toBe(nativeBaseline);
    expect(allocations.live()).toBe(coreBaseline);
  }
});

it('distinguishes missing support, setup rejection, native budgets and disposed operational failures without partial output', async () => {
  const pack = await loadLanguagePack('json');
  const owners: PilotDocument[] = [];
  try {
    const owner = await PilotDocument.open('json', '[1,2]');
    owners.push(owner);
    await expect(loadLanguagePack('python')).rejects.toThrow('distinct variant');
    const unsupported = await nativeDocument(undefined, owner, 'product');
    expect(unsupported).toMatchObject({ status: 'unsupported', sourceLength: 5, documentRevision: 0, spans: [], paths: [], scopeNames: [], engine: {} });
    owner.borrow(pack.sameLanguage, borrow => {
      expect(pack.run(borrow, { start: 0, end: 5 }, { encoding: 2 })).toEqual({ status: 1, detail: 16, value: 2 });
      expect(pack.run(borrow, { start: 0, end: 5 }, { maxSegments: 1 })).toEqual({ status: 2, detail: 24, value: 1 });
    });
    const complete = await checkDocument(pack, owner, 'product');
    pack.dispose();
    expect(() => nativeScopes(pack, owner)).toThrow('Deleted native pack');
    const failed = await nativeDocument(pack, owner, 'product');
    expect(failed).toMatchObject({ status: 'error', sourceSha256: complete.sourceSha256, engine: pack.engine, spans: [], paths: [], scopeNames: [] });
    expect(failed.diagnostics).toContain('Deleted native pack');
    owner.dispose();
    const disposed = await nativeDocument(pack, owner, 'raw');
    expect(disposed.status).toBe('error');
    expect(disposed.diagnostics).toContain('Deleted native document');
  } finally { owners.forEach(owner => owner.dispose()); pack.dispose(); }
});
