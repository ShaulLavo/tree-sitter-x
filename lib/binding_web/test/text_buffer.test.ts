import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Edit, heap, Language, Parser, Query, TextBuffer, type Tree } from '../src';
import { C } from '../src/constants';
import { textBufferByteLength } from '../src/text_buffer';
import helper from './helper';

let JavaScript: Language;
let Rust: Language;

beforeAll(async () => {
  ({ JavaScript, Rust } = await helper);
});

function point(text: string, index: number) {
  const before = text.slice(0, index);
  return { row: before.split('\n').length - 1, column: index - (before.lastIndexOf('\n') + 1) };
}

describe('TextBuffer', () => {
  it('bounds UTF-16 lengths before converting them to Wasm32 byte lengths', () => {
    expect(textBufferByteLength(0)).toBe(0);
    expect(textBufferByteLength(0x7fffffff)).toBe(0xfffffffe);
    for (const length of [NaN, Infinity, -Infinity, -1, 0.5, 0x80000000, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => textBufferByteLength(length)).toThrow(RangeError);
    }
  });

  it.each([
    [NaN, 1], [0, NaN], [Infinity, 1], [0, Infinity], [-Infinity, 1],
    [0.5, 1], [0, 1.5], [-1, 1], [2, 1], [0, 5],
    [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
  ])('rejects edit [%s, %s) without changing the buffer', (start, end) => {
    const buffer = new TextBuffer('a😀b');
    const address = buffer[0];
    try {
      expect(() => { buffer.edit(start, end, 'replacement'); }).toThrow(RangeError);
      expect(buffer[0]).toBe(address);
      expect(buffer.length).toBe(4);
      expect(buffer.slice()).toBe('a😀b');
      expect(buffer.read(0)).toBe('a😀b');
    } finally {
      buffer.delete();
    }
  });

  it('allows edits between the code units of a surrogate pair', () => {
    const buffer = new TextBuffer('a😀b');
    try {
      buffer.edit(2, 2, 'x');
      expect(buffer.slice()).toBe('a\ud83dx\ude00b');
      buffer.edit(2, 3, '');
      expect(buffer.slice()).toBe('a😀b');
      buffer.edit(1, 2, '');
      expect(buffer.slice()).toBe('a\ude00b');
    } finally {
      buffer.delete();
    }
  });

  it.each(['set', 'edit'] as const)('preserves the allocation and text when %s cannot grow', (method) => {
    const buffer = new TextBuffer('a😀b');
    const address = buffer[0];
    expect(buffer.read(0)).toBe('a😀b');
    const realloc = vi.spyOn(C, '_realloc').mockReturnValue(0);
    const text = 'x'.repeat(128);
    const write = method === 'set' ? () => { buffer.set(text); } : () => { buffer.edit(0, 0, text); };
    try {
      expect(write).toThrow('Failed to allocate');
      expect(buffer[0]).toBe(address);
      expect(buffer.length).toBe(4);
      expect(buffer.slice()).toBe('a😀b');
      expect(buffer.read(0)).toBe('a😀b');
    } finally {
      realloc.mockRestore();
      buffer.delete();
    }
  });

  it('rebuilds allocation views after realloc and matches a fresh parse across growth', () => {
    const parser = new Parser().setLanguage(JavaScript);
    const source = 'const café = "水😀";\n';
    const buffer = new TextBuffer(source);
    const query = new Query(JavaScript, '(identifier) @name (string) @text');
    const bytes = heap();
    const oldLength = bytes.length;
    const oldAddress = buffer[0];
    const blocker = C._malloc(oldLength * 2);
    let tree: Tree | null = null;
    let fresh: Tree | null = null;
    try {
      expect(blocker).not.toBe(0);
      expect(heap().length).toBeGreaterThan(oldLength);
      expect(buffer.slice()).toBe(source);
      tree = parser.parse(buffer);
      // Keep another allocation above the old one, then exceed its capacity with an edit.
      // Cross decoding chunks without scaling parse work to the runtime heap size.
      const inserted = '/*' + 'é😀'.repeat(4096) + '*/\nconst next = "hé";\n';
      let text = source + inserted;
      buffer.edit(source.length, source.length, inserted);
      expect(buffer[0]).not.toBe(oldAddress);
      expect(heap().length).toBeGreaterThan(oldLength);
      expect(heap() === bytes).toBe(bytes.buffer.resizable);
      tree!.edit(new Edit({
        startIndex: source.length, oldEndIndex: source.length, newEndIndex: text.length,
        startPosition: point(source, source.length), oldEndPosition: point(source, source.length),
        newEndPosition: point(text, text.length),
      }));
      const incremental = parser.parse(buffer, tree)!;
      tree!.delete();
      tree = incremental;
      fresh = parser.parse(text)!;
      expect(tree.rootNode.toString()).toBe(fresh.rootNode.toString());
      expect(tree.rootNode.text).toBe(text);
      expect(query.captureRanges(tree.rootNode)).toEqual(query.captureRanges(fresh.rootNode));
      expect(query.captures(tree.rootNode).map(({ node }) => node.text))
        .toEqual(query.captures(fresh.rootNode).map(({ node }) => node.text));

      text = text.slice(source.length);
      buffer.edit(0, source.length, '');
      tree.edit(new Edit({
        startIndex: 0, oldEndIndex: source.length, newEndIndex: 0,
        startPosition: point(source, 0), oldEndPosition: point(source, source.length),
        newEndPosition: point(text, 0),
      }));
      const deleted = parser.parse(buffer, tree)!;
      tree.delete();
      tree = deleted;
      fresh.delete();
      fresh = parser.parse(text)!;
      expect(buffer.slice()).toBe(text);
      expect(tree.rootNode.toString()).toBe(fresh.rootNode.toString());
      expect(query.captureRanges(tree.rootNode)).toEqual(query.captureRanges(fresh.rootNode));
      expect(tree.rootNode.text).toBe(text);
    } finally {
      fresh?.delete();
      tree?.delete();
      query.delete();
      buffer.delete();
      C._free(blocker);
      parser.delete();
    }
  });

  it('keeps text through edits, growth and surrogate pairs', () => {
    const buffer = new TextBuffer('héllo 😀 world');
    let text = 'héllo 😀 world';
    let seed = 3;
    for (let step = 0; step < 500; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const start = seed % (text.length + 1);
      const end = Math.min(text.length, start + (seed >>> 8) % 5);
      const inserted = ['', 'x', '😀', 'long inserted text '.repeat(1 + (step % 7)), '\n'][(seed >>> 4) % 5];
      buffer.edit(start, end, inserted);
      text = text.slice(0, start) + inserted + text.slice(end);
      expect(buffer.length).toBe(text.length);
    }
    expect(buffer.slice()).toBe(text);
    expect(buffer.slice(3, 40)).toBe(text.slice(3, 40));
    expect(() => { buffer.edit(0, text.length + 1, ''); }).toThrow(RangeError);
    buffer.delete();
  });

  it('parses in place with the same trees as a string, before and after edits', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/parser.ts'), 'utf8');
    for (const [language, input] of [[JavaScript, source], [Rust, 'fn main() { let x = 1; }\n'.repeat(200)]] as const) {
      const parser = new Parser();
      parser.setLanguage(language);
      const buffer = new TextBuffer(input);
      let text = input;
      let fromBuffer = parser.parse(buffer)!;
      let fromString = parser.parse(text)!;
      expect(fromBuffer.rootNode.toString()).toBe(fromString.rootNode.toString());
      expect(fromBuffer.rootNode.child(0)!.text).toBe(fromString.rootNode.child(0)!.text);

      let seed = 11;
      for (let step = 0; step < 50; step++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const start = seed % (text.length + 1);
        const oldEnd = Math.min(text.length, start + (seed >>> 8) % 3);
        const inserted = ['x', '(', '\n', '', '"'][(seed >>> 4) % 5];
        const next = text.slice(0, start) + inserted + text.slice(oldEnd);
        const edit = new Edit({
          startIndex: start,
          oldEndIndex: oldEnd,
          newEndIndex: start + inserted.length,
          startPosition: point(text, start),
          oldEndPosition: point(text, oldEnd),
          newEndPosition: point(next, start + inserted.length),
        });
        buffer.edit(start, oldEnd, inserted);
        text = next;
        fromBuffer.edit(edit);
        fromString.edit(edit);
        const nextBuffer = parser.parse(buffer, fromBuffer)!;
        const nextString = parser.parse(text, fromString)!;
        expect(nextBuffer.rootNode.toString()).toBe(nextString.rootNode.toString());
        fromBuffer.delete();
        fromString.delete();
        fromBuffer = nextBuffer;
        fromString = nextString;
      }
      expect(buffer.slice()).toBe(text);
      fromBuffer.delete();
      fromString.delete();
      buffer.delete();
      parser.delete();
    }
  });
});
