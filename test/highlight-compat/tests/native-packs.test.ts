import { describe, expect, it } from 'vitest';
import { loadLanguagePack } from '../src/native/packs.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeDocument, nativeScopes } from '../src/native/adapter.ts';
import { corpusInputs } from '../src/corpus.ts';
import { parseResult } from '../src/validate.ts';
import { Runtime, foreign } from '../src/native/runtime.ts';
import { baselineScopes } from '../src/baselines/run.ts';
import { originalFixtures } from '../src/original-fixtures.ts';
import type { NativePack } from '../src/native/component.ts';
import type { CorpusInput } from '../src/corpus.ts';
import type { PassResult } from '../src/native/decode.ts';

function scopesAt(pack: NativePack, result: PassResult, offset: number): string[] {
  expect(result.status).toBe(0);
  if (result.status !== 0) throw new Error(`Native scope pass failed with status ${result.status}`);
  for (let i = 0; i < result.segments.length; i += 3) {
    if (offset < result.segments[i] || offset >= result.segments[i + 1]) continue;
    return result.paths[result.segments[i + 2]].map(id => pack.scopes[id]);
  }
  throw new Error(`No native segment at ${offset}`);
}

async function checkDeclarationFrame(source: string): Promise<void> {
  const pack = await loadLanguagePack('tsx');
  const owner = await PilotDocument.open('tsx', source);
  try {
    const result = nativeScopes(pack, owner);
    const start = source.indexOf('const ');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(scopesAt(pack, result, start)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'storage.type.tsx']);
    expect(scopesAt(pack, result, start + 5)).toEqual(['source.tsx', 'meta.var.expr.tsx']);
    expect(scopesAt(pack, result, source.indexOf('='))).toEqual([
      'source.tsx', 'meta.var.expr.tsx', 'keyword.operator.assignment.tsx',
    ]);
  } finally { owner.dispose(); pack.dispose(); }
}

async function checkInput(pack: NativePack, input: CorpusInput): Promise<void> {
  const owner = await PilotDocument.open(input.languageId, input.source);
  try {
    const result = await nativeDocument(pack, owner, 'product');
    expect(result.status, input.fixtureId).toBe('complete');
    expect(parseResult(JSON.parse(JSON.stringify(result)), input.source)).toEqual(result);
    expect(nativeScopes(pack, owner)).toEqual(nativeScopes(pack, owner));
  } finally { owner.dispose(); }
}
async function checkCorpus(languageId: string): Promise<void> {
  const pack = await loadLanguagePack(languageId);
  try {
    for (const input of corpusInputs().filter(input => input.languageId === languageId)) await checkInput(pack, input);
  } finally { pack.dispose(); }
}
async function checkNoParse(pack: NativePack, language: string, count: () => number): Promise<void> {
  const before = count();
  await baselineScopes('baseline:captures', language, 'const x = 1');
  expect(count() - before).toBe(1);
  const owner = await PilotDocument.open(language, 'const x = 1');
  try { const parsed = count(); expect(nativeScopes(pack, owner).status).toBe(0); expect(count()).toBe(parsed); }
  finally { owner.dispose(); }
}

