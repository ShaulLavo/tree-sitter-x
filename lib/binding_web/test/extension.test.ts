import { describe, it, expect, beforeAll } from 'vitest';
import { Parser, Language, loadExtension, heap, type Tree, type Node } from '../src';
import helper from './helper';

import { buildFixture } from './wasm-fixtures';
import { C } from '../src/constants';

let JavaScript: Language;

beforeAll(async () => {
  ({ JavaScript } = await helper);
});

function countNamedNodes(node: Node): number {
  return 1 + node.namedChildren.reduce((count, child) => count + countNamedNodes(child), 0);
}

describe('loadExtension', () => {
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
