import { readFile } from 'node:fs/promises';
import { runMeasurement } from '../measurement/run.ts';
import { LANES } from '../measurement/model.ts';
import type { Lane } from '../measurement/model.ts';

const usage = 'npm run measure -- [--language json|typescript|tsx] [--source FILE] [--lane all|cold-open|shared-tree|end-to-end-adapter] [--repetitions 1..100] [--warmups 0..100]';
try {
  const args = process.argv.slice(2);
  const flags = new Map<string, string>();
  if (args.includes('--help')) { process.stdout.write(`${usage}\n`); process.exit(0); }
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!['--language', '--source', '--lane', '--repetitions', '--warmups'].includes(key) || value === undefined || flags.has(key)) throw new Error(`Invalid or duplicate option ${key}`);
    flags.set(key, value);
  }
  const language = flags.get('--language') ?? 'json';
  const selected = flags.get('--lane') ?? 'all';
  const found = LANES.find(lane => lane === selected);
  if (selected !== 'all' && !found) throw new Error(`Unknown lane ${selected}`);
  const lanes: readonly Lane[] = found ? [found] : LANES;
  const fixtures: Record<string, string> = { json: '{"measurement":[1,true,null]}\n',
    typescript: 'const measurement: number = 1;\n', tsx: 'const measurement = <div title="x">ok</div>;\n' };
  const sourcePath = flags.get('--source');
  const source = sourcePath ? new TextDecoder('utf8', { fatal: true, ignoreBOM: true }).decode(await readFile(sourcePath)) : fixtures[language];
  if (source === undefined) throw new Error(`Unsupported measurement language ${language}`);
  const report = await runMeasurement({ language, source, sourceLabel: sourcePath ?? `builtin:${language}:1`, lanes,
    repetitions: Number(flags.get('--repetitions') ?? 5), warmups: Number(flags.get('--warmups') ?? 2) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}\n`);
  process.exitCode = 1;
}
