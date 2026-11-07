import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { distribution, parseRequest, record } from '../src/measurement/model.ts';
import { allocationLedger } from '../src/measurement/observer.ts';
import { catalog } from '../src/measurement/identity.ts';

function objects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return Array.from(value, record);
}
function command(args: readonly string[]) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url))].concat(args),
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
}

describe('internal measurement command', () => {
  it('tracks requested live bytes, realloc failure, reclamation and unknown frees separately', () => {
    const ledger = allocationLedger();
    ledger.track('malloc', [12], 100);
    ledger.track('calloc', [2, 8], 200);
    expect(ledger.snapshot()).toMatchObject({ blocks: 2, requestedBytes: 28, peakRequestedBytes: 28 });
    ledger.track('realloc', [100, 50], 0);
    expect(ledger.snapshot().requestedBytes).toBe(28);
    ledger.track('realloc', [100, 20], 300);
    expect(ledger.snapshot().requestedBytes).toBe(36);
    ledger.track('free', [200], 0);
    ledger.track('realloc', [300, 0], 0);
    ledger.track('free', [999], 0);
    expect(ledger.snapshot()).toMatchObject({ blocks: 0, requestedBytes: 0, peakRequestedBytes: 36, unknownFrees: 1 });
  });

  it('rejects invalid counts and reports nearest-rank distributions without timing limits', () => {
    expect(distribution([3, 1, 2])).toEqual({ count: 3, min: 1, p50: 2, p95: 3, max: 3, unit: 'ms', method: 'nearest-rank' });
    for (const repetitions of [0, -1, 0.5, 101, NaN]) {
      expect(() => parseRequest({ lane: 'cold-open', language: 'json', source: '', warmups: 0, repetitions })).toThrow();
    }
    expect(() => distribution([])).toThrow();
    expect(() => distribution([Infinity])).toThrow();
    for (const args of [['--repetitions', '0'], ['--warmups', '-1'], ['--lane', 'fake'], ['--language', 'markdown'], ['--warmups', '0', '--warmups', '1']]) {
      const result = command(args);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('npm run measure');
    }
  });

  it('accounts for every catalog row, theme and unavailable dependency without promoting a prototype', async () => {
    const inventory = await catalog('json');
    expect(inventory.languages).toHaveLength(242);
    expect(inventory.structuralLanguages).toHaveLength(23);
    expect(inventory.themes).toHaveLength(65);
    expect(inventory.unavailableInjectionDependencies).toEqual(['regex', 'jsdoc', 'phpdoc']);
    expect(inventory.languages.filter(row => row.status === 'measured-partial-prototype').map(row => row.id)).toEqual(['json']);
    expect(inventory.themes.filter(row => row.status === 'reference-matcher-only')).toHaveLength(4);
    expect(inventory.mixedMarkdown.kind).toBe('unsupported');
  });

  it('executes real positive controls before cold, shared-tree and immutable-owner loops', () => {
    const result = command(['--repetitions', '2', '--warmups', '1']);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const report = record(JSON.parse(result.stdout));
    expect(report.schema).toBe('scope-compat/measurement@1');
    expect(report.acceptance).toContain('No performance benefit');
    expect(record(report.source).contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record(record(report.environment).runtime).versions).toMatchObject({ node: process.versions.node });
    const controls = record(record(report.controls).data);
    expect(controls).toMatchObject({ status: 'passed', parseCalls: 1, scopeExtraParses: 0 });
    const hashes = new Set<unknown>();
    for (const lane of objects(report.lanes)) verifyLane(lane, hashes);
    expect(hashes.size).toBe(1);
    expect(record(record(report.limits).incrementalEdits).kind).toBe('unsupported');
    expect(record(record(report.limits).nativeThemeResolution).kind).toBe('unsupported');
  }, 30_000);

  it.each(['typescript', 'tsx'])('runs the existing %s pack without claiming incremental or injection support', language => {
    const result = command(['--language', language, '--lane', 'shared-tree', '--repetitions', '1', '--warmups', '0']);
    expect(result.status, result.stderr).toBe(0);
    expect(record(JSON.parse(result.stdout)).purpose).toBe('internal partial-prototype diagnostics');
  }, 30_000);
});

function verifyLane(lane: Record<string, unknown>, hashes: Set<unknown>): void {
  expect(lane.repetitions).toBe(2);
  expect(lane.warmups).toBe(lane.lane === 'cold-open' ? 0 : 1);
  const runs = objects(lane.runs);
  expect(runs).toHaveLength(lane.lane === 'cold-open' ? 2 : 1);
  for (const run of runs) verifyRun(run, lane.lane === 'shared-tree', hashes);
}

function verifyRun(run: Record<string, unknown>, shared: boolean, hashes: Set<unknown>): void {
  const data = record(run.data), identity = record(data.identity);
  expect(identity.compiler).toEqual(expect.any(String));
  expect(identity.flags).toEqual(expect.any(Array));
  expect(record(identity.engine).parserSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record(data.afterDocumentAndPackDispose).componentLiveBlocks).toBe(0);
  for (const sample of objects(data.samples)) {
    expect(sample.parseCalls).toBe(shared ? 0 : 1);
    expect(record(sample.work).capturesSeen).toBeGreaterThan(0);
    expect(record(record(sample.memory).liveDocument).wasmCapacityBytes).toBeGreaterThan(0);
    hashes.add(record(sample.work).outputSha256);
  }
}
