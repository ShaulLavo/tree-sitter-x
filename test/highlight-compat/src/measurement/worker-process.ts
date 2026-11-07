import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { record } from './model.ts';
import type { Request } from './model.ts';

interface WorkerResult {
  readonly data: Record<string, unknown>;
  readonly workerPid: number;
  readonly processLaunchToExitMs: number;
}

function killWorker(worker: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (!worker.pid) return;
  try {
    if (process.platform === 'win32') { worker.kill(signal); return; }
    process.kill(-worker.pid, signal);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return;
    throw error;
  }
}

class WorkerJob {
  readonly result: Promise<WorkerResult>;
  readonly #worker: ChildProcessWithoutNullStreams;
  readonly #started: number;
  readonly #stdout: Buffer[] = [];
  readonly #stderr: Buffer[] = [];
  readonly #deadline: NodeJS.Timeout;
  #killer: NodeJS.Timeout | undefined;
  #bytes = 0;
  #failure: Error | undefined;
  #state: 'running' | 'stopping' | 'closed' = 'running';
  readonly #interrupt = () => this.interrupt('SIGINT');
  readonly #terminate = () => this.interrupt('SIGTERM');

  constructor(worker: ChildProcessWithoutNullStreams, request: Request, started: number) {
    this.#worker = worker;
    this.#started = started;
    this.#deadline = setTimeout(() => this.stop(new Error('Measurement worker timed out')), 120_000);
    this.result = new Promise((resolve, reject) => this.listen(request, resolve, reject));
  }

  private listen(request: Request, resolve: (value: WorkerResult) => void, reject: (error: Error) => void): void {
    process.on('SIGINT', this.#interrupt);
    process.on('SIGTERM', this.#terminate);
    this.#worker.stdout.on('data', (chunk: Buffer) => this.capture(chunk, true));
    this.#worker.stderr.on('data', (chunk: Buffer) => this.capture(chunk, false));
    this.#worker.once('error', error => this.stop(error));
    this.#worker.stdin.on('error', error => this.stop(error));
    this.#worker.once('close', (code, signal) => this.finish(code, signal, resolve, reject));
    this.#worker.stdin.end(JSON.stringify(request));
  }

  private capture(chunk: Buffer, stdout: boolean): void {
    if (this.#bytes + chunk.length > 32 * 1024 * 1024) {
      this.stop(new Error('Measurement worker output limit exceeded'));
      return;
    }
    this.#bytes += chunk.length;
    (stdout ? this.#stdout : this.#stderr).push(chunk);
  }

  private interrupt(signal: 'SIGINT' | 'SIGTERM'): void {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    this.stop(new Error(`Measurement interrupted by ${signal}`));
  }

  private kill(signal: NodeJS.Signals): void {
    try { killWorker(this.#worker, signal); }
    catch (error) { this.#failure ??= error instanceof Error ? error : new Error(String(error)); }
  }

  private stop(error: Error): void {
    if (this.#state !== 'running') return;
    this.#state = 'stopping';
    this.#failure = error;
    this.kill('SIGTERM');
    this.#killer = setTimeout(() => this.kill('SIGKILL'), 1_000);
    this.#killer.unref();
  }

  private finish(code: number | null, signal: NodeJS.Signals | null,
    resolve: (value: WorkerResult) => void, reject: (error: Error) => void): void {
    this.#state = 'closed';
    clearTimeout(this.#deadline);
    clearTimeout(this.#killer);
    process.off('SIGINT', this.#interrupt);
    process.off('SIGTERM', this.#terminate);
    if (this.#failure) { reject(this.#failure); return; }
    if (code !== 0 || signal) {
      reject(new Error(`Measurement worker failed: ${Buffer.concat(this.#stderr).toString('utf8') || signal || code}`));
      return;
    }
    try {
      if (!this.#worker.pid) throw new Error('Measurement worker has no process identity');
      resolve({ data: record(JSON.parse(Buffer.concat(this.#stdout).toString('utf8'))), workerPid: this.#worker.pid,
        processLaunchToExitMs: performance.now() - this.#started });
    } catch (error) { reject(error instanceof Error ? error : new Error(String(error))); }
  }
}

export function runWorker(request: Request, controls = false): Promise<WorkerResult> {
  const args = [fileURLToPath(new URL('worker.ts', import.meta.url))].concat(controls ? ['--controls'] : []);
  const started = performance.now();
  const worker = spawn(process.execPath, args, { stdio: 'pipe', detached: process.platform !== 'win32', windowsHide: true });
  return new WorkerJob(worker, request, started).result;
}
