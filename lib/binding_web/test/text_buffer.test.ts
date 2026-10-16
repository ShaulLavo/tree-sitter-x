import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Edit, heap, Language, Parser, Query, TextBuffer, type Tree } from '../src';
import { C } from '../src/constants';
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
      expect(bytes.length).toBeGreaterThan(oldLength);
      expect(buffer.slice()).toBe(source);
      tree = parser.parse(buffer);
      // Keep another allocation above the old one, then exceed its capacity with an edit.
      // Cross decoding chunks without scaling parse work to the runtime heap size.
      const inserted = '/*' + 'é😀'.repeat(4096) + '*/\nconst next = "hé";\n';
      let text = source + inserted;
      buffer.edit(source.length, source.length, inserted);
      expect(buffer[0]).not.toBe(oldAddress);
      expect(bytes.length).toBeGreaterThan(oldLength);
      expect(heap()).toBe(bytes);
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
