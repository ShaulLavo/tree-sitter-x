import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boundedJson, jsonBytes, readBounded } from '../src/measurement/bounds.ts';
import { BUILTIN_CASE, SESSION_LIMITS, numericLimits, parseSessionCase, parseSessionRequest } from '../src/measurement/session-case.ts';
import { record } from '../src/measurement/model.ts';

const small = { ...SESSION_LIMITS, sourceUnits: 8, insertionUnits: 4, themeBytes: 1024 };
const input = (source = 'abcd', edits = [{ from: 0, to: 0, insert: '12' }, { from: 4, to: 4, insert: '34' }]) => ({ ...BUILTIN_CASE, source, edits });

describe('bounded session measurement input', () => {
  it('counts exact JSON bytes before encoding, including escape and surrogate cases', () => {
    for (const value of ['x\ud800\n"\\😀', { x: [null, true, -1.25, 'é'] }]) {
      const bytes = Buffer.byteLength(JSON.stringify(value));
      expect(jsonBytes(value, bytes)).toBe(bytes);
      expect(boundedJson(value, bytes)).toBe(JSON.stringify(value));
      expect(() => boundedJson(value, bytes - 1)).toThrow(/budget/i);
    }
  });
  it('reads only limit plus one before parsing padded or unknown input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-bounds-'));
    try {
      const path = join(root, 'case.json');
      await checkBoundedRead(path);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('uses identical frozen source limits and rejects aggregate and descending intermediate overflow', () => {
    expect(numericLimits(small)).toEqual({ index: 8, column: 8, row: 8 });
    expect(Object.isFrozen(numericLimits(small))).toBe(true);
    expect(parseSessionCase(input(), small).source).toBe('abcd');
    expect(() => parseSessionCase(input('abcd', [{ from: 1, to: 1, insert: '12345' }]), small)).toThrow(/budget/i);
    expect(() => parseSessionCase(input('abcdefgh', [{ from: 0, to: 2, insert: '' }, { from: 6, to: 6, insert: 'XY' }]), small)).toThrow(/Numeric limit/);
    expect(parseSessionCase(input('abcdefgh', [{ from: 0, to: 1, insert: 'X' }]), small).source.length).toBe(8);
    expect(() => parseSessionCase(input('abcdefghi'), small)).toThrow();
  });
  it('rejects unsupported shapes and bounds the private worker report budget', () => {
    for (const patch of [{ extra: true }, { language: 'tsx' }, { profile: 'raw' }, { framing: 'other' }, { edits: [] }, { themeJson: ['{}'] },
      { edits: Array.from({ length: 17 }, () => ({ from: 0, to: 0, insert: '' })) }, { themeJson: ['{"include":"x"}', '{}'] }]) {
      expect(() => parseSessionCase({ ...BUILTIN_CASE, ...patch })).toThrow();
    }
    const request = { adapter: 'session-native', lane: 'shared-tree', case: BUILTIN_CASE, repetitions: 1, warmups: 0, reportBudget: 100 };
    expect(parseSessionRequest(request).reportBudget).toBe(100);
    for (const reportBudget of [0, -1, 1.5, Infinity, SESSION_LIMITS.reportBytes + 1]) expect(() => parseSessionRequest({ ...request, reportBudget })).toThrow();
  });
  it('selects session-native in the existing command and rejects conflicting overrides before work', () => {
    const cli = fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url));
    const run = (args: string[]) => spawnSync(process.execPath, [cli].concat(args), { encoding: 'utf8', timeout: 30000 });
    const conflict = run(['--adapter', 'session-native', '--case', 'builtin:json-lifecycle-v1', '--source', 'unused']);
    expect(conflict.status).toBe(1); expect(conflict.stdout).toBe(''); expect(conflict.stderr).toContain('conflict');
    const result = run(['--adapter', 'session-native', '--case', 'builtin:json-lifecycle-v1', '--lane', 'shared-tree', '--repetitions', '1', '--warmups', '0']);
    expect(result.status, result.stderr).toBe(0);
    expect(record(JSON.parse(result.stdout)).schema).toBe('scope-compat/session-measurement@1');
  });
});

