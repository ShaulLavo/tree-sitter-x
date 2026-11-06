import { describe, expect, it } from 'vitest';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { readFile } from 'node:fs/promises';
import { parseResult } from '../src/validate.ts';
import { decodeResolverRecords, MarkdownResolver } from '../src/native/markdown-resolver.ts';
import { checkMarkdownAssets } from '../src/native/markdown-assets.ts';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('current native Markdown pilot', () => {
  it('checks the current assets including the full notice and license inventory', async () => {
    const identities = await checkMarkdownAssets();
    expect(Object.keys(identities)).toHaveLength(17);
    expect(identities['tree-sitter-md.wasm']).toBe('a62768930dddde0a5d9cf49cd35f583d83e9b4aedb34de0f047fcd7879df5159');
  });
  it('copies output immediately and rejects truncated counts and invalid ranges', () => {
    const heap = new Uint8Array(64), words = new Uint32Array(heap.buffer);
    words.set([8, 16, 2, 4], 4);
    const records = decodeResolverRecords(heap, 16, 4, 16, true);
    heap.fill(0);
    expect(records).toEqual([{ start: 8, end: 16, kind: 2, extra: 4 }]);
    for (const [pointer, count] of [[16, 3], [2, 4], [60, 4], [0, 4]]) expect(() => decodeResolverRecords(heap, pointer, count, 16, false)).toThrow();
    words.set([8, 17, 2, 4], 4);
    expect(() => decodeResolverRecords(heap, 16, 4, 16, true)).toThrow('range');
    words.set([8, 16, 7, 4], 4);
    expect(() => decodeResolverRecords(heap, 16, 4, 16, true)).toThrow('range');
    words.set([8, 16, 42, 0], 4);
    expect(() => decodeResolverRecords(heap, 16, 4, 16, false)).toThrow('kind');
    words.set([8, 16, 4, 2], 4);
    expect(() => decodeResolverRecords(heap, 16, 4, 16, false)).toThrow('flags');
    expect(decodeResolverRecords(heap, 0, 0, 0, false)).toEqual([]);
  });
  it('owns one resolver and maps the two original fence children to the document', async () => {
    const source = await readFile(new URL('../fixtures/original/markdown/fences.md', import.meta.url), 'utf8');
    const ts = await loadLanguagePack('typescript'), json = await loadLanguagePack('json');
    const owner = await MarkdownPilotDocument.open(source);
    try {
      expect(owner.observation).toEqual({ resolverSetText: 1, childParses: 2 });
      expect(owner.children.map(child => child.languageId)).toEqual(['typescript', 'json']);
      const result = await owner.document(new Map([['typescript', ts], ['json', json]]), 'product');
      expect(result.status).toBe('complete');
      expect(parseResult(JSON.parse(JSON.stringify(result)), source)).toEqual(result);
      expect(Object.isFrozen(owner)).toBe(true);
      expect('resolver' in owner).toBe(false);
    } finally { owner.dispose(); ts.dispose(); json.dispose(); }
  });
  it('leaves unknown, empty, Markdown and nested fences explicit', async () => {
    const source = '```zz\nx\n```\n```\nx\n```\n```markdown\nx\n```\n> ```ts\n> const nested = 1\n> ```\n```ts\nconst plain = 1\n```\n';
    const owner = await MarkdownPilotDocument.open(source);
    try {
      expect(owner.children).toHaveLength(1);
      expect(owner.children[0].start).toBe(source.indexOf('const plain'));
      expect(owner.diagnostics.join('\n')).toContain('missing language zz');
      expect(owner.diagnostics.join('\n')).toContain('unsupported nested fence ts');
      expect(owner.diagnostics.join('\n')).toContain('frame only: markdown');
    } finally { owner.dispose(); }
  });
  it('uses flags 3, decorations and exact UTF-16 ranges on empty, Unicode and CRLF text', async () => {
    const empty = await MarkdownResolver.open('');
    try { expect(empty.records(true)).toEqual([]); expect(empty.records(false)).toEqual([]); }
    finally { empty.dispose(); }
    const source = '---\r\ntitle: x\r\n---\r\n😀\r\n```ts\r\nconst café = "😀"\r\n```\r\n';
    const owner = await MarkdownPilotDocument.open(source), ts = await loadLanguagePack('typescript');
    try {
      expect(owner.children).toHaveLength(1);
      expect(source.slice(owner.children[0].start, owner.children[0].end)).toBe('const café = "😀"\r\n');
      const result = await owner.document(new Map([['typescript', ts]]), 'raw');
      expect(parseResult(JSON.parse(JSON.stringify(result)), source)).toEqual(result);
      expect(result.scopeNames).toContain('markup.fenced_code.block.markdown');
      expect(result.scopeNames).toContain('punctuation.definition.markdown');
      expect(result.scopeNames).toContain('fenced_code.block.language.markdown');
    } finally { owner.dispose(); ts.dispose(); }
  });
  it('compares fresh-process first use with warm repetition and observes real owner release', () => {
    const worker = fileURLToPath(new URL('./native-markdown-worker.ts', import.meta.url));
    const run = () => spawnSync(process.execPath, [worker], { encoding: 'utf8', timeout: 30000 });
    const cold = run(), repeat = run();
    expect(cold.status, cold.stderr).toBe(0); expect(repeat.status, repeat.stderr).toBe(0);
    expect(JSON.parse(cold.stdout)).toEqual(JSON.parse(repeat.stdout));
    expect(JSON.parse(cold.stdout)).toMatchObject({ setText: 1, childParses: 2, scopeParses: 0, baselineParses: 1, retainedResolver: true, retainedParser: true, retainedTree: true, retainedChild: true, released: true });
  });
});
