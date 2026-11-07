import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { acquired, context, reference, theme } from './native-theme-presentation-controls.ts';
import { Component } from '../src/native/component.ts';
import { ScopeSession, DEFAULT_SCOPE_LIMITS } from '../src/native/incremental.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { Runtime, invoke } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { observeRuntimeAllocations } from './native-markdown-observer.ts';
import * as packet from '../src/native/theme-packet.ts';

const allocations = observeRuntimeAllocations();
let observer: Foreign;
beforeAll(async () => {
  observer = await (await Runtime.load()).extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
  invoke(observer, 'scope_test_install');
});
afterAll(() => { try { if (observer) invoke(observer, 'scope_test_reset'); } finally { allocations.restore(); } });

it('shares one encoding and memo for two views, then keeps a retained dictionary alive after both detach', async () => {
  const current = await context(), component = await Component.load(), native = component.liveAllocations();
  const encode = vi.spyOn(packet, 'encodePathPacket'), number = vi.spyOn(component, 'number');
  try {
    const second = current.session.attachView({ from: 1, to: 2 }); current.session.flushOne();
    await current.presentation.select(current.view, async () => theme());
    const first = acquired(current), bytes = current.session.retainedBytes();
    await current.presentation.select(second, async () => theme());
    expect(encode).toHaveBeenCalledTimes(1);
    expect(number.mock.calls.filter(([name]) => name === 'scope_compat_theme_resolve')).toHaveLength(1);
    const next = acquired(current, second); expect(next.snapshot.scopes.dictionary).toBe(first.snapshot.scopes.dictionary);
    const duplicate = next.retain(); expect(current.session.retainedBytes()).toBeGreaterThan(bytes); const shared = current.session.retainedBytes();
    duplicate.release(); duplicate.release(); expect(current.session.retainedBytes()).toBe(shared);
    current.session.detachView(current.view); current.session.detachView(second);
    expect(current.session.retainedBytes()).toBeGreaterThan(0); expect(component.liveAllocations()).toBeGreaterThan(native);
    reference(first, current.owner.source); reference(next, current.owner.source); first.release(); reference(next, current.owner.source);
    next.release(); expect(current.session.retainedBytes()).toBe(0); expect(component.liveAllocations()).toBe(native);
    expect(() => next.snapshot).toThrow('Released presentation lease'); expect(() => next.retain()).toThrow();
  } finally { number.mockRestore(); encode.mockRestore(); current.dispose(); }
});

it.each(['json', 'markdown'])('returns warmed %s core/component baselines after 100 actual two-view/theme lifetimes', async language => {
  const source = language === 'json' ? '[1,2]\n' : '```json\n1\n```\n```tsx\n<div/>\n```\n';
  const current = await context(language, source), component = await Component.load();
  try {
    await current.presentation.select(current.view, async () => theme()); current.session.detachView(current.view);
    const core = allocations.live(), native = component.liveAllocations();
    for (let cycle = 0; cycle < 100; cycle++) await cycleViews(current, source, core, native, component);
    expect(current.owner.observe().kind).toBe('ready');
  } finally { current.dispose(); }
});
async function cycleViews(current: Awaited<ReturnType<typeof context>>, source: string, core: number, native: number, component: Component): Promise<void> {
  const left = current.session.attachView({ from: 0, to: source.length }), right = current.session.attachView({ from: 1, to: 2 });
  for (let turn = 0; turn < 4; turn++) current.session.flushOne();
  await current.presentation.select(left, async () => theme()); await current.presentation.select(right, async () => theme());
  const retained = acquired(current, right); expect(component.liveAllocations()).toBeGreaterThan(native);
  await current.presentation.select(left, async () => theme('inheritance-changed')); current.session.detachView(left);
  reference(retained, source); current.session.detachView(right); expect(current.session.retainedBytes()).toBeGreaterThan(0);
  retained.release(); expect(current.session.retainedBytes()).toBe(0); expect(component.liveAllocations()).toBe(native); expect(allocations.live()).toBe(core);
}

it('refreshes the real shared heap during presentation and releases a corrupt native decode result', async () => {
  const current = await context(), component = await Component.load(), native = component.liveAllocations(), bytes = current.session.retainedBytes();
  const number = component.number; let grew = false, corrupt = false;
  const spy = vi.spyOn(component, 'number').mockImplementation(function(name, args = []) {
    const result = number.call(component, name, args);
    if (name !== 'scope_compat_theme_resolve') return result;
    if (!grew) { grew = true; invoke(observer, 'scope_test_grow_heap'); }
    if (corrupt) new DataView(component.runtime.heap().buffer).setUint32(result, 99, true);
    return result;
  });
  try {
    const before = component.runtime.heap().length;
    expect((await current.presentation.select(current.view, async () => theme())).kind).toBe('complete');
    expect(grew).toBe(true); expect(component.runtime.heap().length).toBe(before + 65536);
    const held = acquired(current); reference(held, current.owner.source); held.release();
    corrupt = true;
    await expect(current.presentation.select(current.view, async () => theme('inheritance-changed'))).rejects.toThrow('Invalid native theme result ABI');
    expect(current.presentation.acquire(current.view)).toBeUndefined(); expect(component.liveAllocations()).toBe(native);
    expect(current.session.retainedBytes()).toBe(bytes);
  } finally { spy.mockRestore(); current.dispose(); }
});

