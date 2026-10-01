import { expect, it } from 'vitest';
import { heap, Parser, Query } from '../src';
import { C } from '../src/constants';
import helper from './helper';

it('decodes query results and accesses memory above the signed Wasm32 boundary', async () => {
  const { JavaScript } = await helper;
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  const tree = parser.parse('const value = 1;\n'.repeat(50_000))!;
  const query = new Query(JavaScript, '(identifier) @variable');
  const allocations: number[] = [];
  try {
    for (let index = 0; index < 3; index++) {
      // Reserve native address space without constructing a multi-gigabyte string.
      const address = C._malloc(800_000_000);
      allocations.push(address);
      expect(address).not.toBe(0);
    }
    expect(heap().length).toBeGreaterThan(2 ** 31);
    expect(query.captures(tree.rootNode)).toHaveLength(50_000);
    expect(query.matches(tree.rootNode)).toHaveLength(50_000);

    const address = (allocations[2] + 799_999_936) >>> 0;
    expect(address >>> 0).toBeGreaterThanOrEqual(2 ** 31);
    for (const [type, value] of [
      ['i1', -1], ['i8', -12], ['i16', -1234], ['i32', -123456],
      ['*', -123456], ['i64', -123456], ['float', -1.5], ['double', -1.5],
    ] as const) {
      C.setValue(address | 0, value, type);
      expect(C.getValue(address >>> 0, type)).toBe(value);
      C.setValue(address >>> 0, value + 1, type);
      expect(C.getValue(address | 0, type)).toBe(value + 1);
    }
  } finally {
    for (const address of allocations) C._free(address);
    query.delete();
    tree.delete();
    parser.delete();
  }
}, 120_000);
