// Check an unpacked npm or git package through its public exports, outside this project.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter(arg => arg !== '--runtime' && arg !== '--runtime-only');
const packageArgument = args[0];
if (!packageArgument) throw new Error('Expected an unpacked package directory');
const packageDirectory = resolve(packageArgument);
const compiler = args[1] ?? fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
const runtimeOnly = process.argv.includes('--runtime-only');
const runtime = runtimeOnly || process.argv.includes('--runtime');
const scratch = mkdtempSync(join(tmpdir(), 'tree-sitter-package-types-'));
const cleanup = () => { rmSync(scratch, { recursive: true, force: true }); };
process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('SIGTERM', () => { cleanup(); process.exit(143); });

function check(files: string[], label: string) {
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

function checkPackage(name: string) {
  const dependency = join(scratch, 'node_modules', name);
  mkdirSync(resolve(dependency, '..'), { recursive: true });
  symlinkSync(packageDirectory, dependency, 'junction');
  if (runtime) checkRuntime(name);
  if (runtimeOnly) return;
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

function checkRuntime(name: string) {
  const consumer = join(scratch, 'runtime.mjs');
  writeFileSync(consumer, `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const name = ${JSON.stringify(name)};
for (const suffix of ['', '/debug']) {
  const specifier = name + suffix;
  const wasmSpecifier = specifier + '/web-tree-sitter.wasm';
  const wasmPath = fileURLToPath(import.meta.resolve(wasmSpecifier));
  assert.equal(require.resolve(wasmSpecifier), wasmPath);
  await WebAssembly.compile(readFileSync(wasmPath));
  for (const binding of [await import(specifier), require(specifier)]) {
    await binding.Parser.init();
    const parser = new binding.Parser();
    const buffer = new binding.TextBuffer('café 😀');
    try {
      assert(binding.heap().byteLength > 0);
      assert.equal(buffer.slice(), 'café 😀');
    } finally {
      buffer.delete();
      parser.delete();
    }
  }
  console.log('PASS ' + specifier + ': packed ESM/CommonJS/Wasm runtime');
}
`);
  const result = spawnSync(process.execPath, [consumer], { cwd: scratch, encoding: 'utf8', timeout: 60_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout);
}

try {
  const manifest: unknown = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !('name' in manifest) || typeof manifest.name !== 'string') {
    throw new Error('Expected a package name');
  }
  const { name } = manifest;
  const names = new Set([name, '@singapore-editor/tree-sitter-x', 'web-tree-sitter']);
  for (const packageName of names) checkPackage(packageName);
} finally {
  cleanup();
}
