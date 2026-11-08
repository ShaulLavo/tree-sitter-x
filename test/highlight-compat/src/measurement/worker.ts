import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseRequest, record } from './model.ts';
import { readBounded, boundedJson } from './bounds.ts';
import { parseSessionRequest, SESSION_LIMITS } from './session-case.ts';

const started = performance.now();
try {
  if (process.argv.includes('--session-native')) {
    const bytes = await readBounded(0, SESSION_LIMITS.workerInputBytes);
    const request = parseSessionRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    await session(request);
  } else {
    const input = record(JSON.parse(readFileSync(0, 'utf8')));
    if ('adapter' in input && input.adapter !== 'full-pass-reference') throw new Error('Invalid measurement adapter');
    const request = parseRequest(input), { measure, positiveControls } = await import('./sample.ts');
    const result = process.argv[2] === '--controls' ? await positiveControls(request) : await measure(request, started);
    process.stdout.write(JSON.stringify(result));
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
}

async function session(request: ReturnType<typeof parseSessionRequest>): Promise<void> {
  const { runSessionWorker, SessionMeasurementFailure } = await import('./session.ts');
  try {
    const result = await runSessionWorker(request, started);
    process.stdout.write(boundedJson(result, request.reportBudget));
  } catch (error) {
    if (!(error instanceof SessionMeasurementFailure)) throw error;
    process.stderr.write(boundedJson(error.envelope, SESSION_LIMITS.reportBytes)); process.exitCode = 1;
  }
}
