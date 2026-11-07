import { writeFile } from 'node:fs/promises';
import { replayNative, ReplayFailure } from '../native/replay.ts';
const args = process.argv.slice(2);
function argument(name: string, fallback: string): string { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] ?? ''; }
const language = argument('--language', 'typescript');
try {
  if (language !== 'json' && language !== 'typescript' && language !== 'tsx' && language !== 'markdown') throw new Error('Unsupported replay language');
  process.stdout.write(JSON.stringify(await replayNative({ seed: Number(argument('--seed', '1')), edits: Number(argument('--edits', '32')), language })) + '\n');
} catch (error) {
  const failure = argument('--failure-out', '');
  if (failure && error instanceof ReplayFailure) await writeFile(failure, JSON.stringify(error.reproduction, null, 2) + '\n');
  throw error;
}
