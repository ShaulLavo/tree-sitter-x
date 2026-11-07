import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Runtime, invoke, release } from '../native/runtime.ts';
import { Component } from '../native/component.ts';
import { loadLanguagePack } from '../native/packs.ts';
import { PilotDocument } from '../native/owner.ts';
import { nativeScopes } from '../native/adapter.ts';
import { paintScopes } from '../baselines/theme.ts';
import { digest, manifestPath, repositoryRoot } from '../native/component-inputs.ts';
import { resolve } from 'node:path';
import { observeAllocations, observeParses } from './observer.ts';
import { observed, record, unsupported } from './model.ts';
import type { Request } from './model.ts';
import type { Foreign } from '../native/runtime.ts';
import type { NativePack } from '../native/component.ts';

function restoreObservers(undo: () => void, restore: () => void): void {
  try { undo(); } finally { restore(); }
}
function disposeContext(pack: NativePack, undo: () => void, restore: () => void): void {
  try { pack.dispose(); } finally { restoreObservers(undo, restore); }
}
function resetCoreObserver(observer: Foreign, restoreParses: () => void): void {
  try { invoke(observer, 'scope_test_reset'); } finally { restoreParses(); }
}

async function context(language: string) {
  const allocations = observeAllocations();
  let undo = () => {};
  try {
    const runtime = await Runtime.load();
    const bytes = await readFile(new URL('../../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url));
    const observer = await runtime.extension(new WebAssembly.Module(bytes));
    invoke(observer, 'scope_test_install');
    const parses = observeParses(runtime.binding);
    undo = () => resetCoreObserver(observer, parses.restore);
    const component = await Component.load();
    const pack = await loadLanguagePack(language);
    return { runtime, component, pack, allocations, parses, observerSha256: digest(bytes),
      dispose: () => disposeContext(pack, undo, allocations.restore) };
  } catch (error) { try { undo(); } finally { allocations.restore(); } throw error; }
}
type Context = Awaited<ReturnType<typeof context>>;

async function coreAllocationControl(ctx: Context, language: string) {
  const started = performance.now();
  const baseline = ctx.allocations.snapshot(), parses = ctx.parses.count();
  const query = ctx.runtime.construct('Query', [await ctx.runtime.language(language), '(_) @measurement_context']);
  let retained: ReturnType<typeof ctx.allocations.snapshot>;
  try { retained = ctx.allocations.snapshot(); } finally { release(query); }
  const released = ctx.allocations.snapshot();
  if (retained.requestedBytes <= baseline.requestedBytes || retained.blocks <= baseline.blocks ||
      released.requestedBytes !== baseline.requestedBytes || released.blocks !== baseline.blocks || ctx.parses.count() !== parses) {
    throw new Error('Measured context allocation observer did not arm');
  }
  return { status: 'passed', processId: process.pid, sourceParses: ctx.parses.count() - parses,
    kind: 'core query retain/release before measurement cycles', durationMs: performance.now() - started,
    baseline, retained, released };
}

function memory(ctx: Context) {
  return { routedAllocator: ctx.allocations.snapshot(), componentLiveBlocks: ctx.component.liveAllocations(),
    wasmCapacityBytes: ctx.runtime.heap().byteLength, process: process.memoryUsage() };
}

async function output(ctx: Context, owner: PilotDocument) {
  const begin = performance.now();
  const result = nativeScopes(ctx.pack, owner);
  const scopesReady = performance.now();
  if (result.status !== 0) throw new Error(`Incomplete native measurement: ${JSON.stringify(result)}`);
  const intervals = Array.from({ length: result.segments.length / 3 }, (_, i) => ({
    from: result.segments[i * 3], to: result.segments[i * 3 + 1],
    scopes: result.paths[result.segments[i * 3 + 2]].map(id => ctx.pack.scopes[id]),
  }));
  const expanded = performance.now();
  const document = await paintScopes('native', owner.languageId, owner.source, intervals, 'product', ctx.pack.engine);
  const painted = performance.now();
  const encoded = Buffer.from(JSON.stringify(document));
  const encodedAt = performance.now();
  const [capturesSeen, intervalsKept, droppedEmpty, droppedExclusive, droppedDuplicate] = result.statistics;
  return { durationMs: encodedAt - begin,
    stagesMs: { nativeScopeAndDecode: scopesReady - begin, expandPaths: expanded - scopesReady,
      referenceThemeAndStyle: painted - expanded, encodeJson: encodedAt - painted },
    work: { capturesSeen, intervalsKept, droppedEmpty, droppedExclusive, droppedDuplicate,
      segments: result.segments.length / 3, paths: result.paths.length, scopeNames: ctx.pack.scopes.length,
      sourceCoverageUtf16: owner.source.length, copiedSegmentBytes: observed(result.segments.byteLength),
      allCopiedBytes: unsupported('Only the decoded segment slice and serialized JSON bytes are counted.'),
      serializedBytes: encoded.byteLength, outputSha256: digest(encoded),
      segmentsPerUtf16Unit: owner.source.length ? result.segments.length / 3 / owner.source.length : null } };
}

async function iteration(ctx: Context, request: Request, shared: PilotDocument | undefined, workerStarted: number) {
  const before = memory(ctx), parsesBefore = ctx.parses.count(), started = performance.now();
  const owner = shared ?? await PilotDocument.open(request.language, request.source);
  const opened = performance.now();
  try {
    const liveDocument = memory(ctx);
    const result = await output(ctx, owner);
    const ready = performance.now(), afterOutput = memory(ctx);
    const disposeStarted = performance.now();
    if (!shared) owner.dispose();
    const disposed = performance.now();
    return { ...result, durationMs: disposed - started, firstOutputFromWorkerStartMs: ready - workerStarted,
      stagesMs: { ...result.stagesMs, openAndParse: shared ? unsupported('Shared owner prepared before timed work.') : observed(opened - started),
        dispose: shared ? unsupported('Shared owner released after all repetitions.') : observed(disposed - disposeStarted) },
      parseCalls: ctx.parses.count() - parsesBefore,
      ownership: { sourceViewUtf16Bytes: observed(owner.source.length * 2), rootTreeHandles: observed(1),
        sourceAllocationCapacity: unsupported('TextBuffer storage capacity is not exposed by this adapter.'),
        treeBytes: unsupported('Core tree allocation ownership is not separated from other routed allocations.'),
        scopeAndStyleCacheBytes: unsupported('No cache ownership instrumentation is exposed.') },
      memory: { before, liveDocument, afterOutput, after: memory(ctx) } };
  } finally { if (!shared) owner.dispose(); }
}

export async function positiveControls(request: Request) {
  const ctx = await context(request.language);
  try {
    const warm = await PilotDocument.open(request.language, request.source);
    try { await output(ctx, warm); } finally { warm.dispose(); }
    const baseline = memory(ctx), parses = ctx.parses.count();
    const query = ctx.runtime.construct('Query', [await ctx.runtime.language(request.language), '(_) @measurement']);
    let queryLive: ReturnType<typeof memory>;
    try { queryLive = memory(ctx); } finally { release(query); }
    const queryReleased = memory(ctx);
    const buffer = ctx.runtime.construct('TextBuffer', ['allocator positive control']);
    const bufferLive = memory(ctx);
    release(buffer);
    const bufferReleased = memory(ctx);
    const owner = await PilotDocument.open(request.language, request.source);
    const scopeParsesBefore = ctx.parses.count();
    let ownerLive: ReturnType<typeof memory>, afterScope: ReturnType<typeof memory>;
    try { ownerLive = memory(ctx); await output(ctx, owner); afterScope = memory(ctx); }
    finally { owner.dispose(); }
    const scopeExtraParses = ctx.parses.count() - scopeParsesBefore;
    const ownerReleased = memory(ctx);
    const pointer = ctx.component.number('scope_compat_bytes_new', [37]);
    if (!pointer) throw new Error('Allocation control failed');
    let componentLive: ReturnType<typeof memory>;
    try { componentLive = memory(ctx); } finally { ctx.component.call('scope_compat_bytes_delete', [pointer]); }
    const componentReleased = memory(ctx);
    if (queryLive.routedAllocator.requestedBytes <= baseline.routedAllocator.requestedBytes ||
        queryReleased.routedAllocator.requestedBytes !== baseline.routedAllocator.requestedBytes ||
        bufferLive.routedAllocator.requestedBytes <= baseline.routedAllocator.requestedBytes ||
        bufferReleased.routedAllocator.requestedBytes !== baseline.routedAllocator.requestedBytes ||
        ownerLive.routedAllocator.blocks <= baseline.routedAllocator.blocks ||
        ownerReleased.routedAllocator.requestedBytes !== baseline.routedAllocator.requestedBytes ||
        componentLive.componentLiveBlocks <= componentReleased.componentLiveBlocks ||
        componentLive.routedAllocator.requestedBytes <= componentReleased.routedAllocator.requestedBytes ||
        ctx.parses.count() - parses !== 1 || scopeExtraParses !== 0) throw new Error('Measurement observer positive control failed');
    return { status: 'passed', baseline, queryLive, queryReleased, bufferLive, bufferReleased, ownerLive, afterScope, ownerReleased,
      componentLive, componentReleased, parseCalls: ctx.parses.count() - parses,
      scopeExtraParses, observerSha256: ctx.observerSha256 };
  } finally { ctx.dispose(); }
}

export async function measure(request: Request, started: number) {
  const ctx = await context(request.language);
  let shared: PilotDocument | undefined;
  try {
    const contextControls = await coreAllocationControl(ctx, request.language);
    const initializationMs = performance.now() - started;
    if (request.lane === 'shared-tree') shared = await PilotDocument.open(request.language, request.source);
    for (let i = 0; i < request.warmups; ++i) await iteration(ctx, request, shared, started);
    const samples = [];
    for (let i = 0; i < request.repetitions; ++i) samples.push(await iteration(ctx, request, shared, started));
    const completedLifecycleFromWorkerStartMs = performance.now() - started;
    const manifest = record(JSON.parse(await readFile(resolve(repositoryRoot, manifestPath), 'utf8')));
    shared?.dispose(); shared = undefined;
    ctx.pack.dispose();
    return { lane: request.lane, samples, initializationMs, contextControls, completedLifecycleFromWorkerStartMs,
      identity: { engine: ctx.pack.engine, compiler: manifest.compiler, flags: manifest.flags, observerSha256: ctx.observerSha256 },
      afterDocumentAndPackDispose: memory(ctx) };
  } finally { try { shared?.dispose(); } finally { ctx.dispose(); } }
}
