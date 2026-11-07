import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import jsxGrammar from '@shikijs/langs/jsx';
import { Component, PackLoadError } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { explainDocument } from '../src/native/evidence.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';
import { decodeExplain, decodeResult } from '../src/native/decode.ts';
import type { DecodedResult, Window } from '../src/native/decode.ts';
import { digest } from '../src/native/component-inputs.ts';

function pack(query: string, languageId = 'json') {
  return Component.load().then(component => component.loadPack({ id: 'bounded-test', version: '1', languageId,
    rootScope: `source.${languageId}`, suffix: `.${languageId}`, files: [{ path: 'bounded.scm', query }] }));
}
async function using<T>(query: string, source: string, action: (pack: NativePack, owner: PilotDocument) => T | Promise<T>, language = 'json'): Promise<T> {
  const compiled = await pack(query, language), owner = await PilotDocument.open(language, source);
  try { return await action(compiled, owner); } finally { owner.dispose(); compiled.dispose(); }
}
function success(pack: NativePack, owner: PilotDocument, window?: Window): DecodedResult {
  const result = nativeScopes(pack, owner, window);
  expect(result.status).toBe(0);
  if (result.status !== 0) throw new Error(`Native failure ${result.status}/${result.detail}`);
  return result;
}
function rows(pack: NativePack, result: DecodedResult) {
  return Array.from({ length: result.segments.length / 3 }, (_, index) => {
    const [from, to, path] = result.segments.subarray(index * 3, index * 3 + 3);
    return { from, to, path: result.paths[path].map(id => pack.scopes[id]) };
  });
}
function span(scope = 'frame', container = '_n', left = '_n', ls = 'start', ld = '0', right = '_n', rs = 'end', rd = '0'): string {
  return `(#make-span! "${scope}" @${container} @${left} "${ls}" "${ld}" @${right} "${rs}" "${rd}")`;
}
const valid = '(#text-class? @_n "[$_A-Za-z]" "[-$._0-9A-Za-z]" "[$_0-9A-Za-z]")';
const componentName = `${valid} (#not-text-class? @_n "[a-z]" "[0-9a-z]")`;
const entityQuery = `((html_character_reference) @_n @constant.character.entity
  (#starts-with? @_n "&") (#not-starts-with? @_n "#")
  (#text-class? @_n "[&]" "[;a-z]") (#not-text-class? @_n "[a-z]" "[a-z]")
  ${span('punctuation.definition.entity', '_n', '_n', 'start', '0', '_n', 'start', '1')}
  ${span('punctuation.definition.entity', '_n', '_n', 'end', '-1', '_n', 'end', '0')})`;

async function classified(name: string): Promise<boolean> {
  return using(`((string (string_content) @_n) @component ${componentName})`, JSON.stringify(name),
    (p, owner) => rows(p, success(p, owner)).some(row => row.path.includes('component.json')));
}
async function invalid(query: string, operator: string, status = 3): Promise<void> {
  const component = await Component.load(), baseline = component.liveAllocations();
  try { await pack(query); throw new Error('Expected pack rejection'); }
  catch (error) {
    expect(error).toBeInstanceOf(PackLoadError);
    if (!(error instanceof PackLoadError)) throw error;
    expect([error.status, error.detail, error.operator, error.pattern, error.offset]).toEqual([status, status === 1 ? 2 : 3, operator, 0, 0]);
  }
  expect(component.liveAllocations()).toBe(baseline);
}

