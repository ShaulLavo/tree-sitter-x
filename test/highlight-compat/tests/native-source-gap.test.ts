import { describe, expect, it } from 'vitest';
import { Component, PackLoadError } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeScopes } from '../src/native/adapter.ts';
import { explainDocument } from '../src/native/evidence.ts';
import type { DecodedResult, Window } from '../src/native/decode.ts';

async function pack(query: string, languageId = 'json') {
  return (await Component.load()).loadPack({ id: 'gap-contract', version: '1', languageId,
    rootScope: languageId === 'javascript' ? 'source.js' : 'source.json', suffix: languageId === 'javascript' ? '.js' : '.json',
    files: [{ path: 'gap.scm', query }] });
}
async function using(query: string, source: string, action: (p: NativePack, owner: PilotDocument) => void | Promise<void>, language = 'json') {
  const component = await Component.load(), baseline = component.liveAllocations();
  const p = await pack(query, language), owner = await PilotDocument.open(language, source);
  try { await action(p, owner); } finally { owner.dispose(); p.dispose(); }
  expect(component.liveAllocations()).toBe(baseline);
}
function result(p: NativePack, owner: PilotDocument, window?: Window): DecodedResult {
  const value = nativeScopes(p, owner, window);
  if (value.status !== 0) throw new Error(`Native failure ${JSON.stringify(value)}`);
  return value;
}
function rows(p: NativePack, value: DecodedResult) {
  return Array.from({ length: value.segments.length / 3 }, (_, index) => {
    const [from, to, path] = value.segments.subarray(index * 3, index * 3 + 3);
    return { from, to, path: value.paths[path].map(id => p.scopes[id]) };
  });
}
const markerPath = ['source.js', 'meta.var.expr.js', 'string.quoted.double.js', 'invalid.illegal.newline.js'];
const recovery = ['\n', '\r\n'].map(ending => `((variable_declarator
  (ERROR "\\\"" @_quote . (string_fragment) @_fragment . (identifier) @_keyword .) @_error
  value: (assignment_expression left: (identifier) @_binding "=" @_assign right: (_) @_value)) @_decl
  (#eq? @_keyword "const")
  (#source-gap? @_quote @_fragment "")
  (#source-gap? @_fragment @_keyword ${JSON.stringify(ending)})
  (#text-class? @_fragment "[ -~]" "[ -~]")
  (#make-span! "meta.var.expr" @_decl @_quote "start" "0" @_fragment "end" "0")
  (#make-span! "string.quoted.double" @_error @_quote "start" "0" @_fragment "end" "0")
  (#make-span! "invalid.illegal.newline" @_fragment @_fragment "end" "-1" @_fragment "end" "0"))`).join('\n');