it('bounds serialized requests exactly and rejects a later invocation record instead of dropping it', async () => {
  const { serializeSessionRequest } = await import('../src/measurement/session-case.ts');
  const { reportBudget } = await import('../src/measurement/bounds.ts');
  const request = { adapter: 'session-native' as const, lane: 'shared-tree' as const, case: BUILTIN_CASE, repetitions: 1, warmups: 0, reportBudget: 100 };
  const bytes = Buffer.byteLength(JSON.stringify(request));
  expect(serializeSessionRequest(request, { ...SESSION_LIMITS, workerInputBytes: bytes })).toBe(JSON.stringify(request));
  expect(() => serializeSessionRequest(request, { ...SESSION_LIMITS, workerInputBytes: bytes - 1 })).toThrow(/budget/i);
  const budget = reportBudget(10); budget.reserve('abc'); budget.reserve('abc');
  expect(budget.remaining()).toBe(0); expect(() => budget.reserve(1)).toThrow(/budget/i);
});

it('validates actual worker reports, cold availability, PID, sequences, counts, retention, cleanup and cumulative invocation budgets', async () => {
  const { parseSessionWorkerReport } = await import('../src/measurement/session-report.ts');
  const { runSessionMeasurement } = await import('../src/measurement/session-run.ts');
  const { LANES } = await import('../src/measurement/model.ts');
  const { parseSessionRequest } = await import('../src/measurement/session-case.ts');
  const cli = fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--adapter', 'session-native', '--case', 'builtin:json-lifecycle-v1', '--repetitions', '1', '--warmups', '0'], { encoding: 'utf8', timeout: 30000, maxBuffer: SESSION_LIMITS.reportBytes });
  expect(result.status, result.stderr).toBe(0);
  const report = record(JSON.parse(result.stdout));
  if (!Array.isArray(report.lanes)) throw new Error('Missing lanes');
  const runs = report.lanes.map(value => {
    const lane = record(value); if (!Array.isArray(lane.runs)) throw new Error('Missing workers'); return record(lane.runs[0]);
  });
  for (const run of runs) {
    const data = record(run.data), pid = Number(run.workerPid);
    const request = parseSessionRequest({ adapter: 'session-native', lane: data.lane, case: BUILTIN_CASE, repetitions: 1, warmups: 0, reportBudget: SESSION_LIMITS.reportBytes });
    expect(parseSessionWorkerReport(data, request, pid).samples).toHaveLength(1);
    for (const mutate of reportMutations()) {
      const changed: unknown = structuredClone(data); mutate(record(changed));
      expect(() => parseSessionWorkerReport(changed, request, pid)).toThrow();
    }
  }
  const first = runs[0], firstBytes = Buffer.byteLength(JSON.stringify(first)), budget = firstBytes + 18000;
  let dispatched = 0;
  const dispatch = async (request: Parameters<typeof parseSessionRequest>[0]) => {
    dispatched++; const parsed = parseSessionRequest(request);
    const run = runs.find(run => record(run.data).lane === parsed.lane); if (!run) throw new Error('Missing fake worker');
    return { data: record(run.data), workerPid: Number(run.workerPid), processLaunchToExitMs: Number(run.processLaunchToExitMs) };
  };
  await expect(runSessionMeasurement({ caseLabel: 'builtin:json-lifecycle-v1', lanes: LANES, repetitions: 1, warmups: 0 }, { ...SESSION_LIMITS, reportBytes: budget }, dispatch)).rejects.toThrow(/budget|count/i);
  expect(dispatched).toBeGreaterThanOrEqual(1); expect(dispatched).toBeLessThanOrEqual(2);
});
function reportMutations(): ((data: Record<string, unknown>) => void)[] {
  const sample = (data: Record<string, unknown>) => {
    if (!Array.isArray(data.samples)) throw new Error('Missing samples'); return record(data.samples[0]);
  };
  const firstStep = (data: Record<string, unknown>) => {
    const item = sample(data); if (!Array.isArray(item.steps)) throw new Error('Missing steps'); return record(item.steps[0]);
  };
  return [data => { data.schema = 'other'; }, data => { data.workerPid = 0; }, data => { data.checkpointRetention = 'other'; },
    data => { data.samples = []; }, data => { sample(data).index = 1; }, data => { sample(data).lifecycleMs = -1; },
    data => { sample(data).checkpoints = []; }, data => { firstStep(data).step = 'edit-to-output'; },
    data => { record(firstStep(data).counts).parseCalls = { kind: data.lane === 'cold-open' ? 'observed' : 'unsupported', value: 0, reason: 'fake' }; },
    data => { record(data.afterDocumentAndPackDispose).componentLiveBlocks = 1; }, data => { record(data.mode).kind = 'invalid'; }];
}

