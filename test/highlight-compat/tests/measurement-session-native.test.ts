import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { runSessionIteration, armSessionControls } from '../src/measurement/session.ts';
import { openMeasurementContext } from '../src/measurement/context.ts';
import type { MeasurementContext } from '../src/measurement/context.ts';
import { BUILTIN_CASE, SESSION_LIMITS, numericLimits } from '../src/measurement/session-case.ts';
import type { SessionRequest } from '../src/measurement/session-case.ts';
import { normalizedThemes } from '../src/measurement/session-theme.ts';
import { installSessionCallCounters } from '../src/measurement/session-observer.ts';
import { replaceMethod } from '../src/measurement/observer.ts';
import { semanticCheckpoint } from '../src/measurement/session-checkpoint.ts';
import { foreign } from '../src/native/runtime.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import type { PresentationLease } from '../src/native/theme-presentation.ts';
import * as packet from '../src/native/theme-packet.ts';

const request: SessionRequest = { adapter: 'session-native', lane: 'end-to-end-adapter', case: BUILTIN_CASE, repetitions: 1, warmups: 0, reportBudget: SESSION_LIMITS.reportBytes };
let ctx: MeasurementContext;
beforeAll(async () => { ctx = await openMeasurementContext('json'); });
afterAll(() => ctx?.dispose());

it('restores exact descriptors, preserves receiver/arguments/results/thrown identity and restores idempotently', () => {
  const error = new Error('same'), object = { value: 7, call(this: { value: number }, arg: unknown) { if (arg === error) throw error; return [this.value, arg]; } };
  Object.defineProperty(object, 'call', { value: object.call, enumerable: true, configurable: true, writable: false });
  const descriptor = Object.getOwnPropertyDescriptor(object, 'call');
  const restore = replaceMethod(object, 'call', original => function(this: unknown, ...args: unknown[]) { return Reflect.apply(original, this, args); });
  expect(object.call(object)).toEqual([7, object]); expect(() => object.call(error)).toThrow(error);
  restore(); restore(); expect(Object.getOwnPropertyDescriptor(object, 'call')).toEqual(descriptor);
  const parent = { call() { return 1; } }, child = Object.create(parent);
  const inherited = replaceMethod(child, 'call', original => function(this: unknown, ...args: unknown[]) { return Reflect.apply(original, this, args); });
  inherited(); expect(Object.hasOwn(child, 'call')).toBe(false);
});

it('runs actual edits and theme-only work, retains edited A encoding through B and rejects broken report sequences', async () => {
  const counters = installSessionCallCounters(ctx), themes = normalizedThemes(BUILTIN_CASE), encode = vi.spyOn(packet, 'encodePathPacket');
  const before = ctx.component.liveAllocations();
  try {
    const sample = await runSessionIteration(ctx, request, themes, counters, undefined, 0, performance.now(), SESSION_LIMITS);
    expect(encode).toHaveBeenCalledTimes(2);
    expect(sample.steps.map(step => step.counts)).toMatchObject([
      { parseCalls: { value: 1 }, scopeCalls: { value: 1 } }, { parseCalls: { value: 1 }, scopeCalls: { value: 1 } },
      { parseCalls: { value: 0 }, scopeCalls: { value: 0 }, themeResolveCalls: { value: 1 } }, {},
    ]);
    expect(sample.checkpoints[1].stylesSha256).not.toBe(sample.checkpoints[2].stylesSha256);
    expect(sample.memory.find(item => item.phase === 'initial-callers-released')?.value).toMatchObject({ adapterHeldScopeLeases: 0, adapterHeldPresentationLeases: 0 });
    expect(sample.memory.find(item => item.phase === 'edited-b-with-a-live')?.value).toMatchObject({ adapterHeldScopeLeases: 2, adapterHeldPresentationLeases: 2 });
    expect(sample.memory.at(-1)?.value.retainedOutputBudgetChargeBytes.value).toBe(0);
    expect(ctx.component.liveAllocations()).toBe(before);
  } finally { encode.mockRestore(); counters.restore(); }
});

it.each([false, true])('proves early A style release requires another encoding even with raw scope held: %s', async rawHeld => {
  const owner = await PilotDocument.open('json', BUILTIN_CASE.source, numericLimits()), resources: (() => void)[] = [() => owner.dispose()];
  const encode = vi.spyOn(packet, 'encodePathPacket'), themes = normalizedThemes(BUILTIN_CASE);
  try {
    const session = ScopeSession.attach(owner, new Map([['json', ctx.pack]])); resources.push(() => session.dispose());
    const presentation = new ThemePresentation(session); resources.push(() => presentation.dispose());
    const view = session.attachView({ from: 0, to: owner.source.length }); session.flushOne();
    await presentation.select(view, async () => ({ kind: 'ok', value: themes[0], warnings: [] }));
    const raw = session.acquireFull(view), a = presentation.acquire(view); if (!raw || !a) throw new Error('Missing test leases');
    resources.push(raw.release, a.release); a.release();
    if (!rawHeld) raw.release();
    await presentation.select(view, async () => ({ kind: 'ok', value: themes[1], warnings: [] }));
    expect(encode).toHaveBeenCalledTimes(2);
    session.detachView(view); raw.release(); expect(session.retainedBytes()).toBe(0);
  } finally { encode.mockRestore(); for (const release of resources.reverse()) release(); }
});

