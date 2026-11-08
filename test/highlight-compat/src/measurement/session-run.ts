import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { digest } from '../native/component-inputs.ts';
import { sourceIdentity, environment } from './identity.ts';
import { runWorker } from './worker-process.ts';
import { LANES, integer, distribution, unsupported } from './model.ts';
import type { Lane } from './model.ts';
import { BUILTIN_CASE, parseSessionCase, SESSION_LIMITS, CHECKPOINT_RETENTION } from './session-case.ts';
import type { Bounds, SessionRequest } from './session-case.ts';
import { readBounded, boundedJson, jsonBytes } from './bounds.ts';
import { sourceIdentity as inputIdentity } from './session-checkpoint.ts';
import { normalizedThemes } from './session-theme.ts';
import { parseSessionWorkerReport } from './session-report.ts';
import { NONACCEPTANCE } from './session.ts';
import type { SessionWorkerReport } from './session.ts';
import type { Options } from './run.ts';

export interface SessionOptions extends Pick<Options, 'repetitions' | 'warmups' | 'lanes'> { readonly caseLabel: string }
interface SessionRun { readonly workerPid: number; readonly processLaunchToExitMs: number; readonly data: SessionWorkerReport }
function contract(lane: Lane) {
  return { adapter: 'session-native', lane, checkpointRetention: CHECKPOINT_RETENTION, language: 'json', profile: 'product', framing: 'identity-v1',
    range: 'full-document', injections: 0, classification: 'fresh native full pass; decoded native statistics only in armed warm contexts',
    theming: 'actual native ThemePresentation; no reference paintScopes', delivery: 'bounded semantic JSON encoding in process',
    sourceAndTree: lane === 'shared-tree' ? 'one parsed owner, zero views/cache before each sample' : 'one new current owner per iteration',
    initialization: lane === 'cold-open' ? 'instrumented cold process; query/allocation setup included; OS caches uncontrolled' : 'outside samples',
    invalidationPolicy: 'full-document-on-owner-change; policy-derived extent, not measured invalidation',
    comparison: 'fresh native semantic correctness only, outside samples; no performance baseline' };
}
function laneReport(lane: Lane, warmups: number, runs: readonly SessionRun[]) {
  const samples = runs.flatMap(run => run.data.samples);
  return { lane, workContract: contract(lane), warmups: lane === 'cold-open' ? 0 : warmups, repetitions: samples.length,
    latency: samples.length ? distribution(samples.map(sample => lane === 'cold-open' ? sample.firstOutputFromWorkerStartMs : sample.lifecycleMs)) : null,
    processLaunchToExit: runs.length ? distribution(runs.map(run => run.processLaunchToExitMs)) : null, runs };
}
export const SESSION_UNAVAILABLE = Object.freeze({
  bytesScanned: unsupported('No instrumented native or source-fact scanning byte counter.'),
  invalidationExtent: unsupported('Full-document-on-owner-change is policy, not a measured invalidation counter.'),
  sourceSuffixMovement: unsupported('Owner applies edits, but suffix movement bytes/time are not exposed.'),
  physicalCacheOwnership: unsupported('OutputStore reports logical budget charge, not physical cache ownership.'),
  allCopyTotals: unsupported('Only actual Component.run decoded segment bytes and encoded payload bytes are observed.'),
  downstreamDelivery: unsupported('No worker token delivery, renderer, LSP, overlay or editor synchronization.'),
  nativePeakBytes: unsupported('Routed requested high water is not complete allocator/internal overhead or a per-stage peak.'),
  sourceBufferCapacity: unsupported('TextBuffer allocation capacity is not exposed.'),
  treeOwnedBytes: unsupported('Tree physical ownership is not exposed.'),
  cacheCardinality: unsupported('No cache-cardinality getter; selections do not establish entry count.'),
  runtimeBuildFlags: unsupported('Runtime artifact hash is known; no checked runtime compiler-flags manifest.'),
  currentIncrementalShiki: unsupported('Current equivalent-work consumer controls and promotion budgets remain external prerequisites.'),
});
export async function runSessionMeasurement(options: SessionOptions, bounds: Bounds = SESSION_LIMITS,
  dispatch: typeof runWorker = runWorker) {
  if (!integer(options.repetitions) || !options.lanes.length || options.lanes.some(lane => !LANES.includes(lane)) || new Set(options.lanes).size !== options.lanes.length) throw new Error('Invalid session lanes/repetitions');
  integer(options.warmups);
  const acquired = performance.now();
  const bytes = options.caseLabel === 'builtin:json-lifecycle-v1' ? Buffer.from(boundedJson(BUILTIN_CASE, bounds.caseFileBytes)) : await readBounded(resolve(options.caseLabel), bounds.caseFileBytes);
  const input = parseSessionCase(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), bounds);
  const themes = normalizedThemes(input), acquisitionMs = performance.now() - acquired, source = await sourceIdentity();
  const lanes: ReturnType<typeof laneReport>[] = [];
  const report = { schema: 'scope-compat/session-measurement@1', adapter: 'session-native', acceptance: NONACCEPTANCE,
    controllerPid: process.pid, source, environment: await environment(),
    case: { label: options.caseLabel, exactBytesSha256: digest(bytes), bytes: bytes.length, policySha256: digest(Buffer.from(boundedJson(input, bounds.workerInputBytes))),
      source: inputIdentity(input.source), initialUtf8Bytes: Buffer.byteLength(input.source), edits: input.edits,
      themeBytesSha256: input.themeJson.map(text => digest(Buffer.from(text))), acquisitionMs,
      profile: input.profile, framing: input.framing, checkpointRetention: CHECKPOINT_RETENTION },
    limits: SESSION_UNAVAILABLE, observations: { allocation: 'Routed requested bytes/blocks and cumulative high water include controls/warmups/comparators, not allocator overhead or total native heap.',
      capacity: 'Retained Wasm linear-memory capacity is not live allocation or leak evidence.',
      charge: 'retainedOutputBudgetChargeBytes is observed ScopeSession.retainedBytes(), OutputStore.bytes(), not physical JS memory.',
      runtimeLifetime: 'Runtime/component/language singletons have no disposal API; module storage and capacity retire at process exit.',
      latency: 'Instrumented elapsed wall time. No absolute timing thresholds or cross-lane ratios.',
      serialization: 'reportEncodingValidationMs measures one bounded pre-emission count/encode pass. Final wire encoding and transport remain in launch-to-exit, outside sample intervals.',
      initialization: 'Controller case acquisition is outside worker time. Actual dynamic import, asset loading and controls are inside worker initialization.' }, lanes };
  for (const selected of options.lanes) await collect(selected);
  const after = await sourceIdentity();
  if (source.head !== after.head || source.contentSha256 !== after.contentSha256) throw new Error(`Source changed during session measurement: ${JSON.stringify({ before: source, after })}`);
  const hashes = new Set(lanes.flatMap(lane => lane.runs.flatMap(run => run.data.samples.map(sample => sample.checkpoints[0].semanticSha256))));
  if (hashes.size !== 1) throw new Error('Matching initial checkpoints differ across lanes/repetitions');
  boundedJson(report, bounds.reportBytes);
  return report;

  async function collect(selected: Lane): Promise<void> {
    const cold = selected === 'cold-open', runs: SessionRun[] = [];
    lanes.push(laneReport(selected, options.warmups, runs));
    for (let index = 0; index < (cold ? options.repetitions : 1); index++) await nextRun(selected, runs);
    lanes[lanes.length - 1] = laneReport(selected, options.warmups, runs);
  }
  async function nextRun(selected: Lane, runs: SessionRun[]): Promise<void> {
    const remaining = bounds.reportBytes - jsonBytes(report, bounds.reportBytes);
    // Reserve the controller's distribution and run envelope before dispatch, not after collecting worker output.
    const reportBudget = remaining - jsonBytes(laneReport(selected, options.warmups, []), remaining) - 2048;
    const request: SessionRequest = { adapter: 'session-native', lane: selected, case: input,
      repetitions: selected === 'cold-open' ? 1 : options.repetitions, warmups: selected === 'cold-open' ? 0 : options.warmups, reportBudget };
    if (reportBudget <= 0) throw new Error('Invocation report budget exceeded before worker dispatch');
    boundedJson(request, bounds.workerInputBytes);
    const run = await dispatch(request), data = parseSessionWorkerReport(run.data, request, run.workerPid);
    if (selected === 'cold-open' && runs.some(previous => previous.workerPid === run.workerPid)) throw new Error('Cold repetitions reused a worker PID');
    const expected = data.comparators.checkpoints;
    if (expected[0].sourceUtf16leSha256 !== inputIdentity(input.source).utf16leSha256 || expected.some(item => item.theme.targetIdentity !== themes[0].targetIdentity)) throw new Error('Worker source/target identity mismatch');
    const next = { workerPid: run.workerPid, processLaunchToExitMs: run.processLaunchToExitMs, data };
    const updated = laneReport(selected, options.warmups, runs.concat([next]));
    const candidate = { ...report, lanes: lanes.slice(0, -1).concat([updated]) };
    jsonBytes(candidate, bounds.reportBytes);
    runs.push(next); lanes[lanes.length - 1] = updated;
  }
}
