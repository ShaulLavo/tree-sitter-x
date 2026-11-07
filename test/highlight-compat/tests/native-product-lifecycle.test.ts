import { afterAll, expect, it, vi } from 'vitest';
import { context, deferred, full, pathAt, product, styled, theme, value, resources } from './native-product-controls.ts';
import { Component } from '../src/native/component.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { PilotDocument } from '../src/native/owner.ts';
import * as packet from '../src/native/theme-packet.ts';
import * as framing from '../src/native/scope-framing.ts';
import { observeRuntimeAllocations } from './native-markdown-observer.ts';

const allocations = observeRuntimeAllocations();
afterAll(() => allocations.restore());

it('separates framing, narrowed limits, and same-name changed theme bytes while sharing identical view pairs', async () => {
  const source = 'a'.repeat(20001) + '\r\nZ', current = await context(source), lease = full(current), held = resources();
  const encode = vi.spyOn(packet, 'encodePathPacket'), project = vi.spyOn(framing, 'buildProduct'), resolve = vi.spyOn(NativeTheme.prototype, 'resolve');
  try {
    const second = current.session.attachView({ from: 20000, to: source.length }); current.session.flushOne();
    await current.presentation.select(current.view, async () => theme(), { framing: product });
    const first = held.hold(styled(current));
    await current.presentation.select(second, async () => theme(), { framing: product });
    expect(project).toHaveBeenCalledTimes(1); expect(encode).toHaveBeenCalledTimes(1); expect(resolve).toHaveBeenCalledTimes(1);
    const next = held.hold(styled(current, second));
    expect(next.snapshot.scopes.dictionary).toBe(first.snapshot.scopes.dictionary); next.release();
    const bytes = current.session.retainedBytes();
    expect(await current.presentation.select(second, async () => theme(), { framing: product, input: { paths: 0 } })).toMatchObject({ kind: 'budget', code: 'paths', limit: 0 });
    expect(await current.presentation.select(second, async () => theme(), { framing: product, resolve: { steps: 0 } })).toMatchObject({ kind: 'budget', code: 'resolve-steps', limit: 0 });
    expect(current.session.retainedBytes()).toBeLessThan(bytes);
    await current.presentation.select(second, async () => theme());
    const identity = held.hold(styled(current, second));
    expect(identity.snapshot.key.framing).toBe('identity-v1'); expect(pathAt(identity.snapshot.scopes, 20000)).not.toEqual([]); identity.release();
    await current.presentation.select(second, async () => theme('#abcdef'), { framing: product });
    const changed = held.hold(styled(current, second));
    expect(changed.snapshot.key.themeRevision).not.toBe(first.snapshot.key.themeRevision);
    expect(changed.snapshot.runs[0].style).toMatchObject({ foreground: '#abcdefff' });
    expect(changed.snapshot.scopes.dictionary).toBe(first.snapshot.scopes.dictionary);
    changed.release();
    expect(lease.projectFraming(product).snapshot.sourceFacts).toBe(first.snapshot.scopes.sourceFacts);
  } finally { held.release(); resolve.mockRestore(); project.mockRestore(); encode.mockRestore(); lease.release(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});

it('rejects invalid policies and raw/product mismatch before projection or native compilation', async () => {
  const current = await context('x\r'), compile = vi.spyOn(NativeTheme, 'compile'), project = vi.spyOn(framing, 'buildProduct'), acquire = async () => theme();
  try {
    const before = current.session.retainedBytes();
    for (const policy of ['unknown', null, 7]) {
      const result = await Reflect.apply(current.presentation.select, current.presentation, [current.view, acquire, { framing: policy }]);
      expect(result).toMatchObject({ kind: 'invalid', code: 'schema' });
    }
    expect(await current.presentation.select(current.view, async () => theme('#102030', 'raw'), { framing: product })).toMatchObject({ kind: 'unsupported', code: 'profile' });
    expect(project).not.toHaveBeenCalled(); expect(compile).not.toHaveBeenCalled(); expect(current.session.retainedBytes()).toBe(before);
  } finally { compile.mockRestore(); project.mockRestore(); current.dispose(); }
});

it.each(['cancel', 'abort', 'detach', 'edit', 'close', 'dispose', 'interest'] as const)('unwinds product acquisition after %s without a hidden full retain', async mode => {
  const current = await context('x\r'), gate = deferred<ReturnType<typeof theme>>(), abort = new AbortController();
  try {
    const pending = current.presentation.select(current.view, () => gate.promise, { framing: product, signal: abort.signal });
    if (mode === 'cancel') current.presentation.cancel(current.view);
    if (mode === 'abort') abort.abort();
    if (mode === 'detach') current.session.detachView(current.view);
    if (mode === 'edit') await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 0, to: 1, insert: 'y' }] });
    if (mode === 'close') current.owner.dispose();
    if (mode === 'dispose') current.presentation.dispose();
    if (mode === 'interest') current.session.request(current.view, { viewport: { from: 0, to: 1 }, theme: 4 });
    gate.resolve(theme()); expect((await pending).kind).toBe(mode === 'cancel' || mode === 'abort' ? 'canceled' : 'discarded');
    expect(current.presentation.acquire(current.view)).toBeUndefined(); current.dispose(); expect(current.session.retainedBytes()).toBe(0);
  } finally { gate.resolve(theme()); current.dispose(); }
});