describe('native bounded source gaps', () => {
  it('executes both recovery patterns and the retained mandatory DEV marker', async () => {
    await using(recovery, 'const open = "pending\nconst tail = 2;\n', async (p, owner) => {
      expect(rows(p, result(p, owner))).toContainEqual({ from: 20, to: 21, path: markerPath });
      expect(rows(p, result(p, owner))).toContainEqual({ from: 13, to: 20, path: markerPath.slice(0, 3) });
      const explained = await explainDocument(p, owner);
      expect(explained.find(row => row.scope === 'invalid.illegal.newline.js')).toMatchObject({ from: 20, to: 21, pattern: 0 });
      expect(explained.every(row => /^interval ordinal \d+$/.test(row.capture))).toBe(true);
      expect(await explainDocument(p, owner)).toEqual(explained);
      expect(p.engine.selectedOrderPolicy).toBe('contained-span-order-1');
    }, 'javascript');
  });

  it('uses independently authored ASCII LF/CRLF contract targets and full-source windows', async () => {
    for (const ending of ['\n', '\r\n']) {
      await recoveryCase(`const waiting = "unfinished  ${ending}const result = 999;${ending}`, 28, ending.length, ending === '\n' ? 0 : 1);
    }
    const prefix = '\ufeffconst prior = "😀é";\r\nconst waiting = "unfinished\r\nconst result = 9;\r\n';
    await recoveryCase(prefix, 50, 2, 1);
    const fragmentBounds = recovery.replaceAll('"invalid.illegal.newline" @_fragment @_fragment "end" "-1"',
      '"fragment-bounds" @_fragment @_fragment "start" "0"');
    await using(fragmentBounds, prefix, async (p, owner) => {
      expect((await explainDocument(p, owner)).find(row => row.scope === 'fragment-bounds.js')).toMatchObject({ from: 41, to: 51, pattern: 1 });
    }, 'javascript');
  });

  it('leaves EOF, continuations, closers and unsupported fragment shapes unadmitted', async () => {
    const tails = ['unfinished', 'unfinished\\\nconst result = 9;', 'unfinished\\\r\nconst result = 9;',
      'unfinished\\\\\nconst result = 9;', 'unfinished\\\\\\\nconst result = 9;', 'unfinished\\"\nconst result = 9;',
      'unfinished"\nconst result = 9;', 'unfinished";\nconst result = 9;', 'unfinished"/*x*/\nconst result = 9;',
      'unfinished\n  const result = 9;', 'unfinished\rconst result = 9;', 'unfinished😀\nconst result = 9;',
      'unfinishé\nconst result = 9;', 'unfinished\t\nconst result = 9;', '\nconst result = 9;'];
    for (const tail of tails) await using(recovery, `const waiting = "${tail}`, async (p, owner) => {
      expect((await explainDocument(p, owner)).filter(row => row.scope === 'invalid.illegal.newline.js'), tail).toEqual([]);
      expect(result(p, owner).statistics[1]).toBe(0);
    }, 'javascript');
  });

  it('compares exact gaps and retains legacy selection without a span directive', async () => {
    const cases: [string, string, boolean][] = [['[1,\n2]', '\n', true], ['[1,\r\n2]', '\r\n', true],
      ['[1,\r\n2]', '\n', false], ['[1,2]', '', true], ['[1,2]', '.', false], ['[1, 2]', '', false]];
    for (const [source, literal, accepted] of cases) await using(`((array "," @_a . (number) @_b .) @visible
      (#source-gap? @_a @_b ${JSON.stringify(literal)}))`, source, (p, owner) => {
      expect(result(p, owner).statistics[1] > 0).toBe(accepted);
      expect(p.engine.selectedOrderPolicy).toBe('legacy-1');
    });
    for (const roles of ['@_b @_a', '@_a @_a']) await using(`((array . (number) @_a (number) @_b .) @visible (#source-gap? ${roles} ""))`, '[1,2]', (p, owner) => {
      expect(result(p, owner).statistics[1]).toBe(0);
    });
    await using('((array "[" @_a . (number) @_b) @visible (#source-gap? @_a @_b ""))', '[1]', (p, owner) => {
      expect(result(p, owner).statistics[1]).toBe(1);
    });
    const astral = await pack('((number) @_n (#source-gap? @_n @_n "😀"))');
    astral.dispose();
  });

  it('rejects malformed syntax, three decoded units, and unsupported variants', async () => {
    for (const args of ['@_n @_n', '@_n @_n "" ""', '"x" @_n ""', '@_n "x" ""', '@_n @_n @_n', '@_n @_n "abc"', '@_n @_n "😀x"']) {
      await expect(pack(`((number) @_n (#source-gap? ${args}))`)).rejects.toMatchObject({ status: 3, detail: 3, operator: 'source-gap?', pattern: 0, offset: 0 });
    }
    for (const op of ['not-source-gap?', 'any-source-gap?', 'source-gap!']) {
      await expect(pack(`((number) @_n (#${op} @_n @_n ""))`)).rejects.toMatchObject({ status: 1, detail: 2, operator: op });
    }
    await expect(pack('((number) @_n (#source-gap? @_n @_undefined ""))')).rejects.toBeInstanceOf(PackLoadError);
  });

  it('preflights every role before false equality, class or gap and discards late output', async () => {
    const falseOps = ['(#eq? @_n "never")', '(#text-class? @_n "[a]" "[a]")', '(#source-gap? @_array @_array "x")'];
    for (const roles of ['@_n @_missing', '@_missing @_n', '@_n @_n']) {
      const captures = roles === '@_n @_n' ? '(number) @_n @_n' : '(number) @_n (string)? @_missing';
      for (const op of falseOps) await strictFailure(`((number) @_first @prior (#eq? @_first "1"))
        ((array . ${captures} .) @_array ${op} (#source-gap? ${roles} ""))`, '[1]', 2);
    }
    await strictFailure('((array . (number) @_n (string)? @_missing .) (#source-gap? @_n @_missing "") (#eq? @_n "never"))', '[1]', 0);
    await strictFailure('(number) @prior ((array . (number) @_n (string)? @_missing .) @_array (#source-gap? @_n @_missing ""))', '[1   ]', 0, { start: 4, end: 5 });
  });

  it('preserves legacy absent/repeated quantifiers and same-node priorities', async () => {
    const cases: [string, string, boolean][] = [['(string)? @_n', '#eq? @_n "x"', true], ['(string)? @_n', '#any-of? @_n "x"', false],
      ['(number) @_n (number) @_n', '#eq? @_n "1"', false], ['(number) @_n (number) @_n', '#any-eq? @_n "1"', true]];
    for (const [capture, op, accepted] of cases) await using(`((array . ${capture} .) @visible (${op}))`, capture.startsWith('(string)') ? '[]' : '[1,2]', (p, owner) => {
      expect(result(p, owner).statistics[1] > 0).toBe(accepted);
    });
    await using(`(array) @loser ((array "[" @_a . (number) @_b) @winner @second
      (#source-gap? @_a @_b "") (#set! priority "5"))`, '[1]', (p, owner) => {
      expect(rows(p, result(p, owner))).toEqual([{ from: 0, to: 3, path: ['source.json', 'winner.json', 'second.json'] }]);
    });
  });

  it('keeps budget failures and allocation restoration on the actual recovery component', async () => {
    await using(recovery, 'const open = "pending\nconst tail = 2;\n', (p, owner) => {
      owner.borrow(p.sameLanguage, borrow => {
        expect(p.run(borrow, { start: 0, end: owner.source.length }, { maxIntervals: 1 })).toEqual({ status: 2, detail: 23, value: 1 });
        expect(p.run(borrow, { start: 0, end: owner.source.length }, { maxSegments: 1 })).toEqual({ status: 2, detail: 24, value: 1 });
      });
    }, 'javascript');
    await using('((array (number) @_a (number) @_b) @visible (#source-gap? @_a @_b ","))', '[1,2,3,4,5]', (p, owner) => {
      owner.borrow(p.sameLanguage, borrow => {
        expect(p.run(borrow, { start: 0, end: owner.source.length }, { matchLimit: 1 })).toEqual({ status: 2, detail: 22, value: 1 });
        expect(p.explain(borrow, { start: 0, end: owner.source.length }, { matchLimit: 1 })).toEqual({ status: 2, detail: 22, value: 1 });
      });
    });
  });
});

