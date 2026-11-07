import { readFileSync, writeFileSync } from 'node:fs';
import { buildNativeReport } from '../native-report.ts';
import { EXPERIMENT_007 } from '../experiment-007.ts';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('Usage: report:native [--check]');
const path = EXPERIMENT_007.report;
const actual = await buildNativeReport();
if (args.includes('--check')) {
  if (readFileSync(path, 'utf8') !== actual) throw new Error('Native pilot report is stale. Run npm run report:native.');
  console.log('Native pilot report matches content identities and unchanged reference inputs.');
} else {
  writeFileSync(path, actual);
  console.log('Wrote reports/native-pilot.md');
}
