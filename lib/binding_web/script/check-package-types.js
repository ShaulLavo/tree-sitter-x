// Check an unpacked npm or git package through its public exports, outside this project.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(process.argv[2]);
const compiler = process.argv[3] ?? fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
const scratch = mkdtempSync(join(tmpdir(), 'tree-sitter-package-types-'));
const cleanup = () => rmSync(scratch, { recursive: true, force: true });
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

function check(files, label) {
  const config = join(scratch, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({
    compilerOptions: {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      target: 'ES2024',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2024', 'DOM'],
      types: [],
    },
    files,
  }));
  const result = spawnSync(process.execPath, [compiler, '--project', config], {
    cwd: scratch,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}\n${result.stdout}${result.stderr}`);
  console.log(`PASS ${label}`);
}

function checkPackage(name) {
  const dependency = join(scratch, 'node_modules', name);
  mkdirSync(resolve(dependency, '..'), { recursive: true });
  symlinkSync(packageDirectory, dependency, 'junction');
  const consumer = `
import { Parser, Language, Query, TextBuffer, heap } from '${name}';
import { Parser as DebugParser } from '${name}/debug';
export { Parser, Language, Query, TextBuffer, heap };
export const debug: typeof Parser = DebugParser;
export async function exercise(language: Language) {
  await Parser.init();
  await DebugParser.init();
  const bytes: Uint8Array = heap();
  const buffer = new TextBuffer('café 😀');
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(buffer);
  if (!tree) return;
  const query = new Query(language, '(identifier) @name');
  const ranges = query.captureRanges(tree.rootNode);
  ranges.forEach(range => console.log(range));
  console.log(bytes.byteLength);
  query.delete(); tree.delete(); parser.delete(); buffer.delete();
}
`;
  writeFileSync(join(scratch, 'consumer.mts'), consumer);
  writeFileSync(join(scratch, 'consumer.cts'), consumer);
  writeFileSync(join(scratch, 'mixed.mts'), `
import * as esm from './consumer.mjs';
import cjs = require('./consumer.cjs');
const parser: typeof esm.Parser = cjs.Parser;
const language: typeof cjs.Language = esm.Language;
const query: typeof esm.Query = cjs.Query;
const buffer: typeof cjs.TextBuffer = esm.TextBuffer;
const debug: typeof esm.debug = cjs.debug;
void [parser, language, query, buffer, debug];
`);
  check(['consumer.mts'], `${name}: ESM and debug`);
  check(['consumer.cts'], `${name}: CommonJS and debug`);
  check(['consumer.mts', 'consumer.cts', 'mixed.mts'], `${name}: mixed ESM/CommonJS`);
}

try {
  const { name } = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  const names = new Set([name, '@singapore-editor/tree-sitter-x', 'web-tree-sitter']);
  for (const packageName of names) checkPackage(packageName);
} finally {
  cleanup();
}
