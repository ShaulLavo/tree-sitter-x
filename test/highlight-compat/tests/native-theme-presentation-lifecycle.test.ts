import { expect, it, vi } from 'vitest';
import { acquired, acquisition, complete, context, deferred, reference, theme, value } from './native-theme-presentation-controls.ts';
import { Component } from '../src/native/component.ts';
import { NativeTheme } from '../src/native/theme.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';

it('old acquisition and its cleanup cannot clear a newer pending selection on the same scope request', async () => {
  const current = await context(), first = deferred<ReturnType<typeof theme>>(), second = deferred<ReturnType<typeof theme>>();
  try {
    const old = current.presentation.select(current.view, () => first.promise);
    const next = current.presentation.select(current.view, () => second.promise);
    first.resolve(theme()); expect((await old).kind).toBe('discarded');
    expect(current.presentation.acquire(current.view)).toBeUndefined();
    second.resolve(theme('inheritance-changed')); expect((await next).kind).toBe('complete');
    const output = acquired(current); reference(output, current.owner.source, 'inheritance-changed'); output.release();
  } finally { first.resolve(theme()); second.resolve(theme()); current.dispose(); }
});

it.each(['cancel', 'abort', 'detach', 'close', 'dispose', 'interest', 'theme', 'edit'] as const)('rejects deferred acquisition after %s without restoring output', async mode => {
  const current = await context(), gate = deferred<ReturnType<typeof theme>>(), abort = new AbortController();
  try {
    const pending = current.presentation.select(current.view, () => gate.promise, { signal: abort.signal });
    const full = current.session.acquireFull(current.view);
    if (!full?.publication) throw new Error('Missing selection identity');
    const selectedTheme = full.publication.theme; full.release();
    if (mode === 'cancel') current.presentation.cancel(current.view);
    if (mode === 'abort') abort.abort();
    if (mode === 'detach') current.session.detachView(current.view);
    if (mode === 'close') current.owner.dispose();
    if (mode === 'dispose') current.presentation.dispose();
    if (mode === 'interest') current.session.request(current.view, { viewport: { from: 1, to: 2 }, theme: selectedTheme });
    if (mode === 'theme') current.session.selectTheme(current.view);
    if (mode === 'edit') await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 1, to: 2, insert: '3' }] });
    gate.resolve(theme()); expect((await pending).kind).toBe(mode === 'cancel' || mode === 'abort' ? 'canceled' : 'discarded');
    expect(current.presentation.acquire(current.view)).toBeUndefined();
    current.dispose(); expect(current.session.retainedBytes()).toBe(0);
  } finally { gate.resolve(theme()); current.dispose(); }
});

it('rejects copied old native output and leaves a reentrant newer request publishable', async () => {
  const current = await context(), component = await Component.load(), call = component.call;
  let replacement: ReturnType<ThemePresentation['select']> | undefined, fired = false;
  const spy = vi.spyOn(component, 'call').mockImplementation(function(name, args = []) {
    const result = call.call(component, name, args);
    if (name !== 'scope_compat_theme_result_delete' || fired) return result;
    fired = true; replacement = current.presentation.select(current.view, acquisition('inheritance-changed')); return result;
  });
  try {
    expect((await current.presentation.select(current.view, acquisition())).kind).toBe('discarded'); expect(fired).toBe(true);
    if (!replacement) throw new Error('Replacement was not armed');
    expect((await replacement).kind).toBe('complete');
    const output = acquired(current); reference(output, current.owner.source, 'inheritance-changed'); output.release();
  } finally { spy.mockRestore(); current.dispose(); }
});

it('rejects an already aborted selection before acquisition without touching shared scope pending work', async () => {
  const current = await context(), abort = new AbortController(), acquire = vi.fn(async () => theme());
  try {
    abort.abort(); expect((await current.presentation.select(current.view, acquire, { signal: abort.signal })).kind).toBe('canceled');
    expect(acquire).not.toHaveBeenCalled(); expect(current.session.outcome(current.view)?.kind).toBe('complete');
    expect((await current.presentation.select(current.view, acquire)).kind).toBe('complete');
  } finally { current.dispose(); }
});

it('releases a compiled old theme after replacement while preserving a later completed pair', async () => {
  const current = await context(), component = await Component.load(), baseline = component.liveAllocations();
  const original = NativeTheme.compile, entered = deferred<void>(), gate = deferred<void>(); let calls = 0;
  const compile = vi.spyOn(NativeTheme, 'compile').mockImplementation(async (input, options) => {
    const result = await original.call(NativeTheme, input, options);
    if (++calls === 1) { entered.resolve(); await gate.promise; }
    return result;
  });
  try {
    const pending = current.presentation.select(current.view, async () => theme()); await entered.promise;
    expect(component.liveAllocations()).toBeGreaterThan(baseline);
    expect((await current.presentation.select(current.view, async () => theme('inheritance-changed'))).kind).toBe('complete');
    const held = acquired(current), alive = component.liveAllocations();
    gate.resolve(); expect((await pending).kind).toBe('discarded');
    expect(component.liveAllocations()).toBeLessThan(alive); reference(held, current.owner.source, 'inheritance-changed');
    current.session.detachView(current.view); expect(component.liveAllocations()).toBeGreaterThan(baseline);
    reference(held, current.owner.source, 'inheritance-changed'); held.release(); expect(component.liveAllocations()).toBe(baseline);
  } finally { gate.resolve(); compile.mockRestore(); current.dispose(); }
});