describe('bounded native query text tests', () => {
  it('matches the independent pinned JSX rule on fresh ASCII names and namespace-local names', async () => {
    const require = createRequire(import.meta.url);
    const wasm = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
    expect(digest(wasm)).toBe('76ebc1f0d87b2e7449a45ff3cd1a1546a9f05f54bdac44ee03e8a2b8348897be');
    await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
    expect(digest(await readFile(require.resolve('@shikijs/langs/jsx')))).toBe('e93e62820880daf7a547dc35a8053a013a3b324d617a17cc8d2f94717a5d8fd6');
    const repository = foreign(foreign(jsxGrammar[0]).repository);
    const patterns = foreign(repository['jsx-tag']).patterns;
    if (!Array.isArray(patterns)) throw new Error('Missing pinned JSX tag patterns');
    const rule = foreign(patterns[0]).begin;
    if (typeof rule !== 'string') throw new Error('Missing pinned JSX tag rule');
    const scanner = new OnigScanner([rule]);
    const names = ['a', 'A', 'widget27', 'Widget27', 'aB', '$view', '_view', 'x-widget', 'Panel.Header', 'a.b', 'ns:a', 'ns:A', 'ns:aB', 'ns:Panel.Header', 'x-', 'a.', 'ns:', '27', 'é', '😀', 'e\u0301'].concat(
      Array.from({ length: 48 }, (_, i) => [`widget${i + 301}`, `Widget${i + 709}`, `a${i}B`, `$v${i}`, `_v${i}`, `x-${i}`, `ns:a${i}`, `ns:A${i}`]).flat());
    try { for (const name of names) await checkRuleName(scanner, name); }
    finally { scanner.dispose(); }
  });

  it('distinguishes the retained A/a counterexample on actual native JSX nodes', async () => {
    const query = `(lexical_declaration) @meta.var.expr (jsx_self_closing_element) @meta.tag
      ((jsx_self_closing_element name: (_) @_n @entity.name.tag @support.class.component) ${componentName} (#set! priority "10"))
      ((jsx_self_closing_element name: (_) @_n @entity.name.tag) (#text-class? @_n "[a-z]" "[0-9a-z]"))`;
    for (const name of ['A', 'a']) {
      await using(query, `const view = <${name}/>;`, (p, owner) => {
        const path = ['source.javascript', 'meta.var.expr.javascript', 'meta.tag.javascript', 'entity.name.tag.javascript'];
        if (name === 'A') path.push('support.class.component.javascript');
        expect(rows(p, success(p, owner))).toContainEqual({ from: 14, to: 15, path });
      }, 'javascript');
    }
  });

  it('uses universal per-occurrence negation and vacuity without changing membership', async () => {
    const sources = ['[]', '[1]', '[2]', '[1,2]'];
    const truth = [[true, true], [true, false], [false, true], [false, false]];
    for (let row = 0; row < sources.length; ++row) {
      await checkUniversal(sources[row], truth[row]);
    }
  });

  it('compares literal UTF-16 prefixes without normalization or regex semantics', async () => {
    const cases = [ ['', '', true], ['x', '', true], ['x', 'xy', false], ['.*$', '.*', true], ['😀é', '😀', true],
      ['é', 'é', true], ['é', 'é', false], ['// abc', '//', true], ['/** abc */', '//', false] ] satisfies [string, string, boolean][];
    for (const [text, prefix, expected] of cases) {
      await using(`((string) @_n @visible (#starts-with? @_n ${JSON.stringify('"' + prefix)}))`, JSON.stringify(text),
        (p, owner) => expect(success(p, owner).statistics[1] > 0).toBe(expected));
    }
  });

  it('rejects malformed recognized operators and keeps unknown operators unsupported', async () => {
    const badClasses = ['[]', '[z-a]', '[a-]', '[a-b-c]', '[^a]', '[a-z]+', '[[:alpha:]]', '[é]', '[a\\b]', 'a-z', '[a[b]', '[a]tail', '[a\n]'];
    for (const text of badClasses) await invalid(`((number) @_n (#text-class? @_n ${JSON.stringify(text)} "[0-9]"))`, 'text-class?');
    const bad = ['(#text-class? @_n "[0-9]")', '(#not-text-class? @_n "[0-9]" @_n)', '(#text-class? "[0-9]" @_n "[0-9]")',
      '(#text-class? @_n "[0-9]" "[0-9]" "[0-9]" "[0-9]")', '(#starts-with? @_n @_n)', '(#not-starts-with? @_n)', '(#starts-with? @_n "1" "2")'];
    for (const operation of bad) await invalid(`((number) @_n ${operation})`, operation.slice(2).split(' ')[0]);
    for (const operator of ['any-text-class?', 'any-not-text-class?', 'any-starts-with?', 'any-not-starts-with?', 'match?', 'offset!']) {
      await invalid(`((number) @_n (#${operator} @_n "x"))`, operator, 1);
    }
    await using('((number) @_n @n (#text-class? @_n "[0-90-9]" "[-0-9.$_]"))', '12', (p, owner) => expect(success(p, owner).statistics[1]).toBe(1));
  });
});