it('late acquisition and compiled completion cannot delete a newer product request', async () => {
  const current = await context('a'.repeat(20001)), gate = deferred<ReturnType<typeof theme>>();
  const compile = NativeTheme.compile, entered = deferred<void>(), release = deferred<void>(); let calls = 0;
  const spy = vi.spyOn(NativeTheme, 'compile').mockImplementation(async (input, options) => {
    const result = await compile.call(NativeTheme, input, options);
    if (++calls === 1) { entered.resolve(); await release.promise; }
    return result;
  });
  try {
    const oldAcquire = current.presentation.select(current.view, () => gate.promise, { framing: product });
    const oldCompile = current.presentation.select(current.view, async () => theme(), { framing: product }); await entered.promise;
    const next = current.presentation.select(current.view, async () => theme('#abcdef'), { framing: product });
    gate.resolve(theme()); expect((await oldAcquire).kind).toBe('discarded');
    expect((await next).kind).toBe('complete'); release.resolve(); expect((await oldCompile).kind).toBe('discarded');
    const output = styled(current);
    try { expect(output.snapshot.runs[0].style).toMatchObject({ foreground: '#abcdefff' }); }
    finally { output.release(); }
  } finally { gate.resolve(theme()); release.resolve(); spy.mockRestore(); current.dispose(); }
});

it('old actual full lease lazily projects after equal-length edit/disposal with the source getter disabled', async () => {
  const source = 'a'.repeat(20001) + '\nZ', current = await context(source), old = full(current);
  try {
    await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 10000, to: 10001, insert: '\n' }] });
    current.dispose();
    const read = vi.spyOn(PilotDocument.prototype, 'source', 'get').mockImplementation(() => { throw new Error('Forbidden source read'); });
    try {
      const projected = old.projectFraming(product);
      expect(pathAt(projected.snapshot, 10000)).toEqual([]); expect(projected.snapshot.sourceFacts.oversized).toEqual([{ from: 0, to: 20001 }]);
      expect(current.session.presentationCurrent(old)).toBe(false);
    } finally { read.mockRestore(); }
  } finally { old.release(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});

