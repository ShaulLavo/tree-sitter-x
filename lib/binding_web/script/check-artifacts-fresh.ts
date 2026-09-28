import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const inputFiles = [
  '../lib/tree-sitter.c',
  '../lib/exports.txt',
  '../lib/extra-exports.txt',
  './build.js',
  './import-meta-url.cjs',
  '../../../crates/xtask/src/build_wasm.rs',
  '../../../crates/loader/wasi-sdk-version',
  '../../../crates/loader/binaryen-version',
  ...listFiles('../src'),
  ...listFiles('../../include/tree_sitter'),
  ...listFiles('../../src'),
];

const outputFiles = ['../web-tree-sitter.js', '../web-tree-sitter.wasm'];
const outputMtime = Math.min(...outputFiles.map(getMtime));

for (const inputFile of inputFiles) {
  if (getMtime(inputFile) > outputMtime) {
    console.log(`File '${inputFile}' has changed. Re-run 'npm run build'.`);
    process.exit(1);
  }
}

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(path.resolve(scriptDir, dir))
    .filter(p => !p.startsWith('.'))
    .map(p => path.join(dir, p));
}

function getMtime(p: string): number {
  return fs.statSync(path.resolve(scriptDir, p)).mtime.getTime();
}
