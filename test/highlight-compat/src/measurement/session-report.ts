import { counter, sameOwner, sameWork } from '../native/owner-state.ts';
import type { OwnerKey, WorkKey } from '../native/owner-state.ts';
import type { PresentationKey } from '../native/theme-presentation.ts';
import { record, integer } from './model.ts';
import { CHECKPOINT_RETENTION, SESSION_LIMITS, exactKeys } from './session-case.ts';
import type { SessionRequest } from './session-case.ts';
import type { SessionWorkerReport, SessionSample, MemoryCheckpoint, Counts, Evidence, StepRecord } from './session.ts';
import { NONACCEPTANCE } from './session.ts';
import type { CheckpointRecord } from './session-checkpoint.ts';
import { CHECKPOINTS } from './session-checkpoint.ts';
import { prepareEdits } from '../native/edit-batch.ts';
import { normalizedThemes } from './session-theme.ts';
import { sourceIdentity } from './session-checkpoint.ts';
import { numericLimits } from './session-case.ts';
import { jsonBytes } from './bounds.ts';

export function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid session duration');
  return value;
}
function number(value: unknown): number { return integer(value, Number.MAX_SAFE_INTEGER); }
function string(value: unknown): string { if (typeof value !== 'string' || !value) throw new Error('Invalid session string'); return value; }
function hash(value: unknown): string { const text = string(value); if (!/^[a-f0-9]{64}$/.test(text)) throw new Error('Invalid session digest'); return text; }
function literal<T extends string>(value: unknown, expected: T): T { if (value !== expected) throw new Error(`Invalid session literal: ${expected}`); return expected; }
function array<T>(value: unknown, parse: (value: unknown) => T, count?: number): T[] {
  if (!Array.isArray(value) || count !== undefined && value.length !== count) throw new Error('Invalid session array/count');
  return value.map(parse);
}
function span(value: unknown) {
  const input = record(value), from = number(input.from), to = number(input.to);
  if (to < from || to > SESSION_LIMITS.sourceUnits) throw new Error('Invalid session range');
  return { from, to };
}
function owner(value: unknown): OwnerKey {
  const input = record(value);
  return { epoch: counter<'DocumentEpoch'>(number(input.epoch)), revision: counter<'Revision'>(number(input.revision)), syntax: counter<'SyntaxGeneration'>(number(input.syntax)) };
}
function work(value: unknown): WorkKey { const input = record(value); return { ...owner(input), request: counter<'RequestId'>(number(input.request)) }; }
function publication(value: unknown): PresentationKey['view'] {
  const input = record(value), change = record(input.change);
  const base = { view: counter<'ViewId'>(number(input.view)), interest: counter<'InterestGeneration'>(number(input.interest)),
    theme: counter<'ThemeGeneration'>(number(input.theme)), viewport: span(input.viewport) };
  if (change.kind === 'reset') return { ...base, change: { kind: 'reset' } };
  literal(change.kind, 'replace');
  return { ...base, change: { kind: 'replace', old: owner(change.old), generation: counter<'ResultGeneration'>(number(change.generation)), coverage: span(change.coverage) } };
}
function presentation(value: unknown): PresentationKey {
  const input = record(value);
  return { owner: owner(input.owner), work: work(input.work), generation: counter<'ResultGeneration'>(number(input.generation)), view: publication(input.view),
    themeRevision: hash(input.themeRevision), profile: literal(input.profile, 'product'), framing: literal(input.framing, 'identity-v1') };
}
function evidence(value: unknown, cold: boolean): Evidence<number> {
  const input = record(value);
  if (cold) { exactKeys(input, ['kind', 'reason']); return { kind: literal(input.kind, 'unsupported'), reason: string(input.reason) }; }
  exactKeys(input, ['kind', 'value']); return { kind: literal(input.kind, 'observed'), value: number(input.value) };
}
function counts(value: unknown, cold: boolean): Counts {
  const input = record(value); exactKeys(input, ['parseCalls', 'scopeCalls', 'themeCompileCalls', 'themeResolveCalls', 'decodedSegmentBytes']);
  return { parseCalls: evidence(input.parseCalls, cold), scopeCalls: evidence(input.scopeCalls, cold), themeCompileCalls: evidence(input.themeCompileCalls, cold),
    themeResolveCalls: evidence(input.themeResolveCalls, cold), decodedSegmentBytes: evidence(input.decodedSegmentBytes, cold) };
}
export function parseMemory(value: unknown): MemoryCheckpoint {
  const input = record(value), routed = record(input.routedAllocator), process = record(input.process), charged = record(input.retainedOutputBudgetChargeBytes);
  exactKeys(charged, ['kind', 'value']); literal(charged.kind, 'observed');
  const calls = Object.fromEntries(Object.entries(record(routed.calls)).map(([key, value]) => [key, number(value)]));
  const requestedBytes = number(routed.requestedBytes), peakRequestedBytes = number(routed.peakRequestedBytes);
  if (peakRequestedBytes < requestedBytes) throw new Error('Invalid allocator high water');
  return { routedAllocator: { blocks: number(routed.blocks), requestedBytes, peakRequestedBytes, unknownFrees: number(routed.unknownFrees), calls },
    adapterSourceViewUtf16Bytes: integer(input.adapterSourceViewUtf16Bytes, SESSION_LIMITS.sourceUnits * 2),
    componentLiveBlocks: number(input.componentLiveBlocks), wasmCapacityBytes: number(input.wasmCapacityBytes),
    process: { rss: number(process.rss), heapTotal: number(process.heapTotal), heapUsed: number(process.heapUsed), external: number(process.external), arrayBuffers: number(process.arrayBuffers) },
    retainedOutputBudgetChargeBytes: { kind: 'observed', value: number(charged.value) }, adapterLiveOwners: integer(input.adapterLiveOwners, 1),
    adapterHeldScopeLeases: integer(input.adapterHeldScopeLeases, 2), adapterHeldPresentationLeases: integer(input.adapterHeldPresentationLeases, 2) };
}
function checkpoint(value: unknown): CheckpointRecord {
  const input = record(value), scope = record(input.scope), theme = record(input.theme);
  const checkpoint = CHECKPOINTS.find(name => name === input.checkpoint);
  if (!checkpoint || input.metadata !== null) throw new Error('Invalid checkpoint/metadata');
  const key = presentation(record(input.presentation).key), scopeOwner = owner(scope.owner), scopeWork = work(scope.work);
  const generation = counter<'ResultGeneration'>(number(scope.generation)), coverage = span(input.coverage), sourceLength = integer(input.sourceLength, SESSION_LIMITS.sourceUnits);
  if (coverage.from !== 0 || coverage.to !== sourceLength || !sameOwner(scopeOwner, key.owner) || !sameWork(scopeWork, key.work) ||
      !sameOwner(scopeOwner, scopeWork) || generation !== key.generation || key.view.viewport.from !== 0 || key.view.viewport.to !== sourceLength) throw new Error('Checkpoint admission/range mismatch');
  const contentRevision = hash(theme.contentRevision);
  if (contentRevision !== key.themeRevision) throw new Error('Checkpoint theme mismatch');
  return { checkpoint, sourceUtf16leSha256: hash(input.sourceUtf16leSha256), sourceWtf8Sha256: hash(input.sourceWtf8Sha256), sourceLength, coverage,
    theme: { contentRevision, acquisitionRevision: hash(theme.acquisitionRevision), normalizedPacketDigest: hash(theme.normalizedPacketDigest),
      targetIdentity: string(theme.targetIdentity), profile: literal(theme.profile, 'product') }, framing: literal(input.framing, 'identity-v1'),
    scope: { owner: scopeOwner, work: scopeWork, generation }, presentation: { key }, semanticSha256: hash(input.semanticSha256), stylesSha256: hash(input.stylesSha256),
    serializedPayloadBytes: integer(input.serializedPayloadBytes, SESSION_LIMITS.checkpointBytes), scopeSegments: number(input.scopeSegments),
    scopePaths: number(input.scopePaths), scopeNames: number(input.scopeNames), styleRuns: number(input.styleRuns), metadata: null };
}
function step(value: unknown, cold: boolean): StepRecord {
  const input = record(value), identity = record(input.identity);
  const base = { durationMs: duration(input.durationMs), counts: counts(input.counts, cold), nativeWork: nativeWork(input.nativeWork, cold), before: parseMemory(input.before), after: parseMemory(input.after) };
  if (input.step === 'edit-to-output') {
    const edit = record(identity.edit), before = owner(identity.before), after = owner(identity.after);
    literal(edit.kind, 'ready'); const key = owner(edit.key), invalidation = record(identity.invalidation);
    if (!sameOwner(key, after) || before.epoch !== after.epoch || before.revision + 1 !== after.revision || before.syntax + 1 !== after.syntax) throw new Error('Invalid measured edit identity');
    return { ...base, step: 'edit-to-output', identity: { before, after, edit: { kind: 'ready', key, oldTextSpans: array(edit.oldTextSpans, span), newTextSpans: array(edit.newTextSpans, span) }, invalidation: { kind: literal(invalidation.kind, 'policy-derived'), policy: literal(invalidation.policy, 'full-document-on-owner-change'), oldRange: span(invalidation.oldRange), newRange: span(invalidation.newRange) } } };
  }
  const name = ['open-to-output', 'theme-to-output', 'dispose'].find(name => name === input.step);
  if (name !== 'open-to-output' && name !== 'theme-to-output' && name !== 'dispose') throw new Error('Invalid measured step');
  exactKeys(identity, ['before', 'after']);
  return { ...base, step: name, identity: { before: identity.before === null ? null : owner(identity.before), after: identity.after === null ? null : owner(identity.after) } };
}
function requireCount(actual: Evidence<number>, wanted: number): void {
  if (actual.kind !== 'observed' || actual.value !== wanted) throw new Error('Invalid measured call count');
}
function verifyCounts(sample: SessionSample, lane: SessionRequest['lane']): void {
  if (lane === 'cold-open') return;
  for (const step of sample.steps) verifyStepCounts(step, lane, sample.checkpoints[1]?.theme.contentRevision === sample.checkpoints[2]?.theme.contentRevision);
}
function verifyStepCounts(step: StepRecord, lane: SessionRequest['lane'], equalThemes: boolean): void {
  const opening = step.step === 'open-to-output', editing = step.step === 'edit-to-output', theming = step.step === 'theme-to-output';
  requireCount(step.counts.parseCalls, editing || opening && lane !== 'shared-tree' ? 1 : 0);
  requireCount(step.counts.scopeCalls, editing || opening ? 1 : 0);
  if (step.nativeWork.kind !== 'observed' || step.nativeWork.value.length !== (editing || opening ? 1 : 0)) throw new Error('Missing actual native sample statistics');
  requireCount(step.counts.themeCompileCalls, editing || opening || theming ? 1 : 0);
  requireCount(step.counts.themeResolveCalls, editing || opening || theming && !equalThemes ? 1 : 0);
}
function sample(value: unknown, lane: SessionRequest['lane']): SessionSample {
  const input = record(value); exactKeys(input, ['index', 'lifecycleMs', 'firstOutputFromWorkerStartMs', 'steps', 'checkpoints', 'memory']);
  const cold = lane === 'cold-open', lifecycle = lane === 'end-to-end-adapter';
  const checkpoints = array(input.checkpoints, checkpoint, lifecycle ? 3 : 1), steps = array(input.steps, value => step(value, cold), lifecycle ? 4 : 2);
  if (checkpoints.map(item => item.checkpoint).join(',') !== (lifecycle ? CHECKPOINTS.join(',') : 'initial-a') ||
      steps.map(item => item.step).join(',') !== (lifecycle ? 'open-to-output,edit-to-output,theme-to-output,dispose' : 'open-to-output,dispose')) throw new Error('Invalid lane-specific checkpoint/step sequence');
  const memory = array(input.memory, value => { const input = record(value); return { phase: string(input.phase), value: parseMemory(input.value) }; });
  const result = { index: number(input.index), lifecycleMs: duration(input.lifecycleMs), firstOutputFromWorkerStartMs: duration(input.firstOutputFromWorkerStartMs), steps, checkpoints, memory };
  verifyCounts(result, lane); verifyRetention(result, lifecycle);
  return result;
}
function verifyRetention(sample: SessionSample, lifecycle: boolean): void {
  for (const phase of ['initial-callers-released', 'all-callers-released', 'after-last-detach', 'after-dispose']) {
    if (phase === 'all-callers-released' && !lifecycle) continue;
    const found = sample.memory.find(item => item.phase === phase)?.value;
    if (!found || found.adapterHeldScopeLeases || found.adapterHeldPresentationLeases) throw new Error('Invalid checkpoint retention release');
    if ((phase === 'after-last-detach' || phase === 'after-dispose') && found.retainedOutputBudgetChargeBytes.value !== 0) throw new Error('Retained output after release');
  }
  if (!lifecycle) return;
  const held = sample.memory.find(item => item.phase === 'edited-b-with-a-live')?.value;
  if (!held || held.adapterHeldScopeLeases !== 2 || held.adapterHeldPresentationLeases !== 2 || sample.checkpoints[1].scope.generation !== sample.checkpoints[2].scope.generation) throw new Error('Edited A not held through B');
}
type AllocationControl = Extract<SessionWorkerReport['mode'], { kind: 'cold' }>['allocationControl'];
function allocationControl(value: unknown, pid: number): AllocationControl {
  const input = record(value); literal(input.status, 'passed');
  if (input.workerPid !== pid) throw new Error('Allocation control PID mismatch');
  const result = { status: 'passed' as const, workerPid: pid, durationMs: duration(input.durationMs), baseline: parseMemory(input.baseline),
    retained: parseMemory(input.retained), released: parseMemory(input.released), scratch: parseMemory(input.scratch), scratchReleased: parseMemory(input.scratchReleased) };
  verifyAllocation(result.baseline, result.retained, result.released); verifyAllocation(result.released, result.scratch, result.scratchReleased);
  if (result.scratch.componentLiveBlocks <= result.scratchReleased.componentLiveBlocks) throw new Error('Unarmed component control');
  return result;
}
function verifyAllocation(before: MemoryCheckpoint, live: MemoryCheckpoint, after: MemoryCheckpoint): void {
  if (live.routedAllocator.blocks <= before.routedAllocator.blocks || live.routedAllocator.requestedBytes <= before.routedAllocator.requestedBytes ||
      after.routedAllocator.blocks !== before.routedAllocator.blocks || after.routedAllocator.requestedBytes !== before.routedAllocator.requestedBytes) throw new Error('Unarmed allocation control');
}
function engine(value: unknown): Readonly<Record<string, string>> {
  const input = record(value);
  exactKeys(input, ['componentSha256', 'sourceDigest', 'runtimeSha256', 'abi', 'packId', 'packVersion', 'querySha256', 'languageId', 'parserLanguageId', 'parserSha256', 'composition', 'predicateDialect', 'selectedOrderPolicy']);
  for (const key of ['componentSha256', 'sourceDigest', 'runtimeSha256', 'querySha256', 'parserSha256']) hash(input[key]);
  literal(input.languageId, 'json'); literal(input.parserLanguageId, 'json'); literal(input.abi, '1');
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, string(value)]));
}
function workRecord(value: unknown) {
  const input = record(value); exactKeys(input, ['capturesSeen', 'intervalsKept', 'droppedEmpty', 'droppedExclusive', 'droppedDuplicate']);
  return { capturesSeen: number(input.capturesSeen), intervalsKept: number(input.intervalsKept),
    droppedEmpty: number(input.droppedEmpty), droppedExclusive: number(input.droppedExclusive), droppedDuplicate: number(input.droppedDuplicate) };
}
function nativeWork(value: unknown, cold: boolean): StepRecord['nativeWork'] {
  const input = record(value);
  if (cold) { exactKeys(input, ['kind', 'reason']); return { kind: literal(input.kind, 'unsupported'), reason: string(input.reason) }; }
  exactKeys(input, ['kind', 'value']); return { kind: literal(input.kind, 'observed'), value: array(input.value, workRecord) };
}
function resourceControl(value: unknown) {
  const input = record(value), baseline = parseMemory(input.baseline), retained = parseMemory(input.retained), released = parseMemory(input.released);
  verifyAllocation(baseline, retained, released); return { name: string(input.name), baseline, retained, released };
}
function mode(value: unknown, lane: SessionRequest['lane'], pid: number): SessionWorkerReport['mode'] {
  const input = record(value);
  if (lane === 'cold-open') { literal(input.kind, 'cold'); return { kind: 'cold', allocationControl: allocationControl(input.allocationControl, pid) }; }
  literal(input.kind, 'warm'); const control = record(input.controls);
  if (control.workerPid !== pid || control.contextId !== `${pid}:session-context-1`) throw new Error('Warm control context/PID mismatch');
  const nativeWork = array(control.nativeWork, workRecord);
  if (!nativeWork.length) throw new Error('Missing actual native work control');
  const checkedSample = sample(control.sample, 'end-to-end-adapter');
  if (checkedSample.checkpoints[1].stylesSha256 === checkedSample.checkpoints[2].stylesSha256) throw new Error('Warm themes did not change actual styles');
  return { kind: 'warm', controls: { status: literal(control.status, 'passed'), workerPid: pid, contextId: string(control.contextId),
    durationMs: duration(control.durationMs), observerSha256: hash(control.observerSha256), engine: engine(control.engine), allocation: allocationControl(control.allocation, pid),
    buffer: resourceControl(control.buffer), parser: resourceControl(control.parser), baseline: parseMemory(control.baseline), after: parseMemory(control.after),
    sample: checkedSample, counts: counts(control.counts, false), nativeWork } };
}
export function parseSessionWorkerReport(value: unknown, request: SessionRequest, workerPid: number): SessionWorkerReport {
  jsonBytes(value, request.reportBudget);
  const input = record(value);
  exactKeys(input, ['schema', 'adapter', 'acceptance', 'workerPid', 'lane', 'checkpointRetention', 'mode', 'initializationMs', 'warmups', 'identity', 'samples', 'comparators', 'afterDocumentAndPackDispose', 'sharedPreparationMs', 'sharedOwnerDisposeMs', 'reportEncodingValidationMs']);
  literal(input.schema, 'scope-compat/session-worker@1'); literal(input.adapter, 'session-native'); literal(input.acceptance, NONACCEPTANCE);
  if (!workerPid || input.workerPid !== workerPid || input.lane !== request.lane || input.warmups !== request.warmups) throw new Error('Session worker PID/lane/count mismatch');
  const checkedMode = mode(input.mode, request.lane, workerPid);
  const samples = array(input.samples, value => sample(value, request.lane), request.repetitions), identity = record(input.identity), comparators = record(input.comparators);
  if (samples.length !== request.repetitions || samples.some((sample, index) => sample.index !== index)) throw new Error('Session sample count/index mismatch');
  const fresh = array(comparators.checkpoints, checkpoint, 3);
  if (fresh.map(item => item.checkpoint).join(',') !== CHECKPOINTS.join(',')) throw new Error('Invalid fresh checkpoint sequence');
  for (const item of samples.flatMap(sample => sample.checkpoints)) {
    if (fresh.find(checkpoint => checkpoint.checkpoint === item.checkpoint)?.semanticSha256 !== item.semanticSha256) throw new Error('Fresh checkpoint equality failed');
  }
  verifyExpected(fresh, request);
  if (!sameOwner(fresh[1].scope.owner, fresh[2].scope.owner) || fresh[0].scope.owner.epoch === fresh[1].scope.owner.epoch) throw new Error('Fresh comparator owner schedule mismatch');
  if (checkedMode.kind === 'warm' && (JSON.stringify(checkedMode.controls.engine) !== JSON.stringify(engine(identity.engine)) || checkedMode.controls.observerSha256 !== identity.observerSha256)) throw new Error('Worker/context engine identity mismatch');
  const after = parseMemory(input.afterDocumentAndPackDispose);
  if (after.componentLiveBlocks || after.retainedOutputBudgetChargeBytes.value || after.adapterLiveOwners || after.adapterHeldScopeLeases || after.adapterHeldPresentationLeases) throw new Error('Incomplete worker cleanup');
  return { schema: 'scope-compat/session-worker@1', adapter: 'session-native', acceptance: NONACCEPTANCE, workerPid, lane: request.lane,
    checkpointRetention: literal(input.checkpointRetention, CHECKPOINT_RETENTION), mode: checkedMode, initializationMs: duration(input.initializationMs),
    warmups: request.warmups, identity: { engine: engine(identity.engine), compiler: string(identity.compiler), flags: array(identity.flags, string), observerSha256: hash(identity.observerSha256) },
    samples, comparators: { boundary: literal(comparators.boundary, 'after measured owners close; outside samples, included in worker launch-to-exit'), durationMs: duration(comparators.durationMs), checkpoints: fresh },
    afterDocumentAndPackDispose: after, sharedPreparationMs: duration(input.sharedPreparationMs), sharedOwnerDisposeMs: duration(input.sharedOwnerDisposeMs), reportEncodingValidationMs: duration(input.reportEncodingValidationMs) };
}

function verifyExpected(checkpoints: readonly CheckpointRecord[], request: SessionRequest): void {
  const final = prepareEdits(request.case.source, request.case.edits, numericLimits()).source, themes = normalizedThemes(request.case);
  for (const item of checkpoints) {
    const source = sourceIdentity(item.checkpoint === 'initial-a' ? request.case.source : final), theme = themes[item.checkpoint === 'edited-b' ? 1 : 0];
    if (item.sourceUtf16leSha256 !== source.utf16leSha256 || item.sourceWtf8Sha256 !== source.wtf8Sha256 || item.sourceLength !== source.length ||
        item.theme.contentRevision !== theme.contentRevision || item.theme.acquisitionRevision !== theme.acquisitionRevision || item.theme.normalizedPacketDigest !== theme.normalizedPacketDigest || item.theme.targetIdentity !== theme.targetIdentity) throw new Error('Worker case/source/theme identity mismatch');
  }
}
