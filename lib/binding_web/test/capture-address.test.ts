import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { heap, Language, Parser, Query, TextBuffer, type Tree } from '../src';
import { C, SIZE_OF_INT } from '../src/constants';
import { TRANSFER_BUFFER } from '../src/parser';
import helper, { type LanguageName } from './helper';

const SIGNED_LIMIT = 2 ** 31;
const SENTINEL_BYTES = 8 * 1024 * 1024;
const SENTINEL_MARGIN = 1024 * 1024;
const LINES = 500;

const sentinelByte = (offset: number) => (offset * 31 + 7) & 0xff;
// The native address a binding object holds, as an unsigned number.
const handle = (object: object, slot = 0) => (object as unknown as Record<number, number>)[slot] >>> 0;

describe('memory above the signed Wasm32 boundary', () => {
  let JavaScript: Language;
  let languageURL: (name: LanguageName) => string;
  let sentinel = 0;
  let high = 0;
  const allocations: number[] = [];
  // Made below 2 GiB, so decoding their query results depends only on the results' addresses.
  let lowParser: Parser;
  let lowTree: Tree;
  let lowQuery: Query;

  beforeAll(async () => {
    ({ JavaScript, languageURL } = await helper);
    lowParser = new Parser();
    lowParser.setLanguage(JavaScript);
    lowTree = lowParser.parse('const value = 1;\n'.repeat(LINES))!;
    lowQuery = new Query(JavaScript, '(identifier) @variable');
    sentinel = C._malloc(SENTINEL_BYTES) >>> 0;
    allocations.push(sentinel);
    const bytes = heap();
    for (let offset = 0; offset < SENTINEL_BYTES; offset++) bytes[sentinel + offset] = sentinelByte(offset);

    // A signed address p used as a typed-array offset lands at heap.length + p, about twice the
    // heap's excess over 2 GiB into memory. Ending the heap half the sentinel's address past
    // 2 GiB aims those stray writes at the sentinel. A request no free fragment can serve
    // finds the top of the heap.
    const top = C._malloc(64 * 1024 * 1024) >>> 0;
    C._free(top);
    const end = SIGNED_LIMIT + Math.ceil((sentinel + SENTINEL_MARGIN) / 2);
    // Reserve native address space without constructing a multi-gigabyte string.
    const big = C._malloc(end - top) >>> 0;
    expect(big).toBe(top);
    allocations.push(big);
    high = end - 64;

    expect(heap().length).toBeGreaterThan(SIGNED_LIMIT);
    const firstStray = heap().length + end - 2 ** 32;
    expect(firstStray).toBeGreaterThanOrEqual(sentinel);
    expect(firstStray).toBeLessThan(sentinel + SENTINEL_BYTES / 2);
  });

  afterAll(() => {
    for (const address of allocations) C._free(address);
    lowQuery.delete();
    lowTree.delete();
    lowParser.delete();
  });

  it('reads and writes strings through signed and unsigned addresses', () => {
    for (const address of [high | 0, high >>> 0]) {
      expect(C.stringToUTF8('héllo', address, 32)).toBe(6);
      expect(C.UTF8ToString(high | 0)).toBe('héllo');
      expect(C.UTF8ToString(high >>> 0)).toBe('héllo');
      expect(C.UTF8ToString(address, 3)).toBe('hé');
      expect(C.UTF8ToString(address, 3, true)).toBe('hé');
      expect(C.AsciiToString(address)).toBe('h\xc3\xa9llo');

      expect(C.stringToUTF16('hé', address, 32)).toBe(4);
      expect(C.getValue(high, 'i16')).toBe(0x68);
      expect(C.getValue(high + 2, 'i16')).toBe(0xe9);
      expect(C.getValue(high + 4, 'i16')).toBe(0);
    }
  });

  it('creates queries, parsers, text buffers and languages', async () => {
    const query = new Query(JavaScript, `(identifier) @variable ((string) @text (#eq? @text "'x'"))`);
    expect(handle(query)).toBeGreaterThanOrEqual(SIGNED_LIMIT);
    expect(query.captureNames).toEqual(['variable', 'text']);
    query.disableCapture('variable');
    // The error offset is decoded from the UTF-8 source the query was compiled from.
    const invalid = '((identifier) @v (#eq? @v "é")) (';
    expect(() => new Query(JavaScript, invalid)).toThrow(`Bad syntax at offset ${invalid.length}`);

    const parser = new Parser();
    expect(handle(parser, 1)).toBeGreaterThanOrEqual(SIGNED_LIMIT);
    const messages: string[] = [];
    parser.setLanguage(JavaScript);
    parser.setLogger((message) => messages.push(message));
    const tree = parser.parse("let a = 'x', b = 'y';")!;
    parser.setLogger(null);
    expect(messages).toContain('done');
    expect(tree.rootNode.toString()).toBe(
      '(program (lexical_declaration ' +
      '(variable_declarator name: (identifier) value: (string (string_fragment))) ' +
      '(variable_declarator name: (identifier) value: (string (string_fragment)))))',
    );
    const declarator = tree.rootNode.firstChild!.firstNamedChild!;
    expect(declarator.fieldNameForChild(0)).toBe('name');
    expect(declarator.fieldNameForNamedChild(1)).toBe('value');
    expect(query.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([['text', "'x'"]]);
    expect(JavaScript.idForNodeType('identifier', true)).toBe(JavaScript.types.indexOf('identifier'));

    const buffer = new TextBuffer('hello world');
    expect(handle(buffer)).toBeGreaterThanOrEqual(SIGNED_LIMIT);
    buffer.edit(5, 5, ', wide'.repeat(100));
    buffer.edit(0, 5, 'const x = 1; //');
    expect(buffer.slice(0, 21)).toBe('const x = 1; //, wide');
    const bufferTree = parser.parse(buffer)!;
    expect(bufferTree.rootNode.firstChild!.type).toBe('lexical_declaration');

    const json = await Language.load(languageURL('json'));
    expect(handle(json)).toBeGreaterThanOrEqual(SIGNED_LIMIT);
    expect(json.types).toContain('object');
    expect(json.fields).toContain('key');
    parser.setLanguage(json);
    const jsonTree = parser.parse('{"a": [1, true]}')!;
    expect(jsonTree.rootNode.toString()).toBe(
      '(document (object (pair key: (string (string_content)) value: (array (number) (true)))))',
    );

    jsonTree.delete();
    bufferTree.delete();
    buffer.delete();
    tree.delete();
    parser.delete();
    query.delete();
  });

  it('leaves memory allocated before the growth unchanged', () => {
    const bytes = heap();
    let changed = -1;
    for (let offset = 0; offset < SENTINEL_BYTES; offset++) {
      if (bytes[sentinel + offset] !== sentinelByte(offset)) {
        changed = offset;
        break;
      }
    }
    expect(changed).toBe(-1);
  });

  it('decodes query results and accesses scalars', () => {
    // The address of the last result block, which the query reads its counts from.
    const resultAddress = () => C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, 'i32') >>> 0;
    expect(lowQuery.captures(lowTree.rootNode)).toHaveLength(LINES);
    expect(resultAddress()).toBeGreaterThanOrEqual(SIGNED_LIMIT);
    expect(lowQuery.matches(lowTree.rootNode)).toHaveLength(LINES);
    expect(resultAddress()).toBeGreaterThanOrEqual(SIGNED_LIMIT);

    for (const [type, value] of [
      ['i1', -1], ['i8', -12], ['i16', -1234], ['i32', -123456],
      ['*', -123456], ['i64', -123456], ['float', -1.5], ['double', -1.5],
    ] as const) {
      C.setValue(high | 0, value, type);
      expect(C.getValue(high >>> 0, type)).toBe(value);
      C.setValue(high >>> 0, value + 1, type);
      expect(C.getValue(high | 0, type)).toBe(value + 1);
    }
  });
});