async function strictFailure(query: string, source: string, ordinal: number, window = { start: 0, end: source.length }) {
  await using(query, source, (p, owner) => {
    expect(nativeScopes(p, owner, window)).toEqual({ status: 3, detail: 3, value: ordinal });
    owner.borrow(p.sameLanguage, borrow => expect(p.explain(borrow, window)).toEqual({ status: 3, detail: 3, value: ordinal }));
  });
}
async function recoveryCase(source: string, marker: number, width: number, pattern: number) {
  await using(recovery, source, async (p, owner) => {
    const full = rows(p, result(p, owner));
    expect(full).toContainEqual({ from: marker, to: marker + 1, path: markerPath });
    expect((await explainDocument(p, owner)).find(row => row.scope === 'invalid.illegal.newline.js')).toMatchObject({ from: marker, to: marker + 1, pattern });
    const windows = [{ start: marker, end: marker + 1 }, { start: marker + 1, end: marker + 2 }, { start: 0, end: 1 }];
    if (width === 2) windows.push({ start: marker + 2, end: marker + 3 }, { start: marker + 1, end: marker + 3 });
    for (const window of windows) {
      const clipped = full.filter(row => row.from < window.end && row.to > window.start)
        .map(row => ({ ...row, from: Math.max(row.from, window.start), to: Math.min(row.to, window.end) }));
      expect(rows(p, result(p, owner, window))).toEqual(clipped);
    }
    expect(owner.source).toBe(source);
    if (source.startsWith('\ufeff')) expect(rows(p, result(p, owner, { start: 0, end: 1 }))).toEqual([{ from: 0, to: 1, path: ['source.js'] }]);
  }, 'javascript');
}
