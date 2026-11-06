import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const web = fileURLToPath(new URL('..', import.meta.url));
const old = new Date('2020-01-01');
const manifest: unknown = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8'));
assert(manifest && typeof manifest === 'object' && 'files' in manifest);
assert(Array.isArray(manifest.files));
const artifacts = manifest.files.map((file: unknown) => {
  assert(typeof file === 'string');
  return file;
});

let scratch: string;
beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), 'tree-sitter-package-scripts-')); });
afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

function run(script: string, cwd: string) {
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 20_000 });
}

describe('web bundle subprocess', () => {
  it('fails when the real bundler cannot resolve its entry point', () => {
    const result = run(join(web, 'script/build.js'), scratch);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toContain('Could not resolve "src/index.ts"');
    expect(result.status).toBe(1);
  });

  it('preserves the copy error when the runtime Wasm is missing', () => {
    mkdirSync(join(scratch, 'src'));
    writeFileSync(join(scratch, 'src/index.ts'), 'export const value = 1;');
    const result = run(join(web, 'script/build.js'), scratch);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toContain('ENOENT');
    expect(result.stderr).toContain('lib/web-tree-sitter.wasm');
    expect(result.status).toBe(1);
  });
});

function setTime(file: string, time: Date) {
  utimesSync(file, time, time);
}

function fixture() {
  const pkg = join(scratch, 'lib/binding_web');
  for (const relative of ['src', 'script', 'tsconfig.json', 'package.json', 'package-lock.json', 'lib/tree-sitter.c', 'lib/exports.txt', 'lib/extra-exports.txt', '../src', '../include', '../../crates/xtask/src/build_wasm.rs', '../../crates/loader/wasi-sdk-version', '../../crates/loader/binaryen-version']) {
    const target = join(pkg, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(web, relative), target, { recursive: true });
  }
  for (const artifact of artifacts) {
    const target = join(pkg, artifact);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'artifact');
    setTime(target, new Date(Date.now() + 60_000));
  }
  return pkg;
}

function check(pkg: string) {
  return run(join(pkg, 'script/check-artifacts-fresh.ts'), pkg);
}

describe('package freshness', () => {
  it('accepts fresh artifacts', () => {
    const pkg = fixture();
    expect(check(pkg).status).toBe(0);
  });

  it.each(artifacts)('rejects the missing advertised artifact %s', artifact => {
    const pkg = fixture();
    rmSync(join(pkg, artifact));
    expect(check(pkg).status).not.toBe(0);
  });

  it.each(artifacts)('rejects the stale advertised artifact %s', artifact => {
    const pkg = fixture();
    setTime(join(pkg, artifact), old);
    expect(check(pkg).status).not.toBe(0);
  });

  it.each(['../src/wasm-stdlib/libc/string/strcmp.c', 'src/nested/input.ts', '../include/tree_sitter/nested/input.h'])('rejects changed nested input %s', inputPath => {
    const pkg = fixture();
    const input = join(pkg, inputPath);
    mkdirSync(dirname(input), { recursive: true });
    writeFileSync(input, 'changed input');
    setTime(input, new Date(Date.now() + 120_000));
    expect(check(pkg).status).not.toBe(0);
  });

  it('rejects a missing required source directory', () => {
    const pkg = fixture();
    rmSync(join(pkg, '../include'), { recursive: true });
    expect(check(pkg).status).not.toBe(0);
  });
});
