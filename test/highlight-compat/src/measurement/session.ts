import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { PilotDocument } from '../native/owner.ts';
import { ScopeSession } from '../native/incremental.ts';
import { ThemePresentation } from '../native/theme-presentation.ts';
import { prepareEdits } from '../native/edit-batch.ts';
import { release, invoke } from '../native/runtime.ts';
import { manifestPath, repositoryRoot } from '../native/component-inputs.ts';
import type { ScopeLease } from '../native/scope-output.ts';
import type { PresentationLease } from '../native/theme-presentation.ts';
import type { EditOutcome, OwnerKey, ViewId } from '../native/owner-state.ts';
import type { NormalizedTheme } from '../native/theme-input.ts';
import { openMeasurementContext, Releases } from './context.ts';
import type { MeasurementContext } from './context.ts';
import { observed, unsupported, record } from './model.ts';
import { CHECKPOINT_RETENTION, SESSION_LIMITS, BUILTIN_CASE, numericLimits } from './session-case.ts';
import type { SessionCase, SessionRequest, Bounds } from './session-case.ts';
import { normalizedThemes } from './session-theme.ts';
import { semanticCheckpoint, sourceIdentity } from './session-checkpoint.ts';
import type { CheckpointRecord, Checkpoint } from './session-checkpoint.ts';
import { installSessionCallCounters, subtractCounts } from './session-observer.ts';
import type { SessionCounters, CallCounts } from './session-observer.ts';
import { boundedJson, reportBudget } from './bounds.ts';

export const NONACCEPTANCE = 'No performance benefit, budget acceptance, parity, promotion or cutover claim.';
export type Evidence<T> = Readonly<{ kind: 'observed'; value: T }> | Readonly<{ kind: 'unsupported'; reason: string }>;
export interface Counts {
  readonly parseCalls: Evidence<number>; readonly scopeCalls: Evidence<number>;
  readonly themeCompileCalls: Evidence<number>; readonly themeResolveCalls: Evidence<number>;
  readonly decodedSegmentBytes: Evidence<number>;
}
export type Step = 'open-to-output' | 'edit-to-output' | 'theme-to-output' | 'dispose';
export type StepIdentity = Readonly<{ before: OwnerKey | null; after: OwnerKey | null }>;
export interface StepBase { readonly durationMs: number; readonly counts: Counts; readonly nativeWork: Evidence<ReturnType<SessionCounters['work']>>; readonly before: MemoryCheckpoint; readonly after: MemoryCheckpoint }
export type StepRecord = StepBase & (Readonly<{ step: 'edit-to-output'; identity: { readonly before: OwnerKey; readonly after: OwnerKey; readonly edit: Extract<EditOutcome, { kind: 'ready' }>; readonly invalidation: { readonly kind: 'policy-derived'; readonly policy: 'full-document-on-owner-change'; readonly oldRange: { readonly from: number; readonly to: number }; readonly newRange: { readonly from: number; readonly to: number } } } }>
  | Readonly<{ step: Exclude<Step, 'edit-to-output'>; identity: StepIdentity }>);
export interface SessionSample {
  readonly index: number; readonly lifecycleMs: number; readonly firstOutputFromWorkerStartMs: number;
  readonly steps: readonly StepRecord[]; readonly checkpoints: readonly CheckpointRecord[];
  readonly memory: readonly { readonly phase: string; readonly value: MemoryCheckpoint }[];
}
export function countsEvidence(counts: CallCounts | undefined): Counts {
  const missing = unsupported('Cold call counters are unarmed; a positive parse/classify/theme control would prime first output.');
  if (!counts) return { parseCalls: missing, scopeCalls: missing, themeCompileCalls: missing, themeResolveCalls: missing, decodedSegmentBytes: missing };
  return { parseCalls: observed(counts.parseCalls), scopeCalls: observed(counts.scopeCalls), themeCompileCalls: observed(counts.themeCompileCalls),
    themeResolveCalls: observed(counts.themeResolveCalls), decodedSegmentBytes: observed(counts.decodedSegmentBytes) };
}
function nativeWork(counters: SessionCounters | undefined, from: number) {
  return counters ? observed(counters.work().slice(from)) : unsupported('Cold decoded native statistics observer is unarmed.');
}
function delta(counters: SessionCounters | undefined, before: CallCounts | undefined): Counts {
  return countsEvidence(counters && before ? subtractCounts(counters.read(), before) : undefined);
}
export function memory(ctx: MeasurementContext, lifetime?: SessionLifetime) {
  return { routedAllocator: ctx.allocations.snapshot(), componentLiveBlocks: ctx.component.liveAllocations(),
    wasmCapacityBytes: ctx.runtime.heap().byteLength, process: process.memoryUsage(),
    retainedOutputBudgetChargeBytes: observed(lifetime?.session.retainedBytes() ?? 0),
    adapterLiveOwners: lifetime?.owner.observe().kind === 'ready' ? 1 : 0,
    adapterSourceViewUtf16Bytes: lifetime?.owner.observe().kind === 'ready' ? lifetime.owner.source.length * 2 : 0,
    adapterHeldScopeLeases: lifetime?.heldScopes ?? 0, adapterHeldPresentationLeases: lifetime?.heldStyles ?? 0 };
}
export type MemoryCheckpoint = ReturnType<typeof memory>;

