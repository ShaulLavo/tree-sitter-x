import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkComponent, checkFreshness, checkImports, componentInputs, componentPath, digest,
  manifestPath, repositoryRoot, sourceIdentity,
} from '../src/native/component-inputs.ts';

function leb(value: number): number[] {
  const bytes: number[] = [];
  do { bytes.push((value & 127) | (value > 127 ? 128 : 0)); value >>>= 7; } while (value);
  return bytes;
}

function string(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  return leb(bytes.length).concat(bytes);
}

function section(id: number, bytes: number[]): number[] { return [id].concat(leb(bytes.length), bytes); }

function importModule(namespace: string, name: string, indirect = false): WebAssembly.Module {
  const descriptor = indirect ? [3, 0x7f, 0] : [0, 0];
  const imports = [1].concat(string(namespace), string(name), descriptor);
  const bytes = [0, 97, 115, 109, 1, 0, 0, 0].concat(section(1, [1, 0x60, 0, 0]), section(2, imports));
  return new WebAssembly.Module(Uint8Array.from(bytes));
}

async function scratch<T>(operation: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(resolve(tmpdir(), 'scope-inputs-'));
  try { return await operation(root); } finally { await rm(root, { recursive: true, force: true }); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' && value !== null && !Array.isArray(value)) || typeof value === 'function';
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected runtime exports');
  return value;
}

function callable(value: unknown): (...arguments_: unknown[]) => unknown {
  if (typeof value !== 'function') throw new Error('Expected runtime function');
  return (...arguments_: unknown[]) => Reflect.apply(value, undefined, arguments_);
}

describe('optional native component inputs', () => {
  it('accepts the real compiled side module and no parser imports', async () => {
    const module = await checkComponent();
    const imports = WebAssembly.Module.imports(module);
    expect(imports.some((entry) => entry.name === 'ts_query_new')).toBe(true);
    expect(imports.some((entry) => entry.name.startsWith('ts_parser_'))).toBe(false);
    expect(WebAssembly.Module.exports(module).some((entry) => entry.name === 'scope_compat_run')).toBe(true);
    expect(WebAssembly.Module.exports(module).some((entry) => entry.name.includes('test_fail'))).toBe(false);
  });

  it('rejects forbidden direct and GOT functions even if supplied in the allowlist', () => {
    const allowed = new Set(['ts_query_new', 'ts_parser_new', 'ts_tree_delete']);
    checkImports(importModule('env', 'ts_query_new'), allowed);
    checkImports(importModule('GOT.func', 'ts_query_new', true), allowed);
    for (const name of ['ts_parser_new', 'ts_tree_delete', 'unknown']) {
      expect(() => checkImports(importModule('env', name), allowed)).toThrow('Forbidden');
      expect(() => checkImports(importModule('GOT.func', name, true), allowed)).toThrow('Forbidden');
    }
    expect(() => checkImports(importModule('other', 'ts_query_new'), allowed)).toThrow('Forbidden');
  });

  it('rejects actual forbidden direct and function-address links', async () => {
    const sdk = process.env.TREE_SITTER_WASI_SDK_PATH ?? resolve(homedir(), '.cache/tree-sitter/wasi-sdk');
    await scratch(async (root) => {
      for (const body of ['TSParser *bad(void) { return ts_parser_new(); }', 'TSParser *(*bad(void))(void) { return ts_parser_new; }']) {
        const result = spawnSync(resolve(sdk, 'bin/clang'), [
          '--target=wasm32-wasip1', '-fPIC', '-shared', '-nostdlib', '-Wl,--no-entry',
          '-Wl,--export=bad', `-Wl,--allow-undefined-file=${resolve(repositoryRoot, 'lib/scope-compat/build/allowed-imports.txt')}`,
          `-I${resolve(repositoryRoot, 'lib/include')}`, '-x', 'c', '-', '-o', resolve(root, 'bad.wasm'),
        ], { input: `#include <tree_sitter/api.h>\n${body}`, encoding: 'utf8' });
        expect(result.error).toBeUndefined();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('undefined symbol: ts_parser_new');
      }
    });
  });

  it('loads through the real runtime seam with the exact wasm32 layout', async () => {
    const url = new URL('../../../lib/binding_web/web-tree-sitter.js', import.meta.url);
    const binding = record(await import(/* @vite-ignore */ url.href));
    await callable(record(binding.Parser).init)();
    const module = await checkComponent();
    const extension = record(await callable(binding.loadExtension)(module));
    const version = extension.scope_compat_abi_version;
    const layout = extension.scope_compat_layout;
    if (typeof version !== 'function' || typeof layout !== 'function') throw new Error('Missing ABI exports');
    expect(version()).toBe(1);
    const rawAddress: unknown = layout();
    if (typeof rawAddress !== 'number' || !Number.isInteger(rawAddress)) throw new Error('Invalid layout address');
    const address = rawAddress >>> 0;
    const heap: unknown = callable(binding.heap)();
    if (!(heap instanceof Uint8Array)) throw new Error('Invalid runtime heap');
    expect(address % 4).toBe(0);
    expect(address).toBeLessThanOrEqual(heap.length - 26 * 4);
    const words = new Uint32Array(heap.buffer, heap.byteOffset + address, 26);
    expect(Array.from(words)).toEqual([26, 60, 4].concat(
      Array.from({ length: 15 }, (_, index) => index * 4), [24, 4],
      Array.from({ length: 6 }, (_, index) => index * 4),
    ));
    const runtimeBytes = await readFile(new URL('../../../lib/binding_web/web-tree-sitter.wasm', import.meta.url));
    const runtime = new WebAssembly.Module(runtimeBytes);
    expect(WebAssembly.Module.exports(runtime).some((entry) => entry.name.startsWith('scope_compat_'))).toBe(false);
  });

  it('stays outside generic parser package and native build inputs', async () => {
    for (const path of ['lib/Cargo.toml', 'lib/binding_web/package.json', 'CMakeLists.txt', 'Makefile', 'build.zig']) {
      const source = await readFile(resolve(repositoryRoot, path), 'utf8');
      expect(source).not.toContain('scope-compat');
      if (path !== 'lib/binding_web/package.json') expect(source).toMatch(/(?:lib\/)?src\//);
    }
    const generated = record(JSON.parse(await readFile(resolve(repositoryRoot, 'test/highlight-compat/generated-inputs.json'), 'utf8')));
    if (!Array.isArray(generated.inputs)) throw new Error('Missing generated inputs');
    for (const path of [componentPath, manifestPath]) {
      expect(generated.inputs.some((entry: unknown) => isRecord(entry) && entry.path === `../../${path}` && entry.command === 'cargo xtask build-scope-compat')).toBe(true);
    }
  });

  it('checks complete required inputs, additions, deletions, headers, SDK, exports and bytes', async () => {
    const bytes = await readFile(resolve(repositoryRoot, componentPath));
    const manifest: unknown = JSON.parse(await readFile(resolve(repositoryRoot, manifestPath), 'utf8'));
    await expect(checkFreshness(bytes, manifest)).resolves.toBeUndefined();
    await expect(checkFreshness(Uint8Array.from([0]), manifest)).rejects.toThrow('Wasm');
    await scratch(async (root) => {
      const paths = await componentInputs();
      for (const path of paths) {
        await mkdir(resolve(root, path, '..'), { recursive: true });
        await writeFile(resolve(root, path), await readFile(resolve(repositoryRoot, path)));
      }
      const inputs = await Promise.all(paths.map(async (path) => ({ path, sha256: digest(await readFile(resolve(root, path))) })));
      const identity = { abi: 1, compiler: 'test', flags: [], wasm: { size: bytes.length, sha256: digest(bytes) }, inputs };
      expect(sourceIdentity({ ...identity, compiler: '/different/host/compiler', commit: 'unrelated commit' })).toBe(sourceIdentity(identity));
      expect(sourceIdentity({ ...identity, inputs: inputs.concat([{ path: 'extra', sha256: 'changed' }]) })).not.toBe(sourceIdentity(identity));
      await checkFreshness(bytes, identity, root);
      await expect(checkFreshness(bytes, { ...identity, inputs: inputs.slice(1) }, root)).rejects.toThrow('inventory');
      for (const path of ['lib/include/tree_sitter/api.h', 'crates/loader/wasi-sdk-version', 'lib/scope-compat/src/alloc.c', 'lib/binding_web/lib/exports.txt']) {
        const original = await readFile(resolve(root, path));
        await writeFile(resolve(root, path), 'changed');
        await expect(checkFreshness(bytes, identity, root)).rejects.toThrow('Stale');
        await writeFile(resolve(root, path), original);
      }
      const extra = resolve(root, 'lib/scope-compat/src/extra.c');
      await writeFile(extra, 'new input');
      await expect(checkFreshness(bytes, identity, root)).rejects.toThrow('inventory');
      await rm(extra);
      await rm(resolve(root, 'lib/scope-compat/src/alloc.c'));
      await expect(checkFreshness(bytes, identity, root)).rejects.toThrow();
    });
  });
});
