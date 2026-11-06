import { describe, it, expect, beforeAll } from 'vitest';
import { Parser, Language, TextBuffer, loadExtension, heap, type Tree, type Node } from '../src';
import { readFile } from 'fs/promises';
import helper from './helper';

import { buildFixture, sideFixture } from './wasm-fixtures';
import { C } from '../src/constants';

let JavaScript: Language;

beforeAll(async () => {
  ({ JavaScript } = await helper);
});

function countNamedNodes(node: Node): number {
  return 1 + node.namedChildren.reduce((count, child) => count + countNamedNodes(child), 0);
}

describe('loadExtension', () => {
  it.each(['async language', 'sync language', 'extension'] as const)('recovers genuine parser and extension work after failed %s links', async (entry) => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    const source = 'const text = "hé 😀";';
    const buffer = new TextBuffer(source);
    const tree = parser.parse(buffer)!;
    const fixture = buildFixture('extension');
    const existing = await loadExtension(fixture);
    const countNamed = existing.count_named as (tree: number) => number;
    const releaseExisting = existing.release_fixture as () => void;
    try {
      for (const trap of ['start', 'relocation', 'constructor'] as const) {
        const binary = sideFixture({ trap, functionGot: 'value', memoryGot: 'data', tableAlign: 3 });
        if (entry === 'sync language') expect(() => Language.loadSync(new WebAssembly.Module(binary))).toThrow(WebAssembly.RuntimeError);
        else await expect(entry === 'async language' ? Language.load(binary) : loadExtension(binary)).rejects.toBeInstanceOf(WebAssembly.RuntimeError);
        expect(countNamed(tree[0])).toBe(countNamedNodes(tree.rootNode));
        expect(tree.rootNode.text).toBe(source);
      }
      const { languageURL } = await helper;
      const binary = await readFile(languageURL('javascript'));
      const language = entry === 'sync language' ? Language.loadSync(new WebAssembly.Module(binary)) : await Language.load(binary);
      parser.setLanguage(language);
      const recovered = parser.parse(buffer)!;
      const extension = await loadExtension(fixture);
      const count = extension.count_named as (tree: number) => number;
      const release = extension.release_fixture as () => void;
      try {
        expect(recovered.rootNode.text).toBe(source);
        expect(recovered.rootNode.hasError).toBe(false);
        expect(count(recovered[0])).toBe(countNamedNodes(recovered.rootNode));
        expect(countNamed(tree[0])).toBe(countNamedNodes(tree.rootNode));
      } finally {
        release();
        recovered.delete();
      }
    } finally {
      releaseExisting();
      tree.delete();
      buffer.delete();
      parser.delete();
    }
  });

  it('runs C code on a tree in the same memory', async () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    const tree: Tree = parser.parse('let a = [1, 2, { b: c }];')!;
    const bytes = heap();
    const oldLength = bytes.length;
    const allocation = C._malloc(oldLength * 2);
    const afterAllocation = heap().length;
    const extension = await loadExtension(buildFixture('extension'));
    const countNamed = extension.count_named as (tree: number) => number;
    const rootTypeLength = extension.root_type_length as (tree: number) => number;
    const constructorText = extension.constructor_text as () => number;
    const releaseFixture = extension.release_fixture as () => void;
    try {
      expect(heap() === bytes).toBe(bytes.buffer.resizable);
      expect(heap().length).toBeGreaterThan(oldLength);
      expect(heap().length).toBeGreaterThan(afterAllocation);
      expect(C.UTF8ToString(constructorText())).toBe('extension hé 😀');
      expect(countNamed(tree[0])).toBe(countNamedNodes(tree.rootNode));
      expect(rootTypeLength(tree[0])).toBe('program'.length);
      expect(tree.rootNode.text).toBe('let a = [1, 2, { b: c }];');
    } finally {
      releaseFixture();
      C._free(allocation);
      tree.delete();
      parser.delete();
    }
  });
});
