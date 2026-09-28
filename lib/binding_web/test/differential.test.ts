import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import * as ours from '../src';
// @ts-expect-error: the published declaration file is a global script, not a module.
import * as upstreamModule from 'web-tree-sitter-upstream';

// The published package exposes the same API; its types do not resolve under this tsconfig.
const upstream = upstreamModule as unknown as typeof ours;

// Parses every fixture grammar's corpus with this build and with the published
// Emscripten build of web-tree-sitter, and requires identical trees, identical
// trees and changed ranges after seeded edits, and identical highlight captures.

const root = path.join(process.cwd(), '../..');
const grammarDir = (dir: string) => path.join(root, 'test/fixtures/grammars', dir);

// Grammar name, and the fixture repository holding its corpus and queries.
const GRAMMARS: [name: string, repository: string][] = [
  ['bash', 'bash'],
  ['c', 'c'],
  ['cpp', 'cpp'],
  ['embedded-template', 'embedded-template'],
  ['go', 'go'],
  ['html', 'html'],
  ['java', 'java'],
  ['javascript', 'javascript'],
  ['jsdoc', 'jsdoc'],
  ['json', 'json'],
  ['php', 'php'],
  ['python', 'python'],
  ['ruby', 'ruby'],
  ['rust', 'rust'],
  ['typescript', 'typescript'],
  ['tsx', 'typescript'],
];

// The input of each example in a corpus file: after the `===` header, before `---`.
function corpusInputs(dir: string): string[] {
  const corpus = path.join(dir, 'test/corpus');
  if (!existsSync(corpus)) return [];
  const inputs: string[] = [];
  for (const file of readdirSync(corpus).filter((f) => f.endsWith('.txt')).sort()) {
    const lines = readFileSync(path.join(corpus, file), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^={3,}/.test(lines[i]) || !/^={3,}/.test(lines[i + 2] ?? '')) continue;
      const start = i + 3;
      let end = start;
      while (end < lines.length && !/^-{3,}\s*$/.test(lines[end])) end++;
      inputs.push(lines.slice(start, end).join('\n'));
      i = end;
    }
  }
  return inputs;
}

function captureList(captures: { name: string; node: { startIndex: number; endIndex: number } }[]) {
  return captures.map((c) => `${c.name}@${c.node.startIndex}-${c.node.endIndex}`);
}

function rangeList(ranges: { startIndex: number; endIndex: number }[]) {
  return ranges.map((r) => `${r.startIndex}-${r.endIndex}`);
}

beforeAll(async () => {
  await ours.Parser.init();
  await upstream.Parser.init();
});

describe('differential against upstream web-tree-sitter', () => {
  for (const [name, repository] of GRAMMARS) {
    it(name, async () => {
      const bytes = readFileSync(path.join(root, `target/release/tree-sitter-${name}.wasm`));
      const oursLanguage = await ours.Language.load(bytes);
      const upstreamLanguage = await upstream.Language.load(bytes);
      const oursParser = new ours.Parser();
      const upstreamParser = new upstream.Parser();
      oursParser.setLanguage(oursLanguage);
      upstreamParser.setLanguage(upstreamLanguage);

      const highlightsPath = path.join(grammarDir(repository), 'queries/highlights.scm');
      const source = existsSync(highlightsPath) ? readFileSync(highlightsPath, 'utf8') : null;
      const compile = <Q>(make: () => Q): Q | string => {
        try { return make(); } catch (error) { return (error as Error).message; }
      };
      const oursQuery = source && compile(() => new ours.Query(oursLanguage, source));
      const upstreamQuery = source && compile(() => new upstream.Query(upstreamLanguage, source));
      expect(typeof oursQuery).toBe(typeof upstreamQuery);

      const inputs = corpusInputs(grammarDir(repository));
      expect(inputs.length).toBeGreaterThan(0);
      let seed = 1;
      const random = (n: number) => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;

      for (const input of inputs) {
        const a = oursParser.parse(input)!;
        const b = upstreamParser.parse(input)!;
        expect(a.rootNode.toString()).toBe(b.rootNode.toString());
        if (oursQuery && typeof oursQuery !== 'string' && upstreamQuery && typeof upstreamQuery !== 'string') {
          expect(captureList(oursQuery.captures(a.rootNode))).toEqual(captureList(upstreamQuery.captures(b.rootNode)));
        }

        // Seeded edits: incremental trees and changed ranges must agree too.
        let text = input;
        let oldA = a;
        let oldB = b;
        for (let step = 0; step < 4; step++) {
          const start = random(text.length + 1);
          const oldEnd = Math.min(text.length, start + random(4));
          const inserted = ['x', '\n', '(', ' ', '"', ''][random(6)];
          const next = text.slice(0, start) + inserted + text.slice(oldEnd);
          const point = (s: string, at: number) => {
            const before = s.slice(0, at);
            const row = before.split('\n').length - 1;
            return { row, column: at - (before.lastIndexOf('\n') + 1) };
          };
          const edit = new ours.Edit({
            startIndex: start,
            oldEndIndex: oldEnd,
            newEndIndex: start + inserted.length,
            startPosition: point(text, start),
            oldEndPosition: point(text, oldEnd),
            newEndPosition: point(next, start + inserted.length),
          });
          oldA.edit(edit);
          oldB.edit(edit);
          const nextA = oursParser.parse(next, oldA)!;
          const nextB = upstreamParser.parse(next, oldB)!;
          expect(nextA.rootNode.toString()).toBe(nextB.rootNode.toString());
          expect(rangeList(oldA.getChangedRanges(nextA))).toEqual(rangeList(oldB.getChangedRanges(nextB)));
          oldA.delete();
          oldB.delete();
          oldA = nextA;
          oldB = nextB;
          text = next;
        }
        oldA.delete();
        oldB.delete();
      }
      oursParser.delete();
      upstreamParser.delete();
    });
  }
});
