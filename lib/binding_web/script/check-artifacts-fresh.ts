import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const inputFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'lib/tree-sitter.c',
  'lib/exports.txt',
  'lib/extra-exports.txt',
  'lib/wasm-memory.d.ts',
  'lib/web-tree-sitter.d.ts',
  'script/build.ts',
  'script/generate-dts.js',
  'script/import-meta-url.cjs',
  'script/check-artifacts-fresh.ts',
  '../../crates/xtask/src/build_wasm.rs',
  '../../crates/loader/wasi-sdk-version',
  '../../crates/loader/binaryen-version',
].concat(listInputs('src'), listInputs('../include'), listInputs('../src'));

function listInputs(relative: string): string[] {
  const absolute = path.resolve(packageDir, relative);
  if (!fs.statSync(absolute).isDirectory()) return [relative];
  return [relative].concat(fs.readdirSync(absolute).flatMap(entry => listInputs(path.join(relative, entry))));
}

function exportFiles(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value === null) return [];
  if (typeof value !== 'object') throw new Error('Expected local package exports');
  return Object.values(value).flatMap((entry: unknown) => exportFiles(entry));
}

const manifest: unknown = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
if (!manifest || typeof manifest !== 'object' || !('files' in manifest) ||
    !Array.isArray(manifest.files) || !('exports' in manifest) || !('types' in manifest) ||
    typeof manifest.types !== 'string') {
  throw new Error('Expected package files, exports and types');
}
const files = manifest.files.map((file: unknown) => {
  if (typeof file !== 'string') throw new Error('Expected package file paths');
  return file;
});
const outputFiles = new Set(files.concat(exportFiles(manifest.exports), [manifest.types]));
const outputMtime = Math.min(...Array.from(outputFiles, file => {
  const stat = fs.statSync(path.resolve(packageDir, file));
  if (!stat.isFile()) throw new Error(`Package artifact '${file}' is not a file`);
  return stat.mtimeMs;
}));

for (const file of inputFiles) {
  if (fs.statSync(path.resolve(packageDir, file)).mtimeMs <= outputMtime) continue;
  throw new Error(`Input '${file}' has changed. Rebuild release/debug ESM/CJS and declarations before packing.`);
}
