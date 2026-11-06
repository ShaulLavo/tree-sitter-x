/// <reference lib="dom" />
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export const componentPath = 'lib/scope-compat/build/scope-compat.wasm';
export const manifestPath = 'lib/scope-compat/build/scope-compat.manifest.json';

const requiredInputs = [
  'Cargo.toml', 'Cargo.lock', 'crates/loader/wasi-sdk-version', 'crates/xtask/Cargo.toml',
  'crates/xtask/src/main.rs', 'crates/xtask/src/build_wasm.rs',
  'lib/include/tree_sitter/api.h', 'lib/src/wasm-stdlib/imports.txt',
  'lib/binding_web/lib/exports.txt', 'lib/binding_web/lib/extra-exports.txt',
  'lib/scope-compat/imports.txt', 'lib/scope-compat/include/scope_compat.h',
  'lib/scope-compat/src/alloc.h', 'lib/scope-compat/src/internal.h',
  'lib/scope-compat/src/alloc.c', 'lib/scope-compat/src/pack.c',
  'lib/scope-compat/src/predicate.c', 'lib/scope-compat/src/collect.c',
  'lib/scope-compat/src/compose.c', 'lib/scope-compat/src/exports.c',
];
const inputDirectories = ['lib/scope-compat/src', 'lib/scope-compat/include', 'crates/xtask/src'];

export function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function inventory(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? inventory(root, path) : [path];
  }));
  return groups.flat();
}

export async function componentInputs(root = repositoryRoot): Promise<string[]> {
  const groups = await Promise.all(inputDirectories.map((directory) => inventory(root, directory)));
  const paths = Array.from(new Set(requiredInputs.concat(groups.flat())));
  paths.sort();
  return paths;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inputEntries(value: unknown): Map<string, string> {
  if (!Array.isArray(value)) throw new Error('Missing component input inventory');
  const inputs = new Map<string, string>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.sha256 !== 'string') {
      throw new Error('Malformed component input');
    }
    if (inputs.has(entry.path)) throw new Error(`Duplicate component input: ${entry.path}`);
    inputs.set(entry.path, entry.sha256);
  }
  return inputs;
}

export async function checkFreshness(bytes: Uint8Array, manifest: unknown, root = repositoryRoot): Promise<void> {
  if (!isRecord(manifest) || manifest.abi !== 1 || !isRecord(manifest.wasm)) throw new Error('Invalid component manifest');
  if (manifest.wasm.size !== bytes.byteLength || manifest.wasm.sha256 !== digest(bytes)) throw new Error('Stale component Wasm');
  if (typeof manifest.compiler !== 'string' || !manifest.compiler || !Array.isArray(manifest.flags)) throw new Error('Missing compiler identity');
  const inputs = inputEntries(manifest.inputs);
  const expected = await componentInputs(root);
  if (expected.length !== inputs.size) throw new Error('Changed component input inventory');
  for (const path of expected) {
    const bytes = await readFile(resolve(root, path));
    if (inputs.get(path) !== digest(bytes)) throw new Error(`Stale component input: ${path}`);
  }
}

export function checkImports(module: WebAssembly.Module, allowed: ReadonlySet<string>): void {
  for (const item of WebAssembly.Module.imports(module)) checkImport(item, allowed);
}

export function checkImport(item: WebAssembly.ModuleImportDescriptor, allowed: ReadonlySet<string>): void {
  const forbidden = item.name.startsWith('ts_parser_') || ['ts_tree_edit', 'ts_tree_copy', 'ts_tree_delete'].includes(item.name);
  const direct = item.module === 'env' && item.kind === 'function';
  const indirect = item.module === 'GOT.func' && item.kind === 'global';
  if (direct || indirect) {
    if (forbidden || !allowed.has(item.name)) throw new Error(`Forbidden component function: ${item.module}.${item.name}`);
    return;
  }
  const structural = item.module === 'env' && (
    (item.kind === 'memory' && item.name === 'memory') ||
    (item.kind === 'table' && item.name === '__indirect_function_table') ||
    (item.kind === 'global' && ['__stack_pointer', '__memory_base', '__table_base'].includes(item.name))
  );
  if (!structural) throw new Error(`Forbidden component import: ${item.module}.${item.name} (${item.kind})`);
}

export async function checkComponent(root = repositoryRoot): Promise<WebAssembly.Module> {
  const bytes = await readFile(resolve(root, componentPath));
  const manifest: unknown = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));
  await checkFreshness(bytes, manifest, root);
  const allowed = new Set((await readFile(resolve(root, 'lib/scope-compat/imports.txt'), 'utf8')).trim().split(/\s+/));
  const module = new WebAssembly.Module(bytes);
  checkImports(module, allowed);
  return module;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--check') {
  await checkComponent();
  console.log('scope-compat import and freshness checks passed');
}
