import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Language, Parser, Query, type Tree } from '../src';
import helper from './helper';

let JavaScript: Language;
const dispose: (() => void)[] = [];

beforeAll(async () => {
  ({ JavaScript } = await helper);
});
afterEach(() => {
  for (const release of dispose.splice(0).reverse()) release();
});

function parse(source: string, chunkLength = Infinity) {
  const reads: { start: number; end: number | undefined; units: number }[] = [];
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  dispose.push(() => { parser.delete(); });
  const tree = parser.parse((start, _point, end?: number) => {
    const text = source.slice(start, Math.min(end ?? source.length, start + chunkLength));
    reads.push({ start, end, units: text.length });
    return text;
  })!;
  dispose.push(() => { tree.delete(); });
  reads.length = 0;
  return { tree, reads };
}

function query(source: string) {
  const result = new Query(JavaScript, source);
  dispose.push(() => { result.delete(); });
  return result;
}

function identifier(tree: Tree) {
  return query('(identifier) @name').captures(tree.rootNode)[0].node;
}

describe('bounded predicate source reads', () => {
  it.each([Infinity, 2])('requests only the node range with chunk size %s', (chunkLength) => {
    const { tree, reads } = parse('let alpha = 123456789;', chunkLength);
    const node = identifier(tree);
    expect(node.text).toBe('alpha');
    expect(reads[0]).toEqual({ start: node.startIndex, end: node.endIndex, units: Math.min(5, chunkLength) });
    expect(reads.reduce((sum, read) => sum + read.units, 0)).toBe(5);
    expect(reads.every((read) => read.end === node.endIndex)).toBe(true);
  });

  it('preserves exact Unicode node text', () => {
    const { tree, reads } = parse('const 名前 = "🎉";');
    const node = identifier(tree);
    expect(node.text).toBe('名前');
    expect(reads).toEqual([{ start: node.startIndex, end: node.endIndex, units: 2 }]);
  });
});

describe('query-local predicate text reuse', () => {
  it.each(['matches', 'captures'] as const)('reads each node once during %s and releases the cache after the call', (method) => {
    const { tree, reads } = parse('let alpha = 123;');
    const predicates = query(`
      ((identifier) @equal (#eq? @equal "alpha"))
      ((identifier) @regex (#match? @regex "^a"))
      ((identifier) @member (#any-of? @member "alpha"))
    `);
    expect(predicates[method](tree.rootNode)).toHaveLength(3);
    expect(reads).toHaveLength(1);
    expect(reads[0].units).toBe(5);
    expect(predicates[method](tree.rootNode)).toHaveLength(3);
    expect(reads).toHaveLength(2);
    const other = parse('let beta = 123;');
    expect(predicates[method](other.tree.rootNode)).toHaveLength(0);
    expect(other.reads).toHaveLength(1);
    expect(other.reads[0].units).toBe(4);
  });
});