describe('explicit native language variants', () => {
  it.each(originalFixtures().filter(input => input.languageId === 'tsx'))(
    'keeps the declaration ancestor on original/$fixtureId tokens and gaps',
    input => checkDeclarationFrame(input.source),
  );
  it.each([
    'const a = 1, b = 2; let c = 3;\n',
    'const a = 1 /* tail */; let c = 3;\n',
    'const a = 1, b = 2 /* tail */; let c = 3;\n',
    'const a = 1, b = 2 /* first */ /* second */; let c = 3;\n',
    'const a = 1, b = 2 /* a */ /* b */ /* c */ /* d */ /* e */; let c = 3;\n',
    'const a = 1, b = 2 // tail\n; let c = 3;\n',
  ])('frames every declarator once and leaves trailing comments and terminators outside the range: %s', async source => {
    const pack = await loadLanguagePack('tsx');
    const owner = await PilotDocument.open('tsx', source);
    try {
      const result = nativeScopes(pack, owner);
      const storage = ['source.tsx', 'meta.var.expr.tsx', 'storage.type.tsx'];
      const assignment = ['source.tsx', 'meta.var.expr.tsx', 'keyword.operator.assignment.tsx'];
      expect(scopesAt(pack, result, 0)).toEqual(storage);
      expect(scopesAt(pack, result, 5)).toEqual(['source.tsx', 'meta.var.expr.tsx']);
      expect(scopesAt(pack, result, source.indexOf('let'))).toEqual(storage);
      for (const match of source.matchAll(/=/g)) {
        expect(scopesAt(pack, result, match.index)).toEqual(assignment);
      }
      for (const match of source.matchAll(/\/\*|\/\//g)) {
        expect(scopesAt(pack, result, match.index)).not.toContain('meta.var.expr.tsx');
      }
      expect(scopesAt(pack, result, source.indexOf(';'))).toEqual(['source.tsx', 'punctuation.terminator.statement.tsx']);
      expect(scopesAt(pack, result, source.indexOf(';') + 1)).toEqual(['source.tsx']);
      expect(scopesAt(pack, result, source.length - 1)).toEqual([]);
    } finally { owner.dispose(); pack.dispose(); }
  });
  it.each(['typescript', 'tsx'] as const)('loads %s and completes its unchanged corpus', checkCorpus);

  it('preserves high-impact TypeScript and TSX TextMate scopes (type params, annotations, return types, comments, const, satisfies, accessor)', async () => {
    const source = '// note\ninterface Box<const T extends string> { readonly a: T | void; }\nconst x = { k: 1 } as const satisfies Record<string, number>;\nfunction f<T>(p: T): T { return p; }\nclass C { accessor v = 1; }\n';
    const pack = await loadLanguagePack('typescript');
    const owner = await PilotDocument.open('typescript', source);
    try {
      const result = nativeScopes(pack, owner);
      expect(scopesAt(pack, result, 0)).toEqual(['source.ts', 'comment.line.double-slash.ts', 'punctuation.definition.comment.ts']);
      expect(scopesAt(pack, result, source.indexOf('interface'))).toContain('storage.type.interface.ts');
      expect(scopesAt(pack, result, source.indexOf('Box'))).toContain('entity.name.type.interface.ts');
      expect(scopesAt(pack, result, source.indexOf('<const'))).toContain('punctuation.definition.typeparameters.begin.ts');
      expect(scopesAt(pack, result, source.indexOf('const T'))).toContain('storage.modifier.ts');
      expect(scopesAt(pack, result, source.indexOf('extends'))).toContain('storage.modifier.ts');
      expect(scopesAt(pack, result, source.indexOf('a:'))).toContain('variable.object.property.ts');
      expect(scopesAt(pack, result, source.indexOf(': T |'))).toContain('keyword.operator.type.annotation.ts');
      expect(scopesAt(pack, result, source.indexOf('| void'))).toContain('keyword.operator.type.ts');
      expect(scopesAt(pack, result, source.indexOf('void'))).toContain('support.type.primitive.ts');
      expect(scopesAt(pack, result, source.indexOf('x ='))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.var-single-variable.expr.ts', 'meta.definition.variable.ts', 'variable.other.constant.ts']);
      expect(scopesAt(pack, result, source.indexOf('as const') + 3)).toContain('entity.name.type.ts');
      expect(scopesAt(pack, result, source.indexOf('satisfies'))).toContain('keyword.control.satisfies.ts');
      expect(scopesAt(pack, result, source.indexOf('): T') + 3)).toEqual(['source.ts', 'meta.function.ts', 'meta.return.type.ts', 'entity.name.type.ts']);
      expect(scopesAt(pack, result, source.indexOf('return'))).toContain('keyword.control.flow.ts');
      expect(scopesAt(pack, result, source.indexOf('accessor'))).toContain('storage.type.property.ts');
    } finally { owner.dispose(); pack.dispose(); }
  });

  it('keeps unimplemented variants deferred', async () => {
    await expect(loadLanguagePack('python')).rejects.toThrow('distinct variant');
    await expect(loadLanguagePack('rust')).rejects.toThrow('distinct variant');
  });
  it.each(['typescript', 'tsx'] as const)('adds zero scope parses for the actual %s pack after a positive baseline control', async language => {
    const runtime = await Runtime.load(), prototype = foreign(foreign(runtime.binding.Parser).prototype);
    const original = prototype.parse;
    let count = 0;
    Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: function (this: unknown, ...args: unknown[]) {
      count++;
      if (typeof original !== 'function') throw new Error('Missing Parser.parse');
      return Reflect.apply(original, this, args);
    } });
    const pack = await loadLanguagePack(language);
    try {
      await checkNoParse(pack, language, () => count);
    } finally {
      pack.dispose(); Object.defineProperty(prototype, 'parse', { configurable: true, writable: true, value: original });
    }
  });
});
