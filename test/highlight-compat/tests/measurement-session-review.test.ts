import { beforeAll, expect, it, vi } from 'vitest';
import { runWorker } from '../src/measurement/worker-process.ts';
import { parseSessionWorkerReport } from '../src/measurement/session-report.ts';
import { BUILTIN_CASE, SESSION_LIMITS } from '../src/measurement/session-case.ts';
import type { SessionRequest } from '../src/measurement/session-case.ts';
import { record } from '../src/measurement/model.ts';
import { Releases } from '../src/measurement/context.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { SessionMeasurementFailure } from '../src/measurement/session.ts';
import { sourceIdentity } from '../src/measurement/session-checkpoint.ts';

const request: SessionRequest = { adapter: 'session-native', lane: 'end-to-end-adapter', case: BUILTIN_CASE,
  repetitions: 1, warmups: 0, reportBudget: SESSION_LIMITS.reportBytes };
const sharedRequest: SessionRequest = { ...request, lane: 'shared-tree', repetitions: 2 };
let run: Awaited<ReturnType<typeof runWorker>>, sharedRun: Awaited<ReturnType<typeof runWorker>>;
beforeAll(async () => { run = await runWorker(request); sharedRun = await runWorker(sharedRequest); });
function firstSample(data: Record<string, unknown>) {
  if (!Array.isArray(data.samples)) throw new Error('Missing samples');
  return record(data.samples[0]);
}
function checkpoint(data: Record<string, unknown>, index = 0) {
  const sample = firstSample(data);
  if (!Array.isArray(sample.checkpoints)) throw new Error('Missing checkpoints');
  return record(sample.checkpoints[index]);
}
function editIdentity(data: Record<string, unknown>) {
  const sample = firstSample(data);
  if (!Array.isArray(sample.steps)) throw new Error('Missing steps');
  return record(record(sample.steps[1]).identity);
}
function stepIdentity(data: Record<string, unknown>, index: number) {
  const sample = firstSample(data);
  if (!Array.isArray(sample.steps)) throw new Error('Missing steps');
  return record(record(sample.steps[index]).identity);
}
function setGeneration(item: Record<string, unknown>, generation: number): void {
  record(item.scope).generation = generation;
  record(record(item.presentation).key).generation = generation;
}
it('accepts untouched real native worker output', () => {
  expect(parseSessionWorkerReport(run.data, request, run.workerPid).samples).toHaveLength(1);
});
const mutations: readonly { name: string; change(data: Record<string, unknown>): void }[] = [
  { name: 'sample source digest different from the actual requested source', change(data) { checkpoint(data).sourceUtf16leSha256 = '0'.repeat(64); } },
  { name: 'sample acquisition digest different from actual theme bytes', change(data) { record(checkpoint(data).theme).acquisitionRevision = '0'.repeat(64); } },
  { name: 'edit outcome lacking the actual nonempty edit spans', change(data) { record(editIdentity(data).edit).oldTextSpans = []; } },
  { name: 'edit transition disconnected from the sample checkpoint owners', change(data) {
    const identity = editIdentity(data);
    record(identity.before).epoch = 99999; record(identity.after).epoch = 99999; record(record(identity.edit).key).epoch = 99999;
  } },
  { name: 'edited sample WTF-8 digest different from final source', change(data) { checkpoint(data, 1).sourceWtf8Sha256 = '0'.repeat(64); } },
  { name: 'theme B packet digest different from its actual input', change(data) { record(checkpoint(data, 2).theme).normalizedPacketDigest = '0'.repeat(64); } },
  { name: 'open step disconnected from its accepted owner', change(data) { record(stepIdentity(data, 0).after).epoch = 99999; } },
  { name: 'theme step disconnected from both accepted presentations', change(data) {
    const identity = stepIdentity(data, 2); record(identity.before).epoch = 99999; record(identity.after).epoch = 99999;
  } },
  { name: 'dispose step disconnected from the final owner', change(data) { record(stepIdentity(data, 3).before).epoch = 99999; } },
  { name: 'new owner claimed live after end-to-end disposal', change(data) { const identity = stepIdentity(data, 3); identity.after = identity.before; } },
  { name: 'edit outcome lacking prepared new spans', change(data) { record(editIdentity(data).edit).newTextSpans = []; } },
  { name: 'old invalidation range different from requested source', change(data) { record(record(editIdentity(data).invalidation).oldRange).to = 1; } },
  { name: 'new invalidation range different from edited source', change(data) { record(record(editIdentity(data).invalidation).newRange).to = 1; } },
  { name: 'edited generation unrelated to initial generation', change(data) { setGeneration(checkpoint(data, 1), 99999); setGeneration(checkpoint(data, 2), 99999); } },
  { name: 'theme-only work inventing another scope request', change(data) {
    const item = checkpoint(data, 2); record(record(item.scope).work).request = 99999; record(record(record(item.presentation).key).work).request = 99999;
  } },
  { name: 'theme-only work switching views', change(data) { record(record(record(checkpoint(data, 2).presentation).key).view).view = 99999; } },
  { name: 'theme-only work switching interest', change(data) { record(record(record(checkpoint(data, 2).presentation).key).view).interest = 99999; } },
  { name: 'theme-only work skipping theme generation', change(data) { record(record(record(checkpoint(data, 2).presentation).key).view).theme = 99999; } },
];
it.each(mutations)('rejects $name at the report boundary', ({ change }) => {
  const changed = record(structuredClone(run.data)); change(changed);
  expect(() => parseSessionWorkerReport(changed, request, run.workerPid)).toThrow();
});