async function checkRuleName(scanner: OnigScanner, name: string): Promise<void> {
  const input = new OnigString(`<${name}/>`);
  try {
    const match = scanner.findNextMatchSync(input, 0);
    const local = match ? input.content.slice(match.captureIndices[4].start, match.captureIndices[4].end) : name.split(':').at(-1) ?? '';
    const expected = Boolean(match?.captureIndices[5].length);
    // The reference accepts é; the deliberately ASCII native guard does not.
    expect(await classified(local), name).toBe(name === 'é' ? false : expected);
  } finally { input.dispose(); }
}
async function checkUniversal(source: string, truth: readonly boolean[]): Promise<void> {
  for (const family of ['text-class?', 'starts-with?']) {
    for (let negative = 0; negative < 2; ++negative) {
      const args = family === 'text-class?' ? '"[1]" "[0-9]"' : '"1"';
      const captures = source === '[]' ? '(string)? @_n' : source === '[1,2]' ? '(number) @_n (number) @_n' : '(number) @_n';
      const query = `((array . ${captures} .) @visible (#${negative ? 'not-' : ''}${family} @_n ${args}))`;
      await using(query, source, (p, owner) => expect(success(p, owner).statistics[1] > 0).toBe(truth[negative]));
    }
  }
}

describe('native contained spans and ordering', () => {
  it('executes entity subunits and explains them with honest opaque ordinals', async () => {
    await using(entityQuery, 'const view = <i>&amp;</i>;', async (p, owner) => {
      expect(rows(p, success(p, owner))).toContainEqual({ from: 16, to: 17,
        path: ['source.javascript', 'constant.character.entity.javascript', 'punctuation.definition.entity.javascript'] });
      expect(rows(p, success(p, owner))).toContainEqual({ from: 17, to: 20, path: ['source.javascript', 'constant.character.entity.javascript'] });
      expect(rows(p, success(p, owner))).toContainEqual({ from: 20, to: 21,
        path: ['source.javascript', 'constant.character.entity.javascript', 'punctuation.definition.entity.javascript'] });
      const explanation = await explainDocument(p, owner);
      expect(explanation.filter(item => item.scope === 'punctuation.definition.entity.javascript').map(item => [item.from, item.to])).toEqual([[16, 17], [20, 21]]);
      expect(explanation.every(item => /^interval ordinal \d+$/.test(item.capture))).toBe(true);
    }, 'javascript');
  });

  it('finds a gap-only window through its captured container', async () => {
    const query = `((jsx_self_closing_element name: (_) @_name "/>" @_close) @_tag
      ${span('attributes', '_tag', '_name', 'end', '0', '_close', 'start', '0')})`;
    await using(query, '<br />', (p, owner) => {
      expect(rows(p, success(p, owner, { start: 3, end: 4 }))).toEqual([{ from: 3, to: 4, path: ['source.javascript', 'attributes.javascript'] }]);
    }, 'javascript');
  });

  it('selects exact edges, all canonical deltas, empty spans and split code-unit windows', async () => {
    const cases = [ ['start', '0', 'end', '0', 0, 4], ['start', '1', 'end', '-1', 1, 3], ['start', '2', 'end', '-2', 2, 2] ] satisfies [string, string, string, string, number, number][];
    for (const [ls, ld, rs, rd, from, to] of cases) {
      await using(`((number) @_n ${span('frame', '_n', '_n', ls, ld, '_n', rs, rd)})`, '1234', async (p, owner) => {
        const explanation = await explainDocument(p, owner);
        expect(explanation.map(item => [item.from, item.to, item.disposition])).toEqual([[from, to, from === to ? 'empty' : 'kept']]);
      });
    }
    await using(`((string (string_fragment) @_n) ${span('unit', '_n', '_n', 'start', '0', '_n', 'start', '1')})`, '"😀é"', (p, owner) => {
      expect(rows(p, success(p, owner, { start: 1, end: 2 }))).toEqual([{ from: 1, to: 2, path: ['source.javascript', 'unit.javascript'] }]);
      expect(rows(p, success(p, owner, { start: 2, end: 3 }))).toEqual([{ from: 2, to: 3, path: ['source.javascript'] }]);
    }, 'javascript');
  });

  it('rejects wrong arity, kinds, noncanonical adjustments and edge labels at load', async () => {
    for (const delta of ['+1', '01', '-0', '3', '-3', '2147483648', '9999999999999999999999', '0.5', '1e0']) {
      await invalid(`((number) @_n ${span('x', '_n', '_n', 'start', delta)})`, 'make-span!');
    }
    for (const operation of [span('x', '_n', '_n', 'middle'), '(#make-span! "x" @_n @_n "start" "0" @_n "end")',
      '(#make-span! @_n @_n @_n "start" "0" @_n "end" "0")', '(#make-span! "x" "_n" @_n "start" "0" @_n "end" "0")',
      '(#make-span! "x" @_n @_n start "0" @_n "end" "0" "extra")']) {
      await invalid(`((number) @_n ${operation})`, 'make-span!');
    }
  });

  it('rejects missing/repeated roles and sibling containers before window filtering with zero public data', async () => {
    const cases = [
      { query: `((array (number) @_n (string)? @_missing) @_array ${span('x', '_array', '_missing')})`, source: '[1]', detail: 3 },
      { query: `((array . (number) @_n (number) @_n .) @_array ${span('x', '_array')})`, source: '[1,2]', detail: 3 },
      { query: `((array (number) @_left (number) @_n) ${span('x', '_left')})`, source: '[1,2]', detail: 3 },
      { query: `((number) @_n ${span('x', '_n', '_n', 'start', '-1')})`, source: '[1]', detail: 19 },
      { query: `((number) @_n ${span('x', '_n', '_n', 'start', '0', '_n', 'end', '1')})`, source: '[1]', detail: 19 },
      { query: `((number) @_n ${span('x', '_n', '_n', 'end', '0', '_n', 'start', '0')})`, source: '12', detail: 19 },
    ];
    for (const item of cases) await failureCase(item.query, item.source, item.detail);
    // A container overlaps the window although the bad anchor is elsewhere.
    await failureCase(`((array (number) @_n) @_array ${span('x', '_array', '_n', 'start', '-1')})`, '[1   ]', 19, { start: 4, end: 5 });
    // Earlier successful node output must not survive a later bad span.
    await failureCase(`(number) @n ((string) @_n ${span('x', '_n', '_n', 'end', '1')})`, '[1,"x"]', 19);
  });

  it('keeps repeated logical scopes when clipping and orders wrappers, winners, ranges and crossings', async () => {
    const activate = `((document) @_d (#eq? @_d "never") ${span('unused', '_d', '_d', 'start', '0', '_d')})`;
    for (const query of ['(number) @same (array) @same (document) @same', '(document) @same (array) @same (number) @same']) {
      await using(`${query} ${activate}`, '[[1]]', (p, owner) => {
        expect(rows(p, success(p, owner, { start: 2, end: 3 }))).toEqual([{ from: 2, to: 3, path: ['source.json', 'same.json', 'same.json', 'same.json'] }]);
      });
    }
    const query = `(number) @loser ((number) @_n @winner @second (#set! priority "5") ${span('wrapper')})
      ((number) @_n (#make-range! "legacy" @_n @_n))`;
    await using(query, '1', async (p, owner) => {
      expect(rows(p, success(p, owner))).toEqual([{ from: 0, to: 1, path: ['source.json', 'wrapper.json', 'winner.json', 'second.json', 'legacy.json'] }]);
      const first = await explainDocument(p, owner), component = await Component.load();
      const bytes = component.number('scope_compat_bytes_new', [997]);
      try { expect(await explainDocument(p, owner)).toEqual(first); } finally { component.call('scope_compat_bytes_delete', [bytes]); }
      expect(first.find(item => item.scope === 'loser.json')?.disposition).toBe('exclusive');
    });
    const crossing = `((array . (number) @_a (number) @_b (number) @_c .) @_n
      ${span('one', '_n', '_a', 'start', '0', '_b', 'end', '0')}
      ${span('two', '_n', '_b', 'start', '0', '_c', 'end', '0')}
      ${span('one', '_n', '_a', 'start', '0', '_b', 'end', '0')})`;
    await using(crossing, '[1,2,3]', (p, owner) => {
      expect(rows(p, success(p, owner))).toEqual([
        { from: 0, to: 1, path: ['source.json'] }, { from: 1, to: 3, path: ['source.json', 'one.json'] },
        { from: 3, to: 4, path: ['source.json', 'one.json', 'two.json'] }, { from: 4, to: 6, path: ['source.json', 'two.json'] },
        { from: 6, to: 7, path: ['source.json'] }]);
      expect(success(p, owner).statistics[4]).toBe(1);
    });
  });

  it('charges spans against existing interval/segment limits', async () => {
    await using(`((number) @_n @n ${span()} ${span('inner', '_n', '_n', 'start', '1', '_n', 'end', '-1')})`, '123', (p, owner) => {
      owner.borrow(p.sameLanguage, borrow => {
        expect(p.run(borrow, { start: 0, end: 3 }, { maxIntervals: 1 })).toEqual({ status: 2, detail: 23, value: 1 });
        expect(p.run(borrow, { start: 0, end: 3 }, { maxSegments: 1 })).toEqual({ status: 2, detail: 24, value: 1 });
      });
    });
  });
});

