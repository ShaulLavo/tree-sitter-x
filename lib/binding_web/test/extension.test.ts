import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { Parser, Language, loadExtension, type Tree } from '../src';
import helper from './helper';

const clang = path.join(process.env.WASI_SDK ?? path.join(process.env.HOME ?? '', '.cache/tree-sitter/wasi-sdk'), 'bin/clang');

// Builds test/fixtures/extension.c the way the tree-sitter CLI builds a grammar.
function buildExtension(): Uint8Array {
  const output = path.join(mkdtempSync(path.join(tmpdir(), 'ts-extension-')), 'extension.wasm');
  execFileSync(clang, [
    '--target=wasm32-wasip1', '-fPIC', '-shared', '-nostdlib', '-O2', '-fvisibility=hidden',
    '-I', path.join(process.cwd(), '../include'),
    path.join(process.cwd(), 'test/fixtures/extension.c'),
    '-Wl,--allow-undefined', '-Wl,--no-entry', '-o', output,
  ]);
  return readFileSync(output);
}

let JavaScript: Language;

beforeAll(async () => {
  ({ JavaScript } = await helper);
});

describe.skipIf(!existsSync(clang))('loadExtension', () => {
  it('runs C code on a tree in the same memory', async () => {
    const extension = await loadExtension(buildExtension());
    const countNamed = extension.count_named as (tree: number) => number;
    const rootTypeLength = extension.root_type_length as (tree: number) => number;

    const parser = new Parser();
    parser.setLanguage(JavaScript);
    const tree: Tree = parser.parse('let a = [1, 2, { b: c }];')!;
    let expected = 0;
    const cursor = tree.walk();
    for (;;) {
      if (cursor.nodeIsNamed) expected++;
      if (cursor.gotoFirstChild()) continue;
      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) break;
      }
      if (cursor.currentDepth === 0 && !cursor.gotoNextSibling()) break;
    }
    cursor.delete();

    expect(countNamed(tree[0])).toBe(expected);
    expect(rootTypeLength(tree[0])).toBe('program'.length);
    tree.delete();
    parser.delete();
  });
});