it('keeps the native edit failure visible while unwinding an unavailable real owner', async () => {
  const result = await nativeEditFailure();
  expect(result.caught).toBeInstanceOf(Error);
  expect(result.caught instanceof Error ? result.caught.message : String(result.caught)).toContain('Incomplete measured edit');
});
it('preserves both the primary native failure and a cleanup failure in the worker envelope', async () => {
  const cleanup = new Error('detach cleanup control'), result = await nativeEditFailure(cleanup);
  expect(result.caught).toBeInstanceOf(AggregateError);
  if (!(result.caught instanceof AggregateError)) throw new Error('Missing aggregate');
  expect(result.caught.cause).toBeInstanceOf(Error);
  expect(String(result.caught.cause)).toContain('Incomplete measured edit');
  const failure = new SessionMeasurementFailure(result.caught, { phase: 'samples', source: sourceIdentity(BUILTIN_CASE.source),
    cleanup: { error: cleanup.message, componentLiveBlocks: 0, routedAllocator: result.allocations } });
  expect(failure.cause).toBe(result.caught);
  expect(failure.envelope.error).toContain('Incomplete measured edit');
  expect(failure.envelope.error).toContain('Native owner parse returned no tree');
  expect(failure.envelope.error).toContain(cleanup.message);
});
it.each([undefined, null, false, 0, ''])('preserves a falsy primary failure through successful cleanup: %s', primary => {
  const releases = new Releases(); let released = false, caught: unknown = Symbol('not thrown');
  releases.add(() => { released = true; });
  try { releases.closeOnFailure(primary); } catch (error) { caught = error; }
  expect(released).toBe(true); expect(caught).toBe(primary); releases.close();
});
async function nativeEditFailure(cleanup?: Error) {
  const { openMeasurementContext } = await import('../src/measurement/context.ts');
  const { runSessionIteration } = await import('../src/measurement/session.ts');
  const { normalizedThemes } = await import('../src/measurement/session-theme.ts');
  const { replaceMethod } = await import('../src/measurement/observer.ts');
  const { foreign } = await import('../src/native/runtime.ts');
  const ctx = await openMeasurementContext('json');
  try {
    const themes = normalizedThemes(BUILTIN_CASE);
    await runSessionIteration(ctx, request, themes, undefined, undefined, 0, performance.now(), SESSION_LIMITS);
    const blocks = ctx.component.liveAllocations(), bytes = ctx.allocations.snapshot().requestedBytes;
    const prototype = foreign(foreign(ctx.runtime.binding.Parser).prototype);
    let calls = 0;
    const restore = replaceMethod(prototype, 'parse', original => function(this: unknown, ...args: unknown[]) {
      if (++calls === 2) return null;
      return Reflect.apply(original, this, args);
    });
    const detach = cleanup ? failingDetach(cleanup) : undefined;
    let caught: unknown;
    try { await runSessionIteration(ctx, request, themes, undefined, undefined, 0, performance.now(), SESSION_LIMITS); }
    catch (error) { caught = error; }
    finally { detach?.mockRestore(); restore(); }
    expect(calls).toBe(2);
    expect(ctx.component.liveAllocations()).toBe(blocks);
    expect(ctx.allocations.snapshot().requestedBytes).toBe(bytes);
    return { caught, allocations: ctx.allocations.snapshot() };
  } finally { ctx.dispose(); }
}
function failingDetach(cleanup: Error) {
  const detach = ScopeSession.prototype.detachView;
  return vi.spyOn(ScopeSession.prototype, 'detachView').mockImplementation(function(this: ScopeSession, view) { detach.call(this, view); throw cleanup; });
}
it('keeps one shared source owner across measured repetitions', () => {
  const data = record(structuredClone(sharedRun.data));
  if (!Array.isArray(data.samples)) throw new Error('Missing samples');
  const second = record(data.samples[1]);
  if (!Array.isArray(second.checkpoints) || !Array.isArray(second.steps)) throw new Error('Missing sample records');
  const point = record(second.checkpoints[0]), scope = record(point.scope), key = record(record(point.presentation).key);
  for (const value of [scope.owner, scope.work, key.owner, key.work]) record(value).epoch = 99999;
  for (const value of second.steps) {
    const identity = record(record(value).identity); record(identity.before).epoch = 99999; record(identity.after).epoch = 99999;
  }
  expect(() => parseSessionWorkerReport(data, sharedRequest, sharedRun.workerPid)).toThrow();
});
it('validates actual shared worker output and rejects scope generations reused across iterations', () => {
  expect(parseSessionWorkerReport(sharedRun.data, sharedRequest, sharedRun.workerPid).samples).toHaveLength(2);
  const data = record(structuredClone(sharedRun.data));
  if (!Array.isArray(data.samples)) throw new Error('Missing samples');
  const first = record(data.samples[0]), second = record(data.samples[1]);
  if (!Array.isArray(first.checkpoints) || !Array.isArray(second.checkpoints)) throw new Error('Missing checkpoints');
  setGeneration(record(second.checkpoints[0]), Number(record(record(first.checkpoints[0]).scope).generation));
  expect(() => parseSessionWorkerReport(data, sharedRequest, sharedRun.workerPid)).toThrow();
});
