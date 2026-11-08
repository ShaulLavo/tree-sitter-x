import { readFile } from 'node:fs/promises';
import { runMeasurement } from '../measurement/run.ts';
import { LANES } from '../measurement/model.ts';
import type { Lane } from '../measurement/model.ts';
import { runSessionMeasurement } from '../measurement/session-run.ts';
import { boundedJson } from '../measurement/bounds.ts';
import { SESSION_LIMITS } from '../measurement/session-case.ts';

const usage = 'npm run measure -- [--adapter full-pass-reference|session-native] [--case builtin:json-lifecycle-v1|FILE] [--language json|typescript|tsx] [--source FILE] [--lane all|cold-open|shared-tree|end-to-end-adapter] [--repetitions 1..100] [--warmups 0..100]';
try {
  const args = process.argv.slice(2);
  const flags = new Map<string, string>();
  if (args.includes('--help')) { process.stdout.write(`${usage}\n`); process.exit(0); }
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!['--adapter', '--case', '--language', '--source', '--lane', '--repetitions', '--warmups'].includes(key) || value === undefined || flags.has(key)) throw new Error(`Invalid or duplicate option ${key}`);
    flags.set(key, value);
  }
  const language = flags.get('--language') ?? 'json';
  const selected = flags.get('--lane') ?? 'all';
  const found = LANES.find(lane => lane === selected);
  if (selected !== 'all' && !found) throw new Error(`Unknown lane ${selected}`);
  const lanes: readonly Lane[] = found ? [found] : LANES;
  const adapter = flags.get('--adapter') ?? 'full-pass-reference';
  const counts = { repetitions: Number(flags.get('--repetitions') ?? 5), warmups: Number(flags.get('--warmups') ?? 2), lanes };
  if (adapter === 'session-native') {
    if (flags.has('--source') || flags.has('--language')) throw new Error('Session case conflicts with --source or --language overrides');
    const caseLabel = flags.get('--case');
    if (!caseLabel) throw new Error('Session-native requires --case');
    const report = await runSessionMeasurement({ ...counts, caseLabel });
    process.stdout.write(boundedJson(report, SESSION_LIMITS.reportBytes));
  } else {
    if (adapter !== 'full-pass-reference' || flags.has('--case')) throw new Error('Invalid adapter/case selection');
    await fullPass(flags, language, counts);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}\n`);
  if (process.exitCode === undefined || process.exitCode === 0) process.exitCode = 1;
}

async function fullPass(flags: ReadonlyMap<string, string>, language: string, counts: { repetitions: number; warmups: number; lanes: readonly Lane[] }): Promise<void> {
  const fixtures: Record<string, string> = { json: '{"measurement":[1,true,null]}\n',
    typescript: 'const measurement: number = 1;\n', tsx: 'const measurement = <div title="x">ok</div>;\n' };
  const sourcePath = flags.get('--source');
  const source = sourcePath ? new TextDecoder('utf8', { fatal: true, ignoreBOM: true }).decode(await readFile(sourcePath)) : fixtures[language];
  if (source === undefined) throw new Error(`Unsupported measurement language ${language}`);
  const report = await runMeasurement({ language, source, sourceLabel: sourcePath ?? `builtin:${language}:1`, ...counts });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
