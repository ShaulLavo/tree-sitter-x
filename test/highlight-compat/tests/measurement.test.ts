import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { distribution, parseRequest, record } from '../src/measurement/model.ts';
import { allocationLedger } from '../src/measurement/observer.ts';
import { catalog } from '../src/measurement/identity.ts';

function objects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return Array.from(value, record);
}
function command(args: readonly string[], env = process.env) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url))].concat(args),
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, env });
}

function fixture(kind: 'observer' | 'pause') {
  const root = mkdtempSync(join(tmpdir(), 'measurement-control-'));
  writeFileSync(join(root, 'package.json'), '{"type":"module","private":true}\n');
  const marker = join(root, 'worker.json');
  const runtime = new URL('../src/native/runtime.ts', import.meta.url).href;
  const body = kind === 'observer'
    ? `const extension = Runtime.prototype.extension;
Runtime.prototype.extension = async function(module) {
  const exports = await extension.call(this, module);
  return typeof exports.scope_test_install === 'function' ? { ...exports, scope_test_install() {} } : exports;
};
const construct = Runtime.prototype.construct;
Runtime.prototype.construct = function(name, args) {
  if (name === 'TextBuffer') writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid }));
  return construct.call(this, name, args);
};`
    : `const construct = Runtime.prototype.construct;
let paused = false;
Runtime.prototype.construct = function(name, args) {
  const result = construct.call(this, name, args);
  if (name === 'TextBuffer' && !paused) {
    paused = true;
    writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid }));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000);
  }
  return result;
};`;
  const path = join(root, 'preload.ts');
  writeFileSync(path, `import { writeFileSync } from 'node:fs';
if (process.argv[1]?.endsWith('/measurement/worker.ts') && !process.argv.includes('--controls')) {
  const { Runtime } = await import(${JSON.stringify(runtime)});
  ${body}
}
`);
  const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(path).href}` };
  return { root, marker, env };
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
    throw error;
  }
}

function stop(pid: number | undefined): void {
  if (!pid || !alive(pid)) return;
  process.kill(pid, 'SIGKILL');
}

async function ready(marker: string, controller: ChildProcess): Promise<number> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (existsSync(marker)) return workerPid(marker);
    if (controller.exitCode !== null || controller.signalCode !== null) throw new Error('Controller exited before target worker');
    await delay(10);
  }
  throw new Error('Target worker did not reach the controlled pause');
}

function workerPid(marker: string): number {
  const pid = record(JSON.parse(readFileSync(marker, 'utf8'))).pid;
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid fixture worker PID');
  return pid;
}

async function closedWithin(result: Promise<number | null>): Promise<number | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([result, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Controller did not reap its worker')), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

describe('internal measurement command', () => {
  it.each(['cold-open', 'shared-tree', 'end-to-end-adapter'].flatMap(lane => ['full-pass-reference', 'session-native'].map(adapter => [lane, adapter])))(
    'rejects an inactive allocation observer in the actual %s %s context before source work', (lane, adapter) => {
      const control = fixture('observer');
      try {
        const result = command(['--adapter', adapter, '--lane', lane, '--repetitions', '1', '--warmups', '0'].concat(adapter === 'session-native' ? ['--case', 'builtin:json-lifecycle-v1'] : []), control.env);
        expect(result.status, result.stderr).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('Measured context allocation observer did not arm');
        expect(existsSync(control.marker)).toBe(false);
      } finally { rmSync(control.root, { recursive: true, force: true }); }
    },
  );

  it.skipIf(process.platform === 'win32').each(['full-pass-reference', 'session-native'])('reaps an active %s worker before exiting on controller SIGTERM', async adapter => {
    const control = fixture('pause');
    const controller = spawn(process.execPath, [fileURLToPath(new URL('../src/cli/measure.ts', import.meta.url)),
      '--adapter', adapter, '--lane', 'cold-open', '--repetitions', '1', '--warmups', '0'].concat(adapter === 'session-native' ? ['--case', 'builtin:json-lifecycle-v1'] : []), { env: control.env, stdio: 'pipe' });
    controller.stdin.end(); controller.stdout.resume(); controller.stderr.resume();
    const closed = new Promise<number | null>((resolve, reject) => {
      controller.once('close', resolve); controller.once('error', reject);
    });
    let pid: number | undefined;
    try {
      pid = await ready(control.marker, controller);
      expect(alive(pid)).toBe(true);
      controller.kill('SIGTERM');
      expect(await closedWithin(closed)).toBe(143);
      expect(alive(pid)).toBe(false);
    } finally {
      stop(pid ?? (existsSync(control.marker) ? workerPid(control.marker) : undefined));
      stop(controller.pid);
      await closedWithin(closed);
      rmSync(control.root, { recursive: true, force: true });
    }
  }, 30_000);
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
  expect(record(data.contextControls)).toMatchObject({ status: 'passed', sourceParses: 0, processId: run.workerPid });
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