it('canonical checkpoint identities exclude admission counters and preserve lone surrogates, and enforce exact encoded ceilings', async () => {
  const themes = normalizedThemes(BUILTIN_CASE);
  const open = async (source: string) => {
    const owner = await PilotDocument.open('json', source, numericLimits());
    const session = ScopeSession.attach(owner, new Map([['json', ctx.pack]])); const presentation = new ThemePresentation(session);
    const view = session.attachView({ from: 0, to: source.length }); session.flushOne();
    await presentation.select(view, async () => ({ kind: 'ok', value: themes[0], warnings: [] }));
    const scope = session.acquireFull(view), style = presentation.acquire(view);
    if (!scope || !style) throw new Error('Missing checkpoint lease');
    return { encode: (limit: number) => semanticCheckpoint(source, scope, style, themes[0], 'initial-a', limit), dispose: () => {
      style.release(); scope.release(); presentation.dispose(); session.dispose(); owner.dispose();
    } };
  };
  const a = await open('"\ud800"'), b = await open('"\ud800"'), replacement = await open('"�"');
  try {
    const first = a.encode(SESSION_LIMITS.checkpointBytes), second = b.encode(SESSION_LIMITS.checkpointBytes);
    expect(first.semanticSha256).toBe(second.semanticSha256); expect(first.scope.owner.epoch).not.toBe(second.scope.owner.epoch);
    expect(first.sourceWtf8Sha256).not.toBe(replacement.encode(SESSION_LIMITS.checkpointBytes).sourceWtf8Sha256);
    expect(a.encode(first.serializedPayloadBytes).serializedPayloadBytes).toBe(first.serializedPayloadBytes);
    expect(() => a.encode(first.serializedPayloadBytes - 1)).toThrow(/budget/i);
  } finally { replacement.dispose(); b.dispose(); a.dispose(); }
});

it('unwinds descriptor installation if a later measured method throws during installation', () => {
  const descriptor = Object.getOwnPropertyDescriptor(ctx.component, 'run'), call = Object.getOwnPropertyDescriptor(ctx.component, 'call');
  const prototype = foreign(foreign(ctx.runtime.binding.Parser).prototype), parse = Object.getOwnPropertyDescriptor(prototype, 'parse');
  const error = new Error('partial installation');
  Object.defineProperty(ctx.component, 'run', { get() { throw error; }, configurable: true });
  try {
    expect(() => installSessionCallCounters(ctx)).toThrow(error);
    expect(Object.getOwnPropertyDescriptor(ctx.component, 'call')).toEqual(call);
    expect(Object.getOwnPropertyDescriptor(prototype, 'parse')).toEqual(parse);
  } finally { if (descriptor) Object.defineProperty(ctx.component, 'run', descriptor); else Reflect.deleteProperty(ctx.component, 'run'); }
});

it.each(['select-b', 'encode-b', 'decode', 'attach', 'budget', 'stale'])('unwinds actual lifetime failure at %s, including edited A still held', async phase => {
  const themes = normalizedThemes(BUILTIN_CASE), counters = installSessionCallCounters(ctx);
  await runSessionIteration(ctx, request, themes, counters, undefined, 0, performance.now(), SESSION_LIMITS);
  const before = ctx.component.liveAllocations(), bytes = ctx.allocations.snapshot().requestedBytes;
  const select = ThemePresentation.prototype.select, number = ctx.component.number;
  let selections = 0;
  const spies: { mockRestore(): void }[] = [];
  try {
    if (phase === 'select-b' || phase === 'stale') spies.push(vi.spyOn(ThemePresentation.prototype, 'select').mockImplementation(function(this: ThemePresentation, view, acquire, options) {
      if (++selections === 3) return Promise.resolve(phase === 'stale' ? { kind: 'discarded' } : { kind: 'unavailable', reason: 'scope-not-current' });
      return select.call(this, view, acquire, options);
    }));
    if (phase === 'encode-b') spies.push(vi.spyOn(ThemePresentation.prototype, 'acquire').mockImplementation(function(this: ThemePresentation, view) {
      const result = originalAcquire.call(this, view);
      if (++selections !== 3 || !result) return result;
      return failedEncoding(result);
    }));
    if (phase === 'decode') spies.push(vi.spyOn(ctx.component, 'number').mockImplementation(function(name, args = []) {
      const value = number.call(ctx.component, name, args);
      if (name === 'scope_compat_theme_resolve') new DataView(ctx.runtime.heap().buffer).setUint32(value, 99, true);
      return value;
    }));
    if (phase === 'attach') spies.push(vi.spyOn(ScopeSession, 'attach').mockImplementation(() => { throw new Error('attach control'); }));
    const bounds = phase === 'budget' ? { ...SESSION_LIMITS, checkpointBytes: 10 } : SESSION_LIMITS;
    await expect(runSessionIteration(ctx, request, themes, counters, undefined, 0, performance.now(), bounds)).rejects.toThrow();
  } finally { for (const spy of spies.reverse()) spy.mockRestore(); counters.restore(); }
  expect(ctx.component.liveAllocations()).toBe(before); expect(ctx.allocations.snapshot().requestedBytes).toBe(bytes);
});
const originalAcquire = ThemePresentation.prototype.acquire;