it.each(['scope_compat_bytes_new', 'scope_compat_theme_new', 'scope_compat_theme_resolve'])('does not admit null allocation from %s', async failed => {
  const current = await context(), component = await Component.load(), native = component.liveAllocations(), bytes = current.session.retainedBytes();
  const original = component.number;
  const spy = vi.spyOn(component, 'number').mockImplementation((name, args = []) => name === failed ? 0 : original.call(component, name, args));
  try {
    expect(await current.presentation.select(current.view, async () => theme())).toMatchObject({ kind: 'no-memory', code: 'allocation' });
    expect(current.presentation.acquire(current.view)).toBeUndefined(); expect(component.liveAllocations()).toBe(native);
    expect(current.session.retainedBytes()).toBe(bytes);
  } finally { spy.mockRestore(); current.dispose(); }
});

it.each(['compile', 'input', 'resolve'] as const)('propagates the whole %s budget outcome with no styles', async phase => {
  const current = await context(), component = await Component.load(), native = component.liveAllocations(), bytes = current.session.retainedBytes();
  const options = phase === 'compile' ? { compile: { steps: 0 } } : phase === 'input' ? { input: { paths: 0 } } : { resolve: { steps: 0 } };
  try {
    const result = await current.presentation.select(current.view, async () => theme(), options);
    expect(result).toMatchObject({ kind: 'budget', code: phase === 'compile' ? 'compile-steps' : phase === 'input' ? 'paths' : 'resolve-steps', limit: 0 });
    expect(current.presentation.acquire(current.view)).toBeUndefined(); expect(component.liveAllocations()).toBe(native); expect(current.session.retainedBytes()).toBe(bytes);
  } finally { current.dispose(); }
});

it('enforces narrowed path/resolve limits even while another view retains a warmed memo', async () => {
  const current = await context();
  try {
    const next = current.session.attachView({ from: 1, to: 2 }); current.session.flushOne();
    await current.presentation.select(current.view, async () => theme());
    const before = current.session.retainedBytes();
    expect(await current.presentation.select(next, async () => theme(), { input: { paths: 0 } })).toMatchObject({ kind: 'budget', code: 'paths', limit: 0 });
    expect(await current.presentation.select(next, async () => theme(), { resolve: { steps: 0 } })).toMatchObject({ kind: 'budget', code: 'resolve-steps', limit: 0 });
    expect(current.presentation.acquire(next)).toBeUndefined(); expect(current.session.retainedBytes()).toBe(before);
    const held = acquired(current); reference(held, current.owner.source); held.release();
  } finally { current.dispose(); }
});

it('copies declared limits before deferred acquisition and rejects malformed limits without retaining output', async () => {
  const current = await context(), before = current.session.retainedBytes();
  try {
    const resolve = { steps: 0 }, pending = current.presentation.select(current.view, async () => theme(), { resolve }); resolve.steps = 1000000;
    expect(await pending).toMatchObject({ kind: 'budget', code: 'resolve-steps', limit: 0 });
    expect(await current.presentation.select(current.view, async () => theme(), { compile: { steps: -1 } })).toMatchObject({ kind: 'invalid', code: 'schema' });
    expect(current.session.retainedBytes()).toBe(before); expect(current.presentation.acquire(current.view)).toBeUndefined();
  } finally { current.dispose(); }
});

it('charges encoded paths, memos and output to the actual retained-output cap and unwinds failed reservations', async () => {
  const current = await context(), component = await Component.load(), native = component.liveAllocations();
  await current.presentation.select(current.view, async () => theme()); const ceiling = current.session.retainedBytes();
  current.presentation.dispose(); current.session.dispose();
  const session = ScopeSession.attach(current.owner, current.packs, { ...DEFAULT_SCOPE_LIMITS, retainedBytes: ceiling - 1 }), presentation = new ThemePresentation(session);
  try {
    const view = session.attachView({ from: 0, to: current.owner.source.length }); session.flushOne(); const before = session.retainedBytes();
    expect(await presentation.select(view, async () => theme())).toEqual({ kind: 'incomplete', reason: 'budget' });
    expect(session.retainedBytes()).toBe(before); expect(presentation.acquire(view)).toBeUndefined(); expect(component.liveAllocations()).toBe(native);
  } finally { presentation.dispose(); session.dispose(); current.dispose(); }
});