it('old compiled completion cannot install into a reopened epoch with reused local request/view/result integers', async () => {
  const old = await context(), component = await Component.load(), original = NativeTheme.compile;
  const entered = deferred<void>(), gate = deferred<void>(); let calls = 0;
  const compile = vi.spyOn(NativeTheme, 'compile').mockImplementation(async (input, options) => {
    const result = await original.call(NativeTheme, input, options);
    if (++calls === 1) { entered.resolve(); await gate.promise; }
    return result;
  });
  try {
    const previous = old.session.acquireFull(old.view);
    if (!previous) throw new Error('Missing old generation');
    const key = previous.snapshot; previous.release();
    const pending = old.presentation.select(old.view, async () => theme()); await entered.promise; old.dispose();
    const next = await context('json', '"changed"');
    try {
      const result = complete(await next.presentation.select(next.view, acquisition('inheritance-changed')));
      expect(result.key.work.request).toBe(key.work.request); expect(result.key.generation).toBe(key.generation);
      expect(result.key.view.view).toBe(old.view); expect(result.key.owner.epoch).not.toBe(key.owner.epoch);
      const before = component.liveAllocations(); gate.resolve(); expect((await pending).kind).toBe('discarded');
      expect(component.liveAllocations()).toBeLessThan(before);
      const held = acquired(next); reference(held, next.owner.source, 'inheritance-changed'); held.release();
    } finally { next.dispose(); }
  } finally { gate.resolve(); compile.mockRestore(); old.dispose(); }
});

it('returns operational acquisition failures and propagates contract errors after releasing request leases', async () => {
  const current = await context(), baseline = current.session.retainedBytes();
  try {
    expect(await current.presentation.select(current.view, async () => { throw new Error('external failure'); })).toEqual({ kind: 'error', code: 'acquisition-failed', location: { kind: 'request' } });
    const compile = vi.spyOn(NativeTheme, 'compile').mockRejectedValue(new Error('contract failure'));
    try { await expect(current.presentation.select(current.view, acquisition())).rejects.toThrow('contract failure'); }
    finally { compile.mockRestore(); }
    expect(current.session.retainedBytes()).toBe(baseline); expect(current.presentation.acquire(current.view)).toBeUndefined();
  } finally { current.dispose(); }
});

it('never presents missing or incomplete scopes and never starts acquisition to recreate them', async () => {
  const current = await context(), acquire = vi.fn(async () => theme());
  try {
    await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 0, to: 7, insert: '2' }] });
    expect(await current.presentation.select(current.view, acquire)).toEqual({ kind: 'unavailable', reason: 'scope-not-current' });
    expect(acquire).not.toHaveBeenCalled();
    current.session.request(current.view, { viewport: { from: 0, to: 1 }, theme: 0 }); current.session.flushOne();
    expect((await current.presentation.select(current.view, acquire)).kind).toBe('complete');
  } finally { current.dispose(); }
});

it('has one presentation attachment and cleans up failed constructors without poisoning reattachment', async () => {
  const current = await context();
  try {
    expect(() => new ThemePresentation(current.session)).toThrow('already attached');
    current.presentation.dispose(); const replacement = new ThemePresentation(current.session);
    try { expect((await replacement.select(current.view, acquisition())).kind).toBe('complete'); }
    finally { replacement.dispose(); }
    current.session.dispose(); expect(() => new ThemePresentation(current.session)).toThrow('Disposed');
  } finally { current.dispose(); }
});

it('cleans a rejected theme result without publishing a partial style array', async () => {
  const current = await context();
  try {
    expect(await current.presentation.select(current.view, async () => ({ kind: 'unsupported', code: 'selector', location: { kind: 'request' } }))).toEqual({ kind: 'unsupported', code: 'selector', location: { kind: 'request' } });
    expect(current.presentation.acquire(current.view)).toBeUndefined();
    const compiled = value(await NativeTheme.compile(value(theme()))); compiled.dispose();
  } finally { current.dispose(); }
});

it('removes the captured abort listener even when the caller replaces its options signal', async () => {
  const current = await context(), first = new AbortController(), second = new AbortController(), gate = deferred<ReturnType<typeof theme>>();
  const options = { signal: first.signal }, remove = vi.spyOn(first.signal, 'removeEventListener');
  try {
    const pending = current.presentation.select(current.view, () => gate.promise, options); options.signal = second.signal;
    gate.resolve(theme()); expect((await pending).kind).toBe('complete'); expect(remove).toHaveBeenCalledTimes(1);
  } finally { gate.resolve(theme()); remove.mockRestore(); current.dispose(); }
});

it('releases the acquired scope lease if abort-listener registration throws', async () => {
  const current = await context(), abort = new AbortController();
  const releases = scopeReleases(current.session);
  const add = vi.spyOn(abort.signal, 'addEventListener').mockImplementation(() => { throw new Error('listener registration'); });
  try {
    await expect(current.presentation.select(current.view, acquisition(), { signal: abort.signal })).rejects.toThrow('listener registration');
    expect(releases.count()).toBe(1);
    current.session.detachView(current.view); expect(current.session.retainedBytes()).toBe(0);
  } finally { add.mockRestore(); releases.restore(); current.dispose(); }
});
function scopeReleases(session: Awaited<ReturnType<typeof context>>['session']) {
  const original = session.acquireFull; let count = 0;
  const spy = vi.spyOn(session, 'acquireFull').mockImplementation(view => {
    const lease = original.call(session, view);
    if (!lease) return undefined;
    return { get snapshot() { return lease.snapshot; }, publication: lease.publication, retain: lease.retain, reserve: lease.reserve,
      release: () => { count++; lease.release(); } };
  });
  return { count: () => count, restore: () => spy.mockRestore() };
}