it.each(['parse', 'scope', 'theme'])('fails the actual warm control when only the %s observer is disconnected', async disabled => {
  const hooks = await import('../src/measurement/observer.ts');
  const original = hooks.replaceMethod;
  const spy = vi.spyOn(hooks, 'replaceMethod').mockImplementation((target, key, make) => original(target, key, fn => {
    const wrapped = make(fn);
    return function(this: unknown, ...args: unknown[]) {
      const skip = disabled === 'parse' && key === 'parse' || disabled === 'scope' && args[0] === 'scope_compat_run' || disabled === 'theme' && (args[0] === 'scope_compat_theme_new' || args[0] === 'scope_compat_theme_resolve');
      return Reflect.apply(skip ? fn : wrapped, this, args);
    };
  }));
  const observer = installSessionCallCounters(ctx);
  try { await expect(armSessionControls(ctx, observer, SESSION_LIMITS)).rejects.toThrow(/observer|control/i); }
  finally { observer.restore(); spy.mockRestore(); }
});

it('rejects a native sample when last detach is replaced with a cache-hit-only request', async () => {
  const counters = installSessionCallCounters(ctx), detach = ScopeSession.prototype.detachView;
  const spy = vi.spyOn(ScopeSession.prototype, 'detachView').mockImplementation(() => {});
  const before = ctx.component.liveAllocations();
  try {
    await expect(runSessionIteration(ctx, { ...request, lane: 'shared-tree' }, normalizedThemes(BUILTIN_CASE), counters, undefined, 0, performance.now(), SESSION_LIMITS)).rejects.toThrow(/charge|cleanup/i);
  } finally { spy.mockRestore(); counters.restore(); }
  expect(ScopeSession.prototype.detachView).toBe(detach); expect(ctx.component.liveAllocations()).toBe(before);
});

it('passes the same narrowed numeric policy into actual owner opens and rejects owner overflow before construction', async () => {
  const bounds = { ...SESSION_LIMITS, sourceUnits: 8 }, open = PilotDocument.open;
  const spy = vi.spyOn(PilotDocument, 'open').mockImplementation((language, source, limits) => open.call(PilotDocument, language, source, limits));
  const counters = installSessionCallCounters(ctx);
  try {
    await runSessionIteration(ctx, request, normalizedThemes(BUILTIN_CASE), counters, undefined, 0, performance.now(), bounds);
    expect(spy.mock.calls).toHaveLength(1); expect(spy.mock.calls[0][2]).toBe(numericLimits(bounds));
    const construct = vi.spyOn(ctx.runtime, 'construct');
    try {
      await expect(PilotDocument.open('json', 'x'.repeat(9), numericLimits(bounds))).rejects.toThrow(/Numeric limit/);
      expect(construct).not.toHaveBeenCalled();
    } finally { construct.mockRestore(); }
  } finally { counters.restore(); spy.mockRestore(); }
});

it('preserves actual component wrapper return and thrown identities without nested call double counting', () => {
  const token = { status: 1 as const, detail: 0, value: 0 }, error = new Error('exact native thrown identity'), args = [37];
  const call = vi.spyOn(ctx.component, 'call').mockReturnValue(token), run = vi.spyOn(ctx.component, 'run').mockReturnValue(token);
  const counters = installSessionCallCounters(ctx);
  try {
    expect(ctx.component.call('unrelated', args)).toBe(token);
    expect(call.mock.calls[0]).toEqual(['unrelated', args]); expect(call.mock.contexts[0]).toBe(ctx.component);
    call.mockImplementation(() => { throw error; });
    let thrown: unknown;
    try { ctx.component.call('unrelated', args); } catch (failure) { thrown = failure; }
    expect(thrown).toBe(error); expect(counters.read().scopeCalls).toBe(0);
  } finally { counters.restore(); run.mockRestore(); call.mockRestore(); }
});

function failedEncoding(lease: PresentationLease): PresentationLease {
  return { ...lease, get snapshot(): PresentationLease['snapshot'] { throw new Error('encode-b control'); } };
}