async function failureCase(query: string, source: string, detail: number, window = { start: 0, end: source.length }): Promise<void> {
  await using(query, source, (p, owner) => {
    const result = nativeScopes(p, owner, window);
    expect(result.status, query).toBe(3);
    if (result.status === 0) throw new Error('Expected failure');
    expect(result.detail).toBe(detail);
    owner.borrow(p.sameLanguage, borrow => expect(p.explain(borrow, window)).toEqual(result));
  });
}

describe('native policy and provenance metadata', () => {
  it('uses parsed directives from the exact joined query, including never-matching directives', async () => {
    for (const query of ['(number) @_n ; (#make-span! fake)', '((number) @_n (#eq? @_n "#make-span!"))', '((number) @_n (#starts-with? @_n "#make-span!"))']) {
      const compiled = await pack(query);
      try { expect(compiled.engine.selectedOrderPolicy).toBe('legacy-1'); } finally { compiled.dispose(); }
    }
    const compiled = await pack(`((number) @_n (#eq? @_n "never") ${span()})`);
    try {
      expect(compiled.engine.selectedOrderPolicy).toBe('contained-span-order-1');
      expect(compiled.engine.composition).toBe('scope-compat-compose-1+contained-span-order-1');
    } finally { compiled.dispose(); }
    await using(`((number) @frame @_n ${span()})`, '1', async (p, owner) => {
      const explanation = await explainDocument(p, owner);
      expect(explanation[0].capture).toBe('interval ordinal 0');
      expect(explanation[0].disposition).toBe('kept');
      expect(explanation[1].disposition).toBe('duplicate');
    });
    await using('((number) @n @_n (#make-range! "range" @_n @_n))', '1', async (p, owner) => {
      expect((await explainDocument(p, owner)).map(item => item.capture)).toEqual(['@n', 'make-range range']);
    });
  });

  it('releases temporary Query and native pack on metadata failure, and never reads metadata before native acceptance', async () => {
    const runtime = await Runtime.load(), component = await Component.load(), baseline = component.liveAllocations();
    const construct = runtime.construct.bind(runtime);
    let created = 0, released = 0;
    const spy = vi.spyOn(runtime, 'construct').mockImplementation((name, args) => {
      const result = construct(name, args);
      if (name !== 'Query') return result;
      created++;
      const remove = foreign(result).delete;
      result.delete = () => { released++; if (typeof remove !== 'function') throw new Error('Missing delete'); return Reflect.apply(remove, result, []); };
      return result;
    });
    try {
      const compiled = await pack(`((number) @_n ${span()})`); compiled.dispose();
      expect([created, released]).toEqual([1, 1]);
      await expect(pack('((number) @_n (#unknown! @_n))')).rejects.toBeInstanceOf(PackLoadError);
      expect([created, released]).toEqual([1, 1]);
      spy.mockImplementation((name, args) => {
        const result = construct(name, args);
        if (name !== 'Query') return result;
        const remove = result.delete;
        result.predicatesForPattern = () => [{ operator: 17 }];
        result.delete = () => { released++; if (typeof remove !== 'function') throw new Error('Missing delete'); return Reflect.apply(remove, result, []); };
        return result;
      });
      await expect(pack(`((number) @_n ${span()})`)).rejects.toThrow('operator metadata');
      expect(released).toBe(2);
      expect(component.liveAllocations()).toBe(baseline);
    } finally { spy.mockRestore(); }
  });

  it('admits runtime detail 3 only for INVALID and rejects partial failure packets', () => {
    const heap = new Uint8Array(256), header = new Uint32Array(heap.buffer, 4, 15);
    header.set([1, 3, 3, 7, 0, 1]);
    expect(decodeResult(heap, 4, { start: 0, end: 1 }, 2)).toEqual({ status: 3, detail: 3, value: 7 });
    for (const status of [1, 2, 4, 5]) {
      header[1] = status;
      expect(() => decodeResult(heap, 4, { start: 0, end: 1 }, 2)).toThrow();
    }
    header[1] = 3;
    for (const index of [6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      header[index] = 1;
      expect(() => decodeResult(heap, 4, { start: 0, end: 1 }, 2)).toThrow();
      header[index] = 0;
    }
    header.fill(0); header.set([1, 3, 3, 7]);
    expect(decodeExplain(heap, 4, { start: 0, end: 1 }, 2, 1)).toEqual({ status: 3, detail: 3, value: 7 });
    header[4] = 1;
    expect(() => decodeExplain(heap, 4, { start: 0, end: 1 }, 2, 1)).toThrow();
    header[4] = 0; header[5] = 16;
    expect(() => decodeExplain(heap, 4, { start: 0, end: 1 }, 2, 1)).toThrow();
  });
});

it('resolves the seven named DEV endpoint records without changing the frozen corpus', async () => {
  // Exact retained development/original sources and independent product endpoints from design-010 endpoint-proof.json.
  const jsx = 'import { Panel } from "ui";\nconst items = [1, 2];\nexport const view = <>\n  <Panel.Header title="Hello" active data-id={items.length} {...props}>\n    text &amp; {items.map(n => <i key={n}>{n + 1}</i>)}\n  </Panel.Header>\n  <br />\n</>;\n';
  const js = 'import { read as load } from "pkg";\nexport const state = { count: 2 };\nconst next = (value = 1) => state.count + value;\nload(next());\nconst text = `count: ${next(2)}`;\n';
  const utf16 = '\ufeffconst title = "🧭é";\r\nconst value = `${title}🌲`;\r\n// astral 🪵\r\nvalue';
  expect(digest(new TextEncoder().encode(jsx))).toBe('63bb981907b5975e7e834cf486dd12ce27dacb986af9017a9b2f720c7f48ce60');
  expect(digest(new TextEncoder().encode(utf16))).toBe('2f1b939a35197b48645c27259e4a2918f07c31a10d991e0579d048a18a54b6a9');
  const attributes = `((jsx_opening_element name: (_) @_name ">" @_close) @_tag ${span('attributes', '_tag', '_name', 'end', '0', '_close', 'start', '0')})
    ((jsx_self_closing_element name: (_) @_name "/>" @_close) @_tag ${span('attributes', '_tag', '_name', 'end', '0', '_close', 'start', '0')})`;
  await using(`${entityQuery} ${attributes}`, jsx, async (p, owner) => {
    const explained = await explainDocument(p, owner);
    const edges = explained.filter(item => item.disposition === 'kept').map(item => [item.from, item.to]);
    for (const expected of [[154, 155], [158, 159], [88, 143], [224, 225]]) expect(edges).toContainEqual(expected);
    expect(rows(p, success(p, owner, { start: 224, end: 225 }))).toEqual([{ from: 224, to: 225, path: ['source.javascript', 'attributes.javascript'] }]);
    const atClose = rows(p, success(p, owner, { start: 143, end: 144 }));
    expect(atClose.some(item => item.path.includes('attributes.javascript'))).toBe(false);
  }, 'javascript');
  const declarations = `((variable_declarator name: (_) @_name "=" @_eq) @_decl ${span('lhs', '_decl', '_name', 'start', '0', '_eq', 'start', '0')})
    ((variable_declarator "=" @_eq value: (arrow_function body: (_) @_body)) @_decl ${span('arrow', '_decl', '_eq', 'end', '0', '_body', 'start', '0')})`;
  await using(declarations, js, async (p, owner) => {
    const explained = await explainDocument(p, owner);
    expect(explained.map(item => [item.from, item.to])).toContainEqual([49, 55]);
    expect(explained.map(item => [item.from, item.to])).toContainEqual([83, 99]);
    expect(rows(p, success(p, owner, { start: 100, end: 101 })).some(item => item.path.includes('arrow.javascript'))).toBe(false);
  }, 'javascript');
  await using(`((comment) @_n @comment.line.double-slash (#starts-with? @_n "//") ${span('punctuation.definition.comment', '_n', '_n', 'start', '0', '_n', 'start', '2')})`, utf16, async (p, owner) => {
    expect((await explainDocument(p, owner)).map(item => [item.from, item.to])).toContainEqual([53, 55]);
    expect(rows(p, success(p, owner, { start: 0, end: 1 }))).toEqual([{ from: 0, to: 1, path: ['source.javascript'] }]);
    expect(rows(p, success(p, owner, { start: 65, end: 66 }))).toEqual([{ from: 65, to: 66, path: [] }]);
  }, 'javascript');
});

it('classifies the local half of a real namespace node and intersects the optional last set', async () => {
  const query = `((jsx_self_closing_element name: (jsx_namespace_name (identifier) @_prefix (identifier) @_n)) @component ${componentName})`;
  for (const [source, expected] of [['<ns:a/>', false], ['<ns:A/>', true], ['<ns:aB/>', true]] satisfies [string, boolean][]) {
    await using(query, source, (p, owner) => expect(success(p, owner).statistics[1] > 0).toBe(expected), 'javascript');
  }
  await using('((string (string_content) @_n) @visible (#text-class? @_n "[A]" "[0]" "[B]"))', '"A"', (p, owner) => expect(success(p, owner).statistics[1]).toBe(0));
  await using('((string (string_content) @_n) @visible (#text-class? @_n "[A]" "[0]" "[A]"))', '"A"', (p, owner) => expect(success(p, owner).statistics[1]).toBe(1));
});

it('checks every exact-one role, absolute directive diagnostics, and legacy range behavior in an extended pack', async () => {
  for (const directive of [span('x', '_missing'), span('x', '_array', '_n', 'start', '0', '_missing')]) {
    await failureCase(`((array . (number) @_n (string)? @_missing .) @_array ${directive})`, '[1]', 3);
  }
  await failureCase(`((number) @_n @_n ${span()})`, '1', 3);
  const late = `((number) @_first @n (#eq? @_first "1"))
    ((array . (number) @_n (string)? @_missing .) @_array (#starts-with? @_n "1") ${span('x', '_array', '_missing')})`;
  await using(late, '[1]', (p, owner) => expect(nativeScopes(p, owner)).toEqual({ status: 3, detail: 3, value: 2 }));
  const activate = `((document) @_d (#eq? @_d "never") ${span('x', '_d', '_d', 'start', '0', '_d')})`;
  await using(`((array . (number) @_a (number) @_a (number) @_b .) (#make-range! "legacy" @_a @_b)) ${activate}`, '[1,2,3]', async (p, owner) => {
    expect((await explainDocument(p, owner)).map(item => [item.from, item.to])).toEqual([[1, 6]]);
  });
  await using(`((array . (number) @_n (string)? @_missing .) (#eq? @_n "never") ${span('x', '_missing')})`, '[1]', (p, owner) => {
    expect(p.engine.selectedOrderPolicy).toBe('contained-span-order-1');
    expect(success(p, owner).statistics[1]).toBe(0);
  });
  await using(`(number) @child (document) @parent ${activate}`, '1', (p, owner) => {
    expect(rows(p, success(p, owner))).toEqual([{ from: 0, to: 1, path: ['source.json', 'parent.json', 'child.json'] }]);
  });
});

it('derives selection from joined query files and retains literal comment prefixes', async () => {
  const component = await Component.load();
  const compiled = await component.loadPack({ id: 'joined', version: '1', languageId: 'json', rootScope: 'source.json', suffix: '.json',
    files: [{ path: 'comment.scm', query: '; #make-span! in a comment without a final newline' },
      { path: 'actual.scm', query: `((number) @_n (#starts-with? @_n "never") ${span()})` }] });
  try { expect(compiled.engine.selectedOrderPolicy).toBe('contained-span-order-1'); } finally { compiled.dispose(); }
  const documentation = '/** @param {number} v documentation */\nfunction outer(v) { const local = v; return local; }\nconst rx = /a[b]+/gu;\nconst html = htmlTag`<b>${outer(1)}</b>`;\n';
  await using('((comment) @_n @documentation (#starts-with? @_n "/**"))', documentation, (p, owner) => {
    expect(rows(p, success(p, owner))).toContainEqual({ from: 0, to: 38, path: ['source.javascript', 'documentation.javascript'] });
  }, 'javascript');
});
