import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { heap, Language, Parser, Query, type Tree } from '../src';
import { C } from '../src/constants';
import helper from './helper';

let JavaScript: Language;
const allocations: number[] = [];

beforeAll(async () => {
  ({ JavaScript } = await helper);
});

afterEach(() => {
  for (const allocation of allocations) C._free(allocation);
  allocations.length = 0;
});

function grow() {
  const bytes = heap();
  const length = bytes.length;
  const allocation = C._malloc(length + 65536);
  allocations.push(allocation);
  expect(allocation).not.toBe(0);
  expect(heap().length).toBeGreaterThan(length);
  expect(heap() === bytes).toBe(bytes.buffer.resizable);
}

describe('callbacks across heap growth', () => {
  it('copies UTF-16 chunks and decodes log messages after callbacks grow memory', () => {
    const parser = new Parser().setLanguage(JavaScript);
    const source = 'const café = "水😀";\n'.repeat(2000);
    const messages: string[] = [];
    let grewInput = false;
    let grewLog = false;
    let grewProgress = false;
    const bytes = heap();
    let tree: Tree | null = null;
    let fresh: Tree | null = null;
    try {
      parser.setLogger(message => {
        messages.push(message);
        if (grewLog) return;
        grewLog = true;
        grow();
      });
      tree = parser.parse(index => {
        if (!grewInput) {
          grewInput = true;
          grow();
        }
        // Small Unicode reads and larger reads exercise both sides of staging boundaries.
        const count = index < 100 ? ((source.codePointAt(index) ?? 0) > 0xffff ? 2 : 1) : 6000;
        return source.slice(index, index + count);
      }, null, { progressCallback: () => {
        if (grewProgress) return false;
        grewProgress = true;
        grow();
        return false;
      } });
      expect([grewInput, grewLog, grewProgress]).toEqual([true, true, true]);
      expect(heap() === bytes).toBe(bytes.buffer.resizable);
      expect(messages).toContain('done');
      parser.setLogger(null);
      fresh = parser.parse(source)!;
      expect(tree!.rootNode.toString()).toBe(fresh.rootNode.toString());
      expect(tree!.rootNode.text).toBe(source);
      expect(tree!.rootNode.hasError).toBe(false);
      const retained = tree!.rootNode.firstChild!.text;
      grow();
      expect(retained).toBe('const café = "水😀";');
    } finally {
      tree?.delete();
      fresh?.delete();
      parser.delete();
    }
  });

  it('restores callbacks around nested parses and callback exceptions', () => {
    const outer = new Parser().setLanguage(JavaScript);
    const inner = new Parser().setLanguage(JavaScript);
    const source = 'const outer = "😀";\n'.repeat(400);
    const messages: string[] = [];
    let nested = false;
    let tree: Tree | null = null;
    try {
      outer.setLogger(message => messages.push(message));
      tree = outer.parse(index => {
        if (!nested) {
          nested = true;
          const inside = inner.parse('let nested = "水😀";')!;
          expect(inside.rootNode.text).toBe('let nested = "水😀";');
          inside.delete();
          grow();
        }
        return source.slice(index, index + 7000);
      });
      expect(tree!.rootNode.text).toBe(source);
      expect(tree!.rootNode.hasError).toBe(false);
      expect(messages).toContain('done');
      expect(C.currentParseCallback).toBeNull();
      expect(() => inner.parse(() => { throw new Error('callback failed'); })).toThrow('callback failed');
      expect(C.currentParseCallback).toBeNull();
      expect(C.currentLogCallback).toBeNull();
      expect(C.currentProgressCallback).toBeNull();
      inner.reset();
      const recovered = inner.parse('let recovered = 1;')!;
      expect(recovered.rootNode.hasError).toBe(false);
      recovered.delete();
    } finally {
      tree?.delete();
      inner.delete();
      outer.delete();
    }
  });

  it('cancels parsing and querying after progress callbacks grow memory', () => {
    const parser = new Parser().setLanguage(JavaScript);
    const source = 'const value = "hé水😀";\n'.repeat(2000);
    const query = new Query(JavaScript, '(identifier) @name');
    let tree: Tree | null = null;
    let cancelled = false;
    let queryCancelled = false;
    try {
      expect(parser.parse(source, null, { progressCallback: () => {
        grow();
        cancelled = true;
        return true;
      } })).toBeNull();
      expect(cancelled).toBe(true);
      parser.reset();
      tree = parser.parse(source)!;
      query.captureRanges(tree.rootNode, { progressCallback: () => {
        grow();
        queryCancelled = true;
        return true;
      } });
      expect(queryCancelled).toBe(true);
      expect(query.captureRanges(tree.rootNode)).toHaveLength(2000);
      expect(tree.rootNode.text).toBe(source);
    } finally {
      tree?.delete();
      query.delete();
      parser.delete();
    }
  });
});