class SessionLifetime {
  readonly owner: PilotDocument; readonly session: ScopeSession; readonly presentation: ThemePresentation;
  readonly #resources: Releases; readonly #ctx: MeasurementContext;
  #view: ViewId | undefined;
  heldScopes = 0; heldStyles = 0;
  private constructor(owner: PilotDocument, session: ScopeSession, presentation: ThemePresentation, resources: Releases, ctx: MeasurementContext) {
    this.owner = owner; this.session = session; this.presentation = presentation; this.#resources = resources; this.#ctx = ctx;
  }
  static async open(ctx: MeasurementContext, source: string, bounds: Bounds): Promise<SessionLifetime> {
    const resources = new Releases();
    try {
      const owner = await PilotDocument.open('json', source, numericLimits(bounds)); resources.add(() => owner.dispose());
      const session = ScopeSession.attach(owner, new Map([['json', ctx.pack]])); resources.add(() => session.dispose());
      const presentation = new ThemePresentation(session); resources.add(() => presentation.dispose());
      return new SessionLifetime(owner, session, presentation, resources, ctx);
    } catch (error) { resources.close(); throw error; }
  }
  attach(): void {
    if (this.#view !== undefined) throw new Error('Measurement view already attached');
    const view = this.session.attachView({ from: 0, to: this.owner.source.length }); this.#view = view;
    this.#resources.add(() => this.detach()); this.flush();
  }
  private view(): ViewId { if (this.#view === undefined) throw new Error('Missing measurement view'); return this.#view; }
  flush(): void {
    this.session.flushOne();
    if (this.session.outcome(this.view())?.kind !== 'complete') throw new Error(`Incomplete measured scopes: ${JSON.stringify(this.session.outcome(this.view()))}`);
  }
  request(): void { this.session.request(this.view(), { viewport: { from: 0, to: this.owner.source.length }, theme: 0 }); this.flush(); }
  async checkpoint(theme: NormalizedTheme, name: Checkpoint, ceiling: number) {
    const result = await this.presentation.select(this.view(), async () => ({ kind: 'ok', value: theme, warnings: [] }), { framing: 'identity-v1' });
    if (result.kind !== 'complete') throw new Error(`Incomplete measured presentation: ${JSON.stringify(result)}`);
    const scope = this.session.acquireFull(this.view());
    if (!scope) throw new Error('Missing current full scope lease');
    const releaseScope = this.scope(scope);
    const style = this.presentation.acquire(this.view());
    if (!style) throw new Error('Missing current presentation lease');
    const releaseStyle = this.style(style);
    const checkpoint = semanticCheckpoint(this.owner.source, scope, style, theme, name, ceiling);
    return { checkpoint, encodedAt: performance.now(), release: () => { try { releaseStyle(); } finally { releaseScope(); } } };
  }
  private scope(scope: ScopeLease): () => void {
    this.heldScopes++;
    return this.#resources.add(() => { try { scope.release(); } finally { this.heldScopes--; } });
  }
  private style(style: PresentationLease): () => void {
    this.heldStyles++;
    return this.#resources.add(() => { try { style.release(); } finally { this.heldStyles--; } });
  }
  detach(): void {
    const view = this.#view; this.#view = undefined;
    if (view !== undefined) this.session.detachView(view);
    if (this.session.retainedBytes() !== 0) throw new Error('Logical output charge after last detach');
    if (this.owner.observe().kind !== 'ready') throw new Error('View detach closed the source owner');
  }
  observe() { return memory(this.#ctx, this); }
  close(): void { this.#resources.close(); }
}

async function iteration(ctx: MeasurementContext, request: SessionRequest, themes: readonly [NormalizedTheme, NormalizedTheme],
  counters: SessionCounters | undefined, shared: SessionLifetime | undefined, index: number, workerStarted: number, bounds: Bounds): Promise<SessionSample> {
  const begin = performance.now(), before = memory(ctx, shared), calls = counters?.read(), workStart = counters?.work().length ?? 0;
  const current = shared ?? await SessionLifetime.open(ctx, request.case.source, bounds);
  const checkpoints: CheckpointRecord[] = [], steps: StepRecord[] = [], snapshots: SessionSample['memory'][number][] = [];
  const mark = (phase: string) => snapshots.push({ phase, value: current.observe() });
  try {
    mark('live-owner'); current.attach(); mark('after-scope');
    const initial = await current.checkpoint(themes[0], 'initial-a', bounds.checkpointBytes);
    checkpoints.push(initial.checkpoint); mark('initial-a-live');
    const firstOutput = initial.encodedAt - workerStarted;
    steps.push({ step: 'open-to-output', nativeWork: nativeWork(counters, workStart), durationMs: initial.encodedAt - begin, counts: delta(counters, calls), before, after: current.observe(), identity: { before: shared?.owner.key() ?? null, after: current.owner.key() } });
    const initialReleaseStarted = performance.now(), initialLive = current.observe();
    initial.release(); mark('initial-callers-released');
    if (request.lane === 'end-to-end-adapter') await editAndTheme(current, request.case, themes, counters, bounds, steps, checkpoints, mark);
    const disposeStarted = request.lane === 'cold-open' ? initialReleaseStarted : performance.now(), disposeCalls = counters?.read(), disposeWork = counters?.work().length ?? 0,
      live = request.lane === 'cold-open' ? initialLive : current.observe(), owner = current.owner.key();
    current.detach(); mark('after-last-detach');
    if (!shared) current.close();
    const after = current.observe();
    steps.push({ step: 'dispose', nativeWork: nativeWork(counters, disposeWork), durationMs: performance.now() - disposeStarted, counts: delta(counters, disposeCalls), before: live, after,
      identity: { before: owner, after: shared ? owner : null } });
    return { index, lifecycleMs: performance.now() - begin, firstOutputFromWorkerStartMs: firstOutput, steps, checkpoints, memory: snapshots.concat([{ phase: 'after-dispose', value: after }]) };
  } finally { if (!shared) current.close(); }
}
async function editAndTheme(current: SessionLifetime, input: SessionCase, themes: readonly [NormalizedTheme, NormalizedTheme],
  counters: SessionCounters | undefined, bounds: Bounds, steps: StepRecord[], checkpoints: CheckpointRecord[], mark: (phase: string) => void): Promise<void> {
  if (current.heldScopes || current.heldStyles) throw new Error('Initial caller leases survived until edit');
  const begin = performance.now(), calls = counters?.read(), workStart = counters?.work().length ?? 0, before = current.observe(), key = current.owner.key();
  const edit = await current.owner.applyEdits({ base: key, edits: input.edits });
  if (edit.kind !== 'ready') throw new Error(`Incomplete measured edit: ${JSON.stringify(edit)}`);
  mark('after-edit'); current.request(); mark('after-edited-scope');
  const a = await current.checkpoint(themes[0], 'edited-a', bounds.checkpointBytes); checkpoints.push(a.checkpoint); mark('edited-a-live');
  steps.push({ step: 'edit-to-output', nativeWork: nativeWork(counters, workStart), durationMs: a.encodedAt - begin, counts: delta(counters, calls), before, after: current.observe(), identity: { before: key, after: current.owner.key(), edit, invalidation: { kind: 'policy-derived', policy: 'full-document-on-owner-change', oldRange: { from: 0, to: input.source.length }, newRange: { from: 0, to: current.owner.source.length } } } });
  const themeStarted = performance.now(), themeCalls = counters?.read(), themeWork = counters?.work().length ?? 0, afterA = current.observe();
  const b = await current.checkpoint(themes[1], 'edited-b', bounds.checkpointBytes); checkpoints.push(b.checkpoint); mark('edited-b-with-a-live');
  if (a.checkpoint.scope.generation !== b.checkpoint.scope.generation) throw new Error('Theme changed scope generation');
  steps.push({ step: 'theme-to-output', nativeWork: nativeWork(counters, themeWork), durationMs: b.encodedAt - themeStarted, counts: delta(counters, themeCalls), before: afterA,
    after: current.observe(), identity: { before: current.owner.key(), after: current.owner.key() } });
  b.release(); a.release(); mark('all-callers-released');
}

async function allocationControls(ctx: MeasurementContext) {
  const started = performance.now(), baseline = memory(ctx);
  const query = ctx.runtime.construct('Query', [await ctx.runtime.language('json'), '(_) @measurement']);
  let retained: MemoryCheckpoint;
  try { retained = memory(ctx); } finally { release(query); }
  const released = memory(ctx), pointer = ctx.component.number('scope_compat_bytes_new', [37]);
  if (!pointer) throw new Error('Component allocation control failed');
  let scratch: MemoryCheckpoint;
  try { scratch = memory(ctx); } finally { ctx.component.call('scope_compat_bytes_delete', [pointer]); }
  const scratchReleased = memory(ctx);
  requireAllocation(baseline, retained, released, 'query');
  requireAllocation(released, scratch, scratchReleased, 'scratch');
  if (scratch.componentLiveBlocks <= scratchReleased.componentLiveBlocks) throw new Error('Component live observer did not arm');
  return { status: 'passed' as const, workerPid: process.pid, durationMs: performance.now() - started, baseline, retained, released, scratch, scratchReleased };
}
function requireAllocation(before: MemoryCheckpoint, live: MemoryCheckpoint, after: MemoryCheckpoint, label: string): void {
  if (live.routedAllocator.requestedBytes <= before.routedAllocator.requestedBytes || live.routedAllocator.blocks <= before.routedAllocator.blocks ||
      after.routedAllocator.requestedBytes !== before.routedAllocator.requestedBytes || after.routedAllocator.blocks !== before.routedAllocator.blocks) throw new Error(`Measured context allocation observer did not arm: ${label}`);
}
async function coreResourceControl(ctx: MeasurementContext, name: string, args: readonly unknown[]) {
  const baseline = memory(ctx), resource = ctx.runtime.construct(name, args);
  let retained: MemoryCheckpoint;
  try { if (name === 'Parser') invoke(resource, 'setLanguage', [await ctx.runtime.language('json')]); retained = memory(ctx); }
  finally { release(resource); }
  const released = memory(ctx); requireAllocation(baseline, retained, released, name);
  return { name, baseline, retained, released };
}
function requireWork(sample: SessionSample, lane: SessionRequest['lane'], equalThemes = false): void {
  const open = sample.steps[0], edit = sample.steps.find(step => step.step === 'edit-to-output'), theme = sample.steps.find(step => step.step === 'theme-to-output');
  requireCalls(open.counts, lane === 'shared-tree' ? 0 : 1, 1, 1, 1);
  if (lane !== 'end-to-end-adapter') return;
  if (!edit || !theme) throw new Error('Missing measured lifecycle steps');
  requireCalls(edit.counts, 1, 1, 1, 1); requireCalls(theme.counts, 0, 0, 1, equalThemes ? 0 : 1);
}
function requireCalls(counts: Counts, parse: number, scope: number, compile: number, resolve: number): void {
  const expected = { parseCalls: parse, scopeCalls: scope, themeCompileCalls: compile, themeResolveCalls: resolve };
  for (const key of Object.keys(expected)) {
    const actual: unknown = Reflect.get(counts, key), wanted: unknown = Reflect.get(expected, key);
    if (record(actual).kind !== 'observed' || record(actual).value !== wanted) throw new Error(`Measured ${key} observer/control failed`);
  }
}
async function warmControls(ctx: MeasurementContext, counters: SessionCounters, bounds: Bounds) {
  const started = performance.now(), themes = normalizedThemes(BUILTIN_CASE);
  const request: SessionRequest = { adapter: 'session-native', lane: 'end-to-end-adapter', case: BUILTIN_CASE, repetitions: 1, warmups: 0, reportBudget: bounds.reportBytes };
  const allocation = await allocationControls(ctx);
  await iteration(ctx, request, themes, counters, undefined, 0, started, bounds);
  const baseline = memory(ctx);
  const buffer = await coreResourceControl(ctx, 'TextBuffer', ['allocation control']);
  const parser = await coreResourceControl(ctx, 'Parser', []);
  counters.reset();
  const sample = await iteration(ctx, request, themes, counters, undefined, 0, started, bounds);
  requireWork(sample, request.lane);
  const shared = await SessionLifetime.open(ctx, BUILTIN_CASE.source, bounds);
  try { requireWork(await iteration(ctx, { ...request, lane: 'shared-tree' }, themes, counters, shared, 0, started, bounds), 'shared-tree'); }
  finally { shared.close(); }
  const after = memory(ctx), a = sample.checkpoints[1], b = sample.checkpoints[2];
  if (a.stylesSha256 === b.stylesSha256 || a.scope.generation !== b.scope.generation || after.componentLiveBlocks !== baseline.componentLiveBlocks ||
      after.routedAllocator.requestedBytes !== baseline.routedAllocator.requestedBytes || after.routedAllocator.blocks !== baseline.routedAllocator.blocks) throw new Error('Native warm lifetime/style control failed');
  const live = sample.memory.find(item => item.phase === 'live-owner');
  if (!live || live.value.routedAllocator.blocks <= baseline.routedAllocator.blocks) throw new Error('Owner allocation observer did not arm');
  return { status: 'passed' as const, workerPid: process.pid, contextId: `${process.pid}:session-context-1`, durationMs: performance.now() - started,
    observerSha256: ctx.observerSha256, engine: ctx.pack.engine, allocation, buffer, parser, baseline, after, sample, counts: countsEvidence(counters.read()), nativeWork: counters.work() };
}
async function freshComparators(ctx: MeasurementContext, input: SessionCase, themes: readonly [NormalizedTheme, NormalizedTheme], bounds: Bounds) {
  const started = performance.now(), checkpoints: CheckpointRecord[] = [];
  const initial = await SessionLifetime.open(ctx, input.source, bounds);
  try {
    initial.attach(); const a = await initial.checkpoint(themes[0], 'initial-a', bounds.checkpointBytes); checkpoints.push(a.checkpoint); a.release(); initial.detach();
  } finally { initial.close(); }
  const final = prepareEdits(input.source, input.edits, numericLimits(bounds)).source;
  const edited = await SessionLifetime.open(ctx, final, bounds);
  try {
    edited.attach();
    const a = await edited.checkpoint(themes[0], 'edited-a', bounds.checkpointBytes); checkpoints.push(a.checkpoint);
    const b = await edited.checkpoint(themes[1], 'edited-b', bounds.checkpointBytes); checkpoints.push(b.checkpoint);
    b.release(); a.release(); edited.detach();
  } finally { edited.close(); }
  return { boundary: 'after measured owners close; outside samples, included in worker launch-to-exit', durationMs: performance.now() - started, checkpoints };
}
export async function runSessionWorker(request: SessionRequest, started: number, bounds: Bounds = SESSION_LIMITS) {
  const themes = normalizedThemes(request.case);
  const ctx = await openMeasurementContext('json'), resources = new Releases(); resources.add(ctx.dispose);
  let shared: SessionLifetime | undefined, phase = 'controls';
  try {
    const counters = request.lane === 'cold-open' ? undefined : installSessionCallCounters(ctx);
    if (counters) resources.add(counters.restore);
    const mode = counters ? { kind: 'warm' as const, controls: await warmControls(ctx, counters, bounds) }
      : { kind: 'cold' as const, allocationControl: await allocationControls(ctx) };
    const initializationMs = performance.now() - started;
    const budget = reportBudget(request.reportBudget), samples: SessionSample[] = [];
    budget.reserve(mode);
    phase = 'shared-preparation';
    const preparedAt = performance.now();
    if (request.lane === 'shared-tree') { shared = await SessionLifetime.open(ctx, request.case.source, bounds); resources.add(() => shared?.close()); }
    const sharedPreparationMs = performance.now() - preparedAt;
    phase = 'samples';
    for (let index = 0; index < request.warmups; index++) await iteration(ctx, request, themes, counters, shared, index, started, bounds);
    for (let index = 0; index < request.repetitions; index++) {
      const sample = await iteration(ctx, request, themes, counters, shared, index, started, bounds);
      if (counters) requireWork(sample, request.lane, themes[0].contentRevision === themes[1].contentRevision);
      budget.reserve(sample); samples.push(sample);
    }
    const disposeAt = performance.now();
    shared?.close(); shared = undefined;
    const sharedOwnerDisposeMs = performance.now() - disposeAt;
    phase = 'fresh-comparators';
    const comparators = await freshComparators(ctx, request.case, themes, bounds); budget.reserve(comparators);
    for (const sample of samples) compareCheckpoints(sample.checkpoints, comparators.checkpoints);
    phase = 'report';
    const manifest = record(JSON.parse(await readFile(resolve(repositoryRoot, manifestPath), 'utf8')));
    ctx.pack.dispose();
    const afterDocumentAndPackDispose = memory(ctx);
    if (afterDocumentAndPackDispose.componentLiveBlocks !== 0) throw new Error('Component allocations survived pack disposal');
    const result = { schema: 'scope-compat/session-worker@1' as const, adapter: 'session-native' as const, acceptance: NONACCEPTANCE,
      workerPid: process.pid, lane: request.lane, checkpointRetention: CHECKPOINT_RETENTION, mode, initializationMs, warmups: request.warmups,
      identity: { engine: ctx.pack.engine, compiler: manifest.compiler, flags: manifest.flags, observerSha256: ctx.observerSha256 },
      samples, comparators, afterDocumentAndPackDispose, sharedPreparationMs, sharedOwnerDisposeMs, reportEncodingValidationMs: 0 };
    const encodingAt = performance.now();
    boundedJson(result, request.reportBudget);
    result.reportEncodingValidationMs = performance.now() - encodingAt;
    boundedJson(result, request.reportBudget);
    return result;
  } catch (error) {
    let cleanup: string | null = null;
    try { resources.close(); } catch (failure) { cleanup = failure instanceof Error ? failure.message : String(failure); }
    throw new SessionMeasurementFailure(error, { phase, source: sourceIdentity(request.case.source),
      cleanup: { error: cleanup, componentLiveBlocks: ctx.component.liveAllocations(), routedAllocator: ctx.allocations.snapshot() } });
  } finally { resources.close(); }
}
export class SessionMeasurementFailure extends Error {
  readonly envelope: { readonly schema: 'scope-compat/session-failure@1'; readonly adapter: 'session-native'; readonly workerPid: number; readonly error: string; readonly phase: string; readonly source: ReturnType<typeof sourceIdentity>; readonly cleanup: { readonly error: string | null; readonly componentLiveBlocks: number; readonly routedAllocator: ReturnType<MeasurementContext['allocations']['snapshot']> } };
  constructor(error: unknown, detail: Omit<SessionMeasurementFailure['envelope'], 'schema' | 'adapter' | 'workerPid' | 'error'>) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    super(message, { cause: error });
    this.envelope = { schema: 'scope-compat/session-failure@1', adapter: 'session-native', workerPid: process.pid, error: message, ...detail };
  }
}
function compareCheckpoints(actual: readonly CheckpointRecord[], expected: readonly CheckpointRecord[]): void {
  for (const checkpoint of actual) {
    if (expected.find(item => item.checkpoint === checkpoint.checkpoint)?.semanticSha256 !== checkpoint.semanticSha256) throw new Error(`Fresh semantic checkpoint mismatch: ${checkpoint.checkpoint}`);
  }
}
export type SessionWorkerReport = Awaited<ReturnType<typeof runSessionWorker>>;

export { iteration as runSessionIteration, warmControls as armSessionControls };
