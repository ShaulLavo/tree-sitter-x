import { expect, it, vi } from 'vitest';
import { OutputStore, OutputBudgetError, clipSnapshot, packIntervals } from '../src/native/scope-output.ts';
import type { ScopeLease, ScopeSnapshot } from '../src/native/scope-output.ts';
import * as framing from '../src/native/scope-framing.ts';
import { counter } from '../src/native/owner-state.ts';
import { product, context, full, resources } from './native-product-controls.ts';

function raw(source: string): ScopeSnapshot {
  const owner = Object.freeze({ epoch: counter<'DocumentEpoch'>(1), revision: counter<'Revision'>(0), syntax: counter<'SyntaxGeneration'>(0) });
  const generation = counter<'ResultGeneration'>(1), work = Object.freeze({ ...owner, request: counter<'RequestId'>(1) });
  const packed = packIntervals(source.length ? [{ from: 0, to: source.length, scopes: ['source.control'] }] : [], source.length);
  const sourceFacts = framing.collectSourceFacts(source, { owner, generation }, { ranges: 100, bytes: 10000 });
  return Object.freeze({
    ...packed, owner, generation, work, coverage: Object.freeze({ from: 0, to: source.length }),
    sourceLength: source.length, metadata: null, separators: sourceFacts.separators, sourceFacts, injections: Object.freeze([]), diagnostics: Object.freeze([])
  });
}

it('uses independently calculated exact/first-over charges and includes active work in every admission', () => {
  const snapshot = raw('x\r'), store = new OutputStore(1572), lease = store.admitFull(snapshot), work = {}, heldResources = resources();
  try {
    expect(store.bytes()).toBe(460);
    expect(lease.projectFraming('identity-v1').snapshot).toBe(snapshot); expect(store.bytes()).toBe(460);
    store.working(work, 1);
    expect(() => lease.projectFraming(product)).toThrow(OutputBudgetError); expect(store.bytes()).toBe(461);
    expect(() => lease.reserve(1112)).toThrow(OutputBudgetError);
    const drop = lease.reserve(960);
    heldResources.defer(drop);
    expect(() => store.retain(clipSnapshot(snapshot, snapshot.coverage))).toThrow(OutputBudgetError);
  } finally { heldResources.release(); store.clearWorking(work); lease.release(); }
  expect(store.bytes()).toBe(0);
  const exact = new OutputStore(1572), held = exact.admitFull(snapshot);
  try { held.projectFraming(product); expect(exact.bytes()).toBe(1572); }
  finally { held.release(); }
  expect(exact.bytes()).toBe(0);
  const firstOver = new OutputStore(1571), rejected = firstOver.admitFull(snapshot);
  try {
    repeatRejected(rejected);
    expect(firstOver.bytes()).toBe(460);
  } finally { rejected.release(); }
  expect(firstOver.bytes()).toBe(0);
});
function repeatRejected(lease: ScopeLease): void {
  for (let turn = 0; turn < 3; turn++) expect(() => lease.projectFraming(product)).toThrow(OutputBudgetError);
}

it('checks the real TypeScript root-only candidate at independently calculated 450 and 449 byte ceilings', async () => {
  const exact = await context('\r', { retainedBytes: 450 }), firstOver = await context('\r', { retainedBytes: 449 });
  try {
    expect(exact.session.retainedBytes()).toBe(450);
    expect(exact.session.outcome(exact.view)).toMatchObject({ kind: 'incomplete', reason: 'budget' });
    expect(firstOver.session.retainedBytes()).toBe(0);
    expect(firstOver.session.outcome(firstOver.view)).toMatchObject({ kind: 'incomplete', reason: 'budget' });
    exact.session.detachView(exact.view); expect(exact.session.retainedBytes()).toBe(0);
  } finally { exact.dispose(); firstOver.dispose(); }
});

it('rejects full-window clips before planning and releases projection while clipped-only facts survive', () => {
  const snapshot = raw('x\r'), store = new OutputStore(10000), lease = store.admitFull(snapshot);
  const clip = store.retain(clipSnapshot(snapshot, snapshot.coverage)), copied = clip.retain(), plan = vi.spyOn(framing, 'planProduct');
  try {
    const before = store.bytes();
    expect(() => clip.projectFraming(product)).toThrow('Raw full'); expect(() => copied.projectFraming('identity-v1')).toThrow('Raw full');
    expect(plan).not.toHaveBeenCalled(); expect(store.bytes()).toBe(before);
    const projected = lease.projectFraming(product), second = lease.retain();
    expect(second.projectFraming(product)).toBe(projected); expect(plan).toHaveBeenCalledTimes(1);
    lease.release(); expect(store.bytes()).toBe(1724); second.release();
    expect(store.bytes()).toBe(460); expect(clip.snapshot.sourceFacts.finalCr).toEqual({ from: 1, to: 2 });
    expect(() => lease.projectFraming(product)).toThrow('Released'); clip.release(); expect(store.bytes()).toBe(460);
  } finally { plan.mockRestore(); lease.release(); clip.release(); copied.release(); }
  expect(store.bytes()).toBe(0);
});

it('charges the aliased LF separator array and shared facts exactly once', () => {
  const snapshot = raw('x\n'), store = new OutputStore(10000), lease = store.admitFull(snapshot);
  const clipped = store.retain(clipSnapshot(snapshot, snapshot.coverage));
  try {
    expect(snapshot.separators).toBe(snapshot.sourceFacts.separators);
    expect(store.bytes()).toBe(612);
    const retained = clipped.retain(); expect(store.bytes()).toBe(612); retained.release();
    lease.release(); expect(store.bytes()).toBe(460);
  } finally { lease.release(); clipped.release(); }
  expect(store.bytes()).toBe(0);
});

it('bounds eager fact ranges/bytes and projection splits without retaining partial results', async () => {
  const dense = await context('\n\n', { maxSegments: 1 });
  try { expect(dense.session.outcome(dense.view)).toMatchObject({ kind: 'incomplete', reason: 'budget' }); expect(dense.session.retainedBytes()).toBe(0); }
  finally { dense.dispose(); }
  const snapshot = raw('x\r'), store = new OutputStore(10000, 1), lease = store.admitFull(snapshot);
  try { expect(() => lease.projectFraming(product)).toThrow(OutputBudgetError); expect(store.bytes()).toBe(460); }
  finally { lease.release(); }
  for (const bytes of [255, 271]) expect(() => framing.collectSourceFacts(bytes === 255 ? '' : '\r', { owner: snapshot.owner, generation: snapshot.generation }, { ranges: 1, bytes })).toThrow(OutputBudgetError);
});

it('old actual full leases see new Markdown decoded-child charges through the common store', async () => {
  const source = '```json\n1\n```\n```json\n2\n```\n', current = await context(source, { retainedBytes: 10000 }, true);
  const old = full(current), held = resources();
  try {
    await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 8, to: 9, insert: '3' }] });
    const retained = current.session.retainedBytes(); current.session.flushOne();
    const working = current.session.retainedBytes() - retained; expect(working).toBeGreaterThan(0);
    const drop = old.reserve(10000 - current.session.retainedBytes());
    held.defer(drop);
    expect(() => old.projectFraming(product)).toThrow(OutputBudgetError); expect(() => old.reserve(1)).toThrow(OutputBudgetError); drop();
    current.session.cancel(current.view, counter<'InterestGeneration'>(1));
    expect(current.session.retainedBytes()).toBe(retained);
    expect(old.projectFraming(product).kind).toBe('product-lines');
  } finally { held.release(); old.release(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});
