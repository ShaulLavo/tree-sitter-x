import { digest } from '../native/component-inputs.ts';
import { nativeLanguage } from '../native/packs.ts';
import { catalog, environment, sourceIdentity } from './identity.ts';
import { LANES, LIMITS, distribution, integer, record } from './model.ts';
import type { Lane } from './model.ts';
import { runWorker } from './worker-process.ts';

export interface Options {
  readonly language: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly repetitions: number;
  readonly warmups: number;
  readonly lanes: readonly Lane[];
}

function samples(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Missing measurement samples');
  return Array.from(value, record);
}
function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid measurement duration');
  return value;
}

async function lane(options: Options, lane: Lane) {
  const request = { ...options, lane };
  const cold = lane === 'cold-open';
  const runs: Awaited<ReturnType<typeof runWorker>>[] = [];
  if (cold) {
    for (let index = 0; index < options.repetitions; index++) runs.push(await runWorker({ ...request, repetitions: 1, warmups: 0 }));
  } else runs.push(await runWorker(request));
  for (const run of runs) {
    const control = record(run.data.contextControls);
    if (control.status !== 'passed' || control.processId !== run.workerPid || control.sourceParses !== 0) throw new Error('Measured context observer control missing');
  }
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
  const controls = await runWorker({ ...options, lane: 'end-to-end-adapter', repetitions: 1, warmups: 0 }, true);
  if (controls.data.status !== 'passed') throw new Error('Observer controls did not pass');
  const lanes: Awaited<ReturnType<typeof lane>>[] = [];
  for (const selected of options.lanes) lanes.push(await lane(options, selected));
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
      cold: 'Every measured engine proves core-query allocation and reclamation before cycles, without a source parse or classification warmup. This control is timed within initialization and reported separately. Cold workers use a fresh process; OS caches are uncontrolled. The separate full control process supplements these same-engine checks.' },
    controls, lanes };
}
