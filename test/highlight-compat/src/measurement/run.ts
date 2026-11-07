import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { digest } from '../native/component-inputs.ts';
import { nativeLanguage } from '../native/packs.ts';
import { catalog, environment, sourceIdentity } from './identity.ts';
import { LANES, LIMITS, distribution, integer, record } from './model.ts';
import type { Lane, Request } from './model.ts';

export interface Options {
  readonly language: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly repetitions: number;
  readonly warmups: number;
  readonly lanes: readonly Lane[];
}

function child(request: Request, controls = false) {
  const started = performance.now();
  const args = [fileURLToPath(new URL('worker.ts', import.meta.url))].concat(controls ? ['--controls'] : []);
  const result = spawnSync(process.execPath, args, { input: JSON.stringify(request), encoding: 'utf8',
    timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0 || result.signal) throw new Error(`Measurement worker failed: ${result.error?.message ?? result.stderr ?? result.signal}`);
  return { data: record(JSON.parse(result.stdout)), processLaunchToExitMs: performance.now() - started };
}

function samples(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Missing measurement samples');
  return Array.from(value, record);
}
function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid measurement duration');
  return value;
}

function lane(options: Options, lane: Lane) {
  const request = { ...options, lane };
  const cold = lane === 'cold-open';
  const runs = cold ? Array.from({ length: options.repetitions }, () => child({ ...request, repetitions: 1, warmups: 0 })) : [child(request)];
  const observations = runs.flatMap(run => samples(run.data.samples));
  const durations = observations.map(sample => duration(cold ? sample.firstOutputFromWorkerStartMs : sample.durationMs));
  const expectedParses = lane === 'shared-tree' ? 0 : 1;
  if (observations.some(sample => sample.parseCalls !== expectedParses)) throw new Error(`Unexpected parse work in ${lane}`);
  return { lane, workContract: {
    language: options.language, range: 'full-document', initialization: cold ? 'fresh process per repetition, OS caches uncontrolled' : 'outside timed iterations',
    sourceAndTree: lane === 'shared-tree' ? 'retained before iterations' : 'new immutable owner per iteration',
    classification: 'native full pass plus decode', theming: 'four pinned product reference themes',
    delivery: 'canonical JSON encoding in process', diagnostics: 'explanations disabled; allocator and parse instrumentation enabled',
    edits: 'unsupported', comparison: 'No reference timing or current consumer comparison is supplied.' },
    warmups: cold ? 0 : options.warmups, repetitions: observations.length,
    latency: { ...distribution(durations), boundary: cold ? 'worker start to first encoded output' : 'iteration start through owner disposal when applicable' },
    processLaunchToExit: distribution(runs.map(run => run.processLaunchToExitMs)), runs };
}

export async function runMeasurement(options: Options) {
  if (!nativeLanguage(options.language)) throw new Error(`Unsupported measurement language: ${options.language}; root-only json, typescript and tsx are available.`);
  if (!integer(options.repetitions) || options.lanes.length === 0) throw new Error('At least one repetition and lane required');
  integer(options.warmups);
  if (options.lanes.some(lane => !LANES.includes(lane))) throw new Error('Unknown measurement lane');
  const identity = await sourceIdentity();
  const controls = child({ ...options, lane: 'end-to-end-adapter', repetitions: 1, warmups: 0 }, true);
  if (controls.data.status !== 'passed') throw new Error('Observer controls did not pass');
  const lanes = options.lanes.map(selected => lane(options, selected));
  const hashes = new Set(lanes.flatMap(lane => lane.runs.flatMap(run => samples(run.data.samples).map(sample => record(sample.work).outputSha256))));
  if (hashes.size !== 1) throw new Error('Lanes did not produce equivalent full-document output');
  const after = await sourceIdentity();
  if (identity.contentSha256 !== after.contentSha256 || identity.head !== after.head) throw new Error('Source changed during measurement');
  return { schema: 'scope-compat/measurement@1', purpose: 'internal partial-prototype diagnostics',
    acceptance: 'No performance benefit, budget acceptance, promotion or cutover claim.',
    source: identity, input: { label: options.sourceLabel, utf16Units: options.source.length,
      utf16leSha256: digest(Buffer.from(options.source, 'utf16le')), utf8Sha256: digest(Buffer.from(options.source)), utf8Bytes: Buffer.byteLength(options.source),
      lines: options.source.split('\n').length, bucket: Buffer.byteLength(options.source) < 1024 * 1024 ? 'sub-megabyte' : 'megabyte-or-larger' },
    environment: await environment(), catalog: await catalog(options.language), limits: LIMITS,
    observations: { allocationScope: 'Requested live bytes/blocks crossing observed runtime malloc/calloc/realloc/free exports, including core calls routed by the existing test hook. Internal runtime allocations and JS ownership attribution are incomplete.',
      peaks: 'Routed requested-byte high water since instrumentation began, not a whole-process or stage peak.',
      capacity: 'Wasm linear-memory capacity is retained high water, not live memory.',
      latency: 'Instrumented elapsed wall time; distributions have no CI timing thresholds.',
      cold: 'Positive controls run in a separate process before all loops. Cold workers never load the runtime before the timed initialization. Initialization includes installing the test allocator hook; OS caches are uncontrolled.' },
    controls, lanes };
}
