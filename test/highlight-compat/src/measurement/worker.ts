import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseRequest } from './model.ts';

const started = performance.now();
try {
  const request = parseRequest(JSON.parse(readFileSync(0, 'utf8')));
  const { measure, positiveControls } = await import('./sample.ts');
  const result = process.argv[2] === '--controls' ? await positiveControls(request) : await measure(request, started);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
}