it('keeps reopened session identities separate even when local result and view counters repeat', async () => {
  const current = await context('x\r'), old = full(current), held = resources();
  try {
    const oldProjection = old.projectFraming(product); current.presentation.dispose(); current.session.dispose();
    const session = ScopeSession.attach(current.owner, current.packs), presentation = new ThemePresentation(session);
    held.defer(() => session.dispose()); held.defer(() => presentation.dispose());
    const view = session.attachView({ from: 0, to: 2 }); session.flushOne(); const next = session.acquireFull(view);
    if (!next) throw new Error('Missing reopened scopes');
    held.hold(next);
    expect(next.snapshot.generation).toBe(old.snapshot.generation); expect(view).toBe(current.view);
    expect(next.snapshot).not.toBe(old.snapshot); expect(next.projectFraming(product)).not.toBe(oldProjection);
    next.release();
    expect((await presentation.select(view, async () => theme(), { framing: product })).kind).toBe('complete');
  } finally { held.release(); old.release(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});

it('keeps product cleanup correct under reentrant native result deletion', async () => {
  const current = await context('x\r'), component = await Component.load(), call = component.call;
  let replacement: ReturnType<ThemePresentation['select']> | undefined, fired = false;
  const spy = vi.spyOn(component, 'call').mockImplementation(function(name, args = []) {
    const result = call.call(component, name, args);
    if (name !== 'scope_compat_theme_result_delete' || fired) return result;
    fired = true; replacement = current.presentation.select(current.view, async () => theme('#abcdef'), { framing: product }); return result;
  });
  try {
    expect((await current.presentation.select(current.view, async () => theme(), { framing: product })).kind).toBe('discarded');
    if (!replacement) throw new Error('Missing reentrant selection');
    expect((await replacement).kind).toBe('complete'); const output = styled(current);
    try { expect(output.snapshot.key.framing).toBe(product); }
    finally { output.release(); }
  } finally { spy.mockRestore(); current.dispose(); }
});

it('notifies every reentrant subscriber and cleans up before a throwing listener propagates', async () => {
  const current = await context('x\r'); let notified = 0, nested = false;
  const stop = current.session.onPresentationChange(view => {
    if (view === null || nested) return;
    nested = true; current.session.detachView(current.view); throw new Error('Listener failure');
  });
  const count = current.session.onPresentationChange(() => { notified++; });
  try {
    await expect(current.presentation.select(current.view, async () => theme(), { framing: product })).rejects.toThrow('Presentation notification failed');
    expect(notified).toBe(2); expect(current.session.retainedBytes()).toBe(0);
  } finally { stop(); count(); current.dispose(); }
});

it('releases native/core allocations and old external product output after failed later phases and detach', async () => {
  const current = await context('a'.repeat(20001) + '\r\nZ'), component = await Component.load();
  try {
    await current.presentation.select(current.view, async () => theme(), { framing: product });
    current.session.detachView(current.view);
    const native = component.liveAllocations(), core = allocations.live();
    expect(allocations.calls.get('malloc')).toBeGreaterThan(0);
    for (let cycle = 0; cycle < 5; cycle++) await allocationCycle(current, component, native, core);
  } finally { current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});

it.each(['allocation', 'decode'] as const)('retains only the charged generation projection after native %s failure', async mode => {
  const current = await context('x\r'), component = await Component.load(), lease = full(current);
  lease.projectFraming(product);
  const native = component.liveAllocations(), core = allocations.live(), bytes = current.session.retainedBytes(), number = component.number;
  const spy = vi.spyOn(component, 'number').mockImplementation(function(name, args = []) {
    if (name === 'scope_compat_theme_resolve' && mode === 'allocation') return 0;
    const result = number.call(component, name, args);
    if (name === 'scope_compat_theme_resolve' && mode === 'decode') new DataView(component.runtime.heap().buffer).setUint32(result, 99, true);
    return result;
  });
  try {
    const outcome = current.presentation.select(current.view, async () => theme(), { framing: product });
    if (mode === 'allocation') expect(await outcome).toMatchObject({ kind: 'no-memory', code: 'allocation' });
    else await expect(outcome).rejects.toThrow('Invalid native theme result ABI');
    expect(current.session.retainedBytes()).toBe(bytes); expect(component.liveAllocations()).toBe(native); expect(allocations.live()).toBe(core);
    expect(current.presentation.acquire(current.view)).toBeUndefined();
    lease.release(); current.session.detachView(current.view); expect(current.session.retainedBytes()).toBe(0);
  } finally { spy.mockRestore(); lease.release(); current.dispose(); }
});

it('uses explicit zero/reset theme defaults for the empty plain path and empty styles for separators', async () => {
  const current = await context('x'.repeat(20001) + '\r');
  try {
    expect((await current.presentation.select(current.view, async () => theme('#00000000'), { framing: product })).kind).toBe('complete');
    const output = styled(current);
    try {
      expect(output.snapshot.runs[0].style).toEqual({ foreground: '#00000000', fontMask: 0, fontStyle: 'reset' });
      expect(output.snapshot.runs[1].style).toEqual({});
    } finally { output.release(); }
  } finally { current.dispose(); }
});

it('reports repeated projection budget failure without partial output or identity fallback', async () => {
  const current = await context(' \r', { retainedBytes: 1000 }), component = await Component.load(), build = vi.spyOn(framing, 'buildProduct');
  const bytes = current.session.retainedBytes(), native = component.liveAllocations(), core = allocations.live();
  try {
    expect(current.session.outcome(current.view)?.kind).toBe('complete');
    const acquire = async () => theme();
    for (let turn = 0; turn < 3; turn++) expect(await current.presentation.select(current.view, acquire, { framing: product })).toEqual({ kind: 'incomplete', reason: 'budget' });
    expect(build).not.toHaveBeenCalled(); expect(current.presentation.acquire(current.view)).toBeUndefined();
    expect(current.session.retainedBytes()).toBe(bytes); expect(component.liveAllocations()).toBe(native); expect(allocations.live()).toBe(core);
  } finally { build.mockRestore(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0);
});
async function allocationCycle(current: Awaited<ReturnType<typeof context>>, component: Component, native: number, core: number): Promise<void> {
  const view = current.session.attachView({ from: 0, to: 20004 }); current.session.flushOne();
  const input = value(theme());
  expect((await current.presentation.select(view, async () => ({ kind: 'ok', value: input, warnings: [] }), { framing: product })).kind).toBe('complete');
  const output = styled(current, view); expect(component.liveAllocations()).toBeGreaterThan(native);
  try {
    expect(await current.presentation.select(view, async () => theme(), { framing: product, resolve: { steps: 0 } })).toMatchObject({ kind: 'budget' });
    expect(await current.presentation.select(view, async () => theme(), { framing: product, compile: { steps: 0 } })).toMatchObject({ kind: 'budget' });
    current.session.detachView(view); expect(current.session.retainedBytes()).toBeGreaterThan(0);
    expect(pathAt(output.snapshot.scopes, 0)).toEqual([]);
  } finally { output.release(); current.session.detachView(view); }
  expect(component.liveAllocations()).toBe(native); expect(allocations.live()).toBe(core); expect(current.session.retainedBytes()).toBe(0);
}
