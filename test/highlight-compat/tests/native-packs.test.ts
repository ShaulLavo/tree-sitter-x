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

  it('preserves high-impact TypeScript and TSX TextMate scopes and exact-stack edge cases', async () => {
    const tsSource = '// note\n//\n/**/\nimport * as module from "pkg";\nexport * as NaN from "pkg";\ninterface Box<const T extends string> { readonly a: T | void; }\nexport const x = { a: 1, b: 2, c: 3 } as const satisfies Record<string, number>;\nconst trailing = { a: 1, };\nconst spaced = { a: 1   };\nconst multiline = { a: 1\n  };\nconst shorthand = { a   };\nconst spreadObj = { ...a   };\nconst value = ui.menu.item;\nconst deep = ui.menu?.section.item.leaf;\nconst opt1 = ui?.menu.item;\nconst opt2 = ui.menu?.item;\nconst opt3 = getUi().menu?.item;\nconst opt4 = ui.menu.section?.item;\nobj?.run();\nfor (let i = 0; i < 1; i++) {}\nif (ready) var result = 1;\nswitch (x) { case 1: const scoped = 1 /* c */; }\nfunction f<T>(p: T): T { return p; }\nclass C { accessor v = 1; accessor = 2; @first @second value = 7; @dec /* c */ other = 8; }\nconst obj = { constructor() {}   };\nlet NaN = 0; const Infinity = 1; function NaN() {}\nconst realNan = NaN;\nthrow NaN;\nconst spread = [...Infinity];\n';
    const tsPack = await loadLanguagePack('typescript');
    const tsOwner = await PilotDocument.open('typescript', tsSource);
    try {
      const result = nativeScopes(tsPack, tsOwner);
      expect(scopesAt(tsPack, result, 0)).toEqual(['source.ts', 'comment.line.double-slash.ts', 'punctuation.definition.comment.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('//\n'))).toEqual(['source.ts', 'comment.line.double-slash.ts', 'punctuation.definition.comment.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('/**/'))).toEqual(['source.ts', 'comment.block.ts', 'punctuation.definition.comment.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('module from'))).toEqual(['source.ts', 'meta.import.ts', 'variable.other.readwrite.alias.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('NaN from'))).toEqual(['source.ts', 'variable.other.readwrite.alias.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('interface'))).toContain('storage.type.interface.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('Box'))).toContain('entity.name.type.interface.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('<const'))).toContain('punctuation.definition.typeparameters.begin.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('const T'))).toContain('storage.modifier.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('extends'))).toContain('storage.modifier.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('a: T'))).toContain('variable.object.property.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf(': T |'))).toContain('keyword.operator.type.annotation.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('| void'))).toContain('keyword.operator.type.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('void'))).toContain('support.type.primitive.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('x ='))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.var-single-variable.expr.ts', 'meta.definition.variable.ts', 'variable.other.constant.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('a: 1'))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts', 'meta.object-literal.key.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('b: 2'))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts', 'meta.object-literal.key.ts']);
      const trailingAt = tsSource.indexOf('a: 1,');
      expect(scopesAt(tsPack, result, trailingAt)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts', 'meta.object-literal.key.ts']);
      expect(scopesAt(tsPack, result, trailingAt + 4)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'punctuation.separator.comma.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('ui.menu'))).toEqual(['source.ts', 'meta.var.expr.ts', 'variable.other.object.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('.menu'))).toEqual(['source.ts', 'meta.var.expr.ts', 'punctuation.accessor.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('menu.item'))).toEqual(['source.ts', 'meta.var.expr.ts', 'variable.other.object.property.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('item;'))).toEqual(['source.ts', 'meta.var.expr.ts', 'variable.other.property.ts']);
      const deepTs = tsSource.indexOf('ui.menu?.section.item.leaf');
      expect(scopesAt(tsPack, result, deepTs + 17)).toEqual(['source.ts', 'meta.var.expr.ts', 'variable.other.object.property.ts']);
      expect(scopesAt(tsPack, result, deepTs + 22)).toEqual(['source.ts', 'meta.var.expr.ts', 'variable.other.property.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('run()'))).toEqual(['source.ts', 'meta.function-call.ts', 'entity.name.function.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('let i = 0'))).toEqual(['source.ts', 'meta.var.expr.ts', 'storage.type.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('var result = 1'))).toEqual(['source.ts', 'meta.var.expr.ts', 'storage.type.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('const scoped = 1'))).toEqual(['source.ts', 'meta.var.expr.ts', 'storage.type.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('as const') + 3)).toContain('entity.name.type.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('satisfies'))).toContain('keyword.control.satisfies.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('): T') + 3)).toEqual(['source.ts', 'meta.function.ts', 'meta.return.type.ts', 'entity.name.type.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('return'))).toContain('keyword.control.flow.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('accessor v'))).toContain('storage.type.property.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('accessor = 2'))).toEqual(['source.ts', 'meta.class.ts', 'meta.field.declaration.ts', 'meta.definition.property.ts', 'variable.object.property.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('2; @'))).toEqual(['source.ts', 'meta.class.ts', 'meta.field.declaration.ts', 'constant.numeric.decimal.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('7; @'))).toEqual(['source.ts', 'meta.class.ts', 'meta.field.declaration.ts', 'constant.numeric.decimal.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('8; }'))).toEqual(['source.ts', 'meta.class.ts', 'meta.field.declaration.ts', 'constant.numeric.decimal.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('1   };') + 2)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('\n  };') + 2)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('{ a   };') + 4)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('...a   };') + 5)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts', 'meta.object.member.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('constructor'))).toContain('entity.name.function.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('constructor'))).not.toContain('storage.type.ts');
      expect(scopesAt(tsPack, result, tsSource.indexOf('{}   };') + 3)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.objectliteral.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('NaN = 0'))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.var-single-variable.expr.ts', 'meta.definition.variable.ts', 'variable.other.readwrite.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('Infinity = 1'))).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.var-single-variable.expr.ts', 'meta.definition.variable.ts', 'variable.other.constant.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('NaN()'))).toEqual(['source.ts', 'meta.function.ts', 'meta.definition.function.ts', 'entity.name.function.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('= NaN;') + 2)).toEqual(['source.ts', 'meta.var.expr.ts', 'constant.language.nan.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('throw NaN;') + 6)).toEqual(['source.ts', 'constant.language.nan.ts']);
      expect(scopesAt(tsPack, result, tsSource.indexOf('...Infinity') + 3)).toEqual(['source.ts', 'meta.var.expr.ts', 'meta.array.literal.ts', 'constant.language.infinity.ts']);
    } finally { tsOwner.dispose(); tsPack.dispose(); }

    const tsxSource = 'const el = <UI.Button />;\nconst nested = <UI.Menu.Item />;\nconst p = <Promise.then />;\nconst nanTag = <NaN.Menu.Item />;\nconst value = ui.menu.item;\nconst deep = ui.menu?.section.item.leaf;\nconst opt1 = ui?.menu.item;\nconst opt2 = ui.menu?.item;\nconst opt3 = getUi().menu?.item;\nconst opt4 = ui.menu.section?.item;\nobj?.run();\nconst trailing = { a: 1, };\nconst spaced = { a: 1   };\nconst multiline = { a: 1\n  };\nconst methodObj = { a() {}   };\nconst shorthand = { a   };\nconst spreadObj = { ...a   };\nclass C { accessor = 2; @first @second value = 7; @dec /* c */ other = 8; }\nconst shown = <div>{NaN}</div>;\nthrow NaN;\nconst spread = [...Infinity];\n';
    const tsxPack = await loadLanguagePack('tsx');
    const tsxOwner = await PilotDocument.open('tsx', tsxSource);
    try {
      const result = nativeScopes(tsxPack, tsxOwner);
      for (const token of ['UI.Button', 'Button', 'UI.Menu.Item', 'Item', 'Promise.then', 'then', 'NaN.Menu.Item']) {
        expect(scopesAt(tsxPack, result, tsxSource.indexOf(token))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.tag.tsx', 'entity.name.tag.tsx', 'support.class.component.tsx']);
      }
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('ui.menu'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('.menu'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'punctuation.accessor.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('menu.item'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('item;'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('ui?.menu'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('menu.item;\nconst opt2'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('item;\nconst opt2'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('ui.menu?.'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('menu?.item'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('item;\nconst opt3'))).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('getUi().menu?.item') + 14)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.property.tsx']);
      const opt4 = tsxSource.indexOf('ui.menu.section?.item');
      expect(scopesAt(tsxPack, result, opt4)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 2)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'punctuation.accessor.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 3)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.property.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 7)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'punctuation.accessor.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 8)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.object.property.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 15)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'punctuation.accessor.optional.tsx']);
      expect(scopesAt(tsxPack, result, opt4 + 17)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'variable.other.property.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('run()'))).toEqual(['source.tsx', 'meta.function-call.tsx', 'entity.name.function.tsx']);
      const trailingAt = tsxSource.indexOf('a: 1,');
      expect(scopesAt(tsxPack, result, trailingAt)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'meta.object.member.tsx', 'meta.object-literal.key.tsx']);
      expect(scopesAt(tsxPack, result, trailingAt + 4)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'punctuation.separator.comma.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('1   };') + 2)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'meta.object.member.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('\n  };') + 2)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'meta.object.member.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('{}   };') + 3)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('{ a   };') + 4)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'meta.object.member.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('...a   };') + 5)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.objectliteral.tsx', 'meta.object.member.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('2; @'))).toEqual(['source.tsx', 'meta.class.tsx', 'meta.field.declaration.tsx', 'constant.numeric.decimal.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('7; @'))).toEqual(['source.tsx', 'meta.class.tsx', 'meta.field.declaration.tsx', 'constant.numeric.decimal.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('8; }'))).toEqual(['source.tsx', 'meta.class.tsx', 'meta.field.declaration.tsx', 'constant.numeric.decimal.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('{NaN}') + 1)).toContain('constant.language.nan.tsx');
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('throw NaN;') + 6)).toEqual(['source.tsx', 'constant.language.nan.tsx']);
      expect(scopesAt(tsxPack, result, tsxSource.indexOf('...Infinity') + 3)).toEqual(['source.tsx', 'meta.var.expr.tsx', 'meta.array.literal.tsx', 'constant.language.infinity.tsx']);
    } finally { tsxOwner.dispose(); tsxPack.dispose(); }
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
