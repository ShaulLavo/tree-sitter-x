import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Parser, type Language, type Tree } from '../src';
import helper from './helper';

describe('TreeCursor', () => {
  let language: Language;
  let parser: Parser;
  let tree: Tree | null;

  beforeAll(async () => {
    ({ JavaScript: language } = await helper);
  });

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(language);
    tree = null;
  });

  afterEach(() => {
    tree?.delete();
    parser.delete();
  });

  it('walks sibling declarations without a goal', () => {
    tree = parser.parse('a;b;')!;
    const cursor = tree.walk();
    try {
      expect(cursor.gotoFirstChild()).toBe(true);
      expect(cursor.currentNode.id).toBe(tree.rootNode.child(0)!.id);
      expect(cursor.gotoNextSibling()).toBe(true);
      expect(cursor.currentNode.id).toBe(tree.rootNode.child(1)!.id);
    } finally {
      cursor.delete();
    }
  });

  for (const method of ['gotoFirstChildForIndex', 'gotoFirstChildForPosition'] as const) {
    describe(`.${method}`, () => {
      it.each([
        { source: 'a;b;', index: 0, position: { row: 0, column: 0 }, child: 0 },
        { source: 'a;b;', index: 2, position: { row: 0, column: 2 }, child: 1 },
        { source: 'a;b;c;', index: 5, position: { row: 0, column: 5 }, child: 2 },
        { source: 'a;  b;', index: 3, position: { row: 0, column: 3 }, child: 1 },
        { source: 'a;\nb;', index: 3, position: { row: 1, column: 0 }, child: 1 },
        { source: '"😀";é;', index: 6, position: { row: 0, column: 6 }, child: 1 },
      ])('finds child $child at index $index in $source', ({ source, index, position, child }) => {
        tree = parser.parse(source)!;
        const cursor = tree.walk();
        try {
          const moved = method === 'gotoFirstChildForIndex'
            ? cursor.gotoFirstChildForIndex(index)
            : cursor.gotoFirstChildForPosition(position);
          expect(moved).toBe(true);
          expect(cursor.currentNode.id).toBe(tree.rootNode.child(child)!.id);
          expect(cursor.currentDepth).toBe(1);
        } finally {
          cursor.delete();
        }
      });

      it.each([4, 5])('leaves the cursor at its parent when index %i is past the children', (index) => {
        tree = parser.parse('a;b;')!;
        const cursor = tree.walk();
        try {
          const moved = method === 'gotoFirstChildForIndex'
            ? cursor.gotoFirstChildForIndex(index)
            : cursor.gotoFirstChildForPosition({ row: 0, column: index });
          expect(moved).toBe(false);
          expect(cursor.currentNode.id).toBe(tree.rootNode.id);
        } finally {
          cursor.delete();
        }
      });

      it('uses document-relative offsets below the root', () => {
        tree = parser.parse('a; { b; c; }')!;
        const block = tree.rootNode.child(1)!;
        const cursor = tree.walk();
        try {
          expect(cursor.gotoLastChild()).toBe(true);
          const moved = method === 'gotoFirstChildForIndex'
            ? cursor.gotoFirstChildForIndex(8)
            : cursor.gotoFirstChildForPosition({ row: 0, column: 8 });
          expect(moved).toBe(true);
          expect(cursor.currentNode.id).toBe(block.child(2)!.id);
          expect(cursor.currentDepth).toBe(2);
        } finally {
          cursor.delete();
        }
      });

      it('returns false and stays on a leaf', () => {
        tree = parser.parse('a;')!;
        const leaf = tree.rootNode.firstChild!.firstChild!;
        const cursor = leaf.walk();
        try {
          const moved = method === 'gotoFirstChildForIndex'
            ? cursor.gotoFirstChildForIndex(0)
            : cursor.gotoFirstChildForPosition({ row: 0, column: 0 });
          expect(moved).toBe(false);
          expect(cursor.currentNode.id).toBe(leaf.id);
        } finally {
          cursor.delete();
        }
      });
    });
  }
});