it('accepts empty source and equal themes without weakening the fixed changed-style control', async () => {
  const root = await mkdtemp(join(tmpdir(), 'session-empty-'));
  try {
    const path = join(root, 'case.json');
    await writeFile(path, JSON.stringify({ ...BUILTIN_CASE, source: '', edits: [{ from: 0, to: 0, insert: '' }], themeJson: [BUILTIN_CASE.themeJson[0], BUILTIN_CASE.themeJson[0]] }));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url)), '--adapter', 'session-native', '--case', path, '--lane', 'end-to-end-adapter', '--repetitions', '1', '--warmups', '0'], { encoding: 'utf8', timeout: 30000 });
    expect(result.status, result.stderr).toBe(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('accepts exact UTF-8 theme bytes, insertion units and edit count and rejects their first excess', () => {
  const text = JSON.stringify({ tokenColors: [{ settings: { foreground: '#123456', fontStyle: '' } }], name: 'é' });
  const bounds = { ...SESSION_LIMITS, themeBytes: Buffer.byteLength(text) };
  expect(parseSessionCase({ ...BUILTIN_CASE, themeJson: [text, text] }, bounds).themeJson[0]).toBe(text);
  expect(() => parseSessionCase({ ...BUILTIN_CASE, themeJson: [text + ' ', text] }, bounds)).toThrow(/budget/i);
  const sixteen = Array.from({ length: 16 }, (_, index) => ({ from: index, to: index, insert: '' }));
  expect(parseSessionCase({ ...BUILTIN_CASE, source: 'x'.repeat(16), edits: sixteen }).edits).toHaveLength(16);
  expect(() => parseSessionCase({ ...BUILTIN_CASE, source: 'x'.repeat(17), edits: sixteen.concat([{ from: 16, to: 16, insert: '' }]) })).toThrow();
  expect(parseSessionCase(input('abcd', [{ from: 1, to: 1, insert: '1234' }]), small).edits[0].insert.length).toBe(4);
});

it('refuses custom JSON expansion before invoking it', () => {
  let invoked = false;
  const value = Object.defineProperty({}, 'toJSON', { value() { invoked = true; return 'x'.repeat(1000); } });
  expect(() => boundedJson(value, 2)).toThrow(); expect(invoked).toBe(false);
});

it('keeps two raw samples in every lane with the exact warmup and cold-process schedule', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url)), '--adapter', 'session-native', '--case', 'builtin:json-lifecycle-v1', '--repetitions', '2', '--warmups', '1'], { encoding: 'utf8', timeout: 30000, maxBuffer: SESSION_LIMITS.reportBytes });
  expect(result.status, result.stderr).toBe(0);
  const report = record(JSON.parse(result.stdout)); if (!Array.isArray(report.lanes)) throw new Error('Missing lanes');
  for (const value of report.lanes) {
    const lane = record(value); if (!Array.isArray(lane.runs)) throw new Error('Missing runs');
    expect(lane.repetitions).toBe(2); expect(lane.warmups).toBe(lane.lane === 'cold-open' ? 0 : 1);
    const samples = lane.runs.flatMap(run => { const data = record(record(run).data); if (!Array.isArray(data.samples)) throw new Error('Missing samples'); return data.samples; });
    expect(samples).toHaveLength(2);
    if (lane.lane === 'cold-open') expect(new Set(lane.runs.map(run => record(run).workerPid)).size).toBe(2);
  }
});

async function checkBoundedRead(path: string): Promise<void> {
  await writeFile(path, '1234'); expect(await readBounded(path, 4)).toEqual(Buffer.from('1234'));
  for (const source of ['1234 ', '     ', '{"unknown":true}']) {
    await writeFile(path, source); await expect(readBounded(path, 4)).rejects.toThrow(/budget/i);
  }
}
