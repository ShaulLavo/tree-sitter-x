import { expect, it, vi } from 'vitest';
import { loadLanguagePack, nativeLanguage } from '../src/native/packs.ts';
import { Component, NativePack } from '../src/native/component.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeDocument, nativeScopes } from '../src/native/adapter.ts';
import { explainDocument } from '../src/native/evidence.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { roots, usingRoot, decoded, intervals, pathAt, clip, scoped } from './native-javascript-root-controls.ts';
import type { Root } from './native-javascript-root-controls.ts';

it.each(roots)('loads the real experimental $language root', async identity => {
  await usingRoot(identity, 'const answer = 2;', async (pack, owner) => {
    expect(nativeLanguage(identity.language)).toBe(identity.language);
    expect(pack.engine).toMatchObject({ languageId: identity.language, parserLanguageId: 'javascript', abi: '1', packVersion: 'experimental-1' });
    expect(pack.spec).toMatchObject({ rootScope: identity.root, suffix: identity.suffix });
    expect(nativeScopes(pack, owner).status).toBe(0);
    expect((await nativeDocument(pack, owner, 'raw')).status).toBe('complete');
  });
});

// Expected paths below come from the reviewed JS/JSX DEV references. These fresh
// source strings exercise the same grammar roles without becoming scored rows.
it.each(roots)('preserves $language declaration, call, object and template ancestry', async identity => {
  const source = 'import { fetch as grab } from "api";\nexport const store = { size: 7 };\nconst later = (entry = 3) => store.size + entry;\ngrab(later());\nconst caption = `size: ${later(9)}`;\n';
  await usingRoot(identity, source, (pack, owner) => {
    const result = decoded(pack, owner);
    const at = (text: string, names: readonly string[]) => expect(pathAt(pack, result, source.indexOf(text)))
      .toEqual(scoped(identity, names));
    at('fetch', ['meta.import', 'meta.block', 'variable.other.readwrite']);
    at('grab', ['meta.import', 'meta.block', 'variable.other.readwrite.alias']);
    at('store', ['meta.var.expr', 'meta.var-single-variable.expr', 'meta.definition.variable', 'variable.other.constant']);
    at('size:', ['meta.var.expr', 'meta.objectliteral', 'meta.object.member', 'meta.object-literal.key']);
    at('later', ['meta.var.expr', 'meta.var-single-variable.expr', 'meta.definition.variable', 'variable.other.constant', 'entity.name.function']);
    at('entry', ['meta.var.expr', 'meta.arrow', 'meta.parameters', 'variable.parameter']);
    const callee = source.lastIndexOf('later');
    expect(pathAt(pack, result, callee)).toEqual(scoped(identity,
      ['meta.var.expr', 'string.template', 'meta.template.expression', 'meta.embedded.line', 'meta.function-call', 'entity.name.function']));
    for (const window of [{ start: callee, end: callee + 3 }, { start: 0, end: 0 }, { start: source.length, end: source.length }]) clip(pack, owner, result, window);
  });
});

it('keeps repeated JSX ancestors, attribute gaps, entity interiors and plain names ordered', async () => {
  const source = 'const display = <>\n  <Layout.Title title="Hi" data-id={entries.length} {...attrs}>text &amp; {entries.map(v => <i key={v}>{v + 1}</i>)}</Layout.Title>\n  <br />\n</>;';
  await usingRoot(roots[1], source, (pack, owner) => {
    const result = decoded(pack, owner);
    const base = ['source.js.jsx', 'meta.var.expr.js.jsx', 'meta.tag.without-attributes.js.jsx', 'meta.jsx.children.js.jsx', 'meta.tag.js.jsx'];
    expect(pathAt(pack, result, source.indexOf('title='))).toEqual(base.concat(['meta.tag.attributes.js.jsx', 'entity.other.attribute-name.js.jsx']));
    expect(pathAt(pack, result, source.indexOf('entries.length'))).toEqual(base.concat(['meta.tag.attributes.js.jsx', 'meta.embedded.expression.js.jsx', 'variable.other.object.js.jsx']));
    const child = base.concat(['meta.jsx.children.js.jsx']);
    expect(pathAt(pack, result, source.indexOf('&amp;'))).toEqual(child.concat(['constant.character.entity.js.jsx', 'punctuation.definition.entity.js.jsx']));
    expect(pathAt(pack, result, source.indexOf('&amp;') + 2)).toEqual(child.concat(['constant.character.entity.js.jsx']));
    expect(pathAt(pack, result, source.indexOf('&amp;') + 4)).toEqual(child.concat(['constant.character.entity.js.jsx', 'punctuation.definition.entity.js.jsx']));
    const inner = source.indexOf('key=');
    expect(pathAt(pack, result, inner).filter(name => name === 'meta.jsx.children.js.jsx')).toHaveLength(2);
    expect(pathAt(pack, result, source.indexOf('<br') + 3)).toEqual(base.slice(0, 4).concat(['meta.tag.js.jsx', 'meta.tag.attributes.js.jsx']));
    clip(pack, owner, result, { start: inner, end: inner + 2 });
  });
});

const tagNames = [
  { name: 'q7', component: false }, { name: 'Fresh', component: true },
  { name: 'aB', component: true }, { name: '$Card', component: true },
  { name: '_Card', component: true }, { name: 'widget-x', component: true },
  { name: 'UI.Card', component: true },
];
it.each(tagNames)('classifies fresh ASCII tag $name by grammar text rather than a name list', async ({ name, component }) => {
  await usingRoot(roots[1], `const shown = <${name}/>;`, (pack, owner) => {
    const scopes = pathAt(pack, decoded(pack, owner), owner.source.indexOf(name));
    expect(scopes).toEqual(['source.js.jsx', 'meta.var.expr.js.jsx', 'meta.tag.js.jsx', 'entity.name.tag.js.jsx'].concat(component ? ['support.class.component.js.jsx'] : []));
  });
});

it.each(roots)('preserves $language BOM, CRLF and split-surrogate windows', async identity => {
  const source = '\ufeffconst label = "🧭é";\r\nconst shown = `🪵${label}`;\r\n// astral 🌲\r\nshown';
  await usingRoot(identity, source, (pack, owner) => {
    const result = decoded(pack, owner);
    expect(pathAt(pack, result, 0)).toEqual([identity.root]);
    expect(pathAt(pack, result, source.indexOf('//'))).toEqual([identity.root, `comment.line.double-slash${identity.suffix}`, `punctuation.definition.comment${identity.suffix}`]);
    const positions = [0, source.indexOf('🧭') + 1, source.indexOf('é') + 1, source.indexOf('\r'), source.indexOf('\n'), source.indexOf('//') + 1];
    for (const start of positions) clip(pack, owner, result, { start, end: start + 1 });
    expect(intervals(pack, result).filter(row => ['\r\n', '\n'].includes(source.slice(row.from, row.to))).every(row => row.scopes.length === 0)).toBe(true);
    expect(owner.source).toBe(source);
  });
});

it.each(roots)('rejects real crossed $language packs before borrowing or retaining', async identity => {
  const other = roots.find(root => root.language !== identity.language);
  if (!other) throw new Error('Missing crossed root');
  await usingRoot(identity, 'const value = 7;', (_pack, owner) => checkCrossed(identity, other, owner));
});

it.each(roots)('uses the bounded $language newline recovery only for accepted ASCII LF/CRLF shapes', async identity => {
  for (const ending of ['\n', '\r\n']) {
    const source = `const waiting = "unfinished${ending}const result = 90;${ending}`;
    await usingRoot(identity, source, (pack, owner) => {
      const result = decoded(pack, owner), marker = source.indexOf(ending) - 1;
      expect(pathAt(pack, result, marker)).toEqual([identity.root, `meta.var.expr${identity.suffix}`, `string.quoted.double${identity.suffix}`, `invalid.illegal.newline${identity.suffix}`]);
      expect(pathAt(pack, result, source.indexOf('result'))).toEqual(scoped(identity,
        ['meta.var.expr', 'meta.var-single-variable.expr', 'meta.definition.variable', 'variable.other.constant']));
      clip(pack, owner, result, { start: marker, end: marker + ending.length + 1 });
    });
  }
});

const rejectedStrings = ['unfinished', 'unfinished\n  const result = 9;', 'unfinished\\\nconst result = 9;',
  'unfinished\\\r\nconst result = 9;', 'unfinished"\nconst result = 9;', 'unfinished😀\nconst result = 9;',
  'unfinished\t\nconst result = 9;', 'unfinished\rconst result = 9;'];
it.each(rejectedStrings)('does not invent the illegal-newline marker for %j', async tail => {
  await usingRoot(roots[0], `const waiting = "${tail}`, (pack, owner) => {
    expect(intervals(pack, decoded(pack, owner)).some(row => row.scopes.includes('invalid.illegal.newline.js'))).toBe(false);
  });
});

it('recovers the reviewed terminal open call/object/array family with fresh names', async () => {
  const source = 'const unfinished = invoke({ amount: [8, 900,\r\n';
  await usingRoot(roots[0], source, (pack, owner) => {
    const result = decoded(pack, owner);
    expect(pathAt(pack, result, source.indexOf('invoke'))).toEqual(['source.js', 'meta.var.expr.js', 'meta.function-call.js', 'entity.name.function.js']);
    expect(pathAt(pack, result, source.indexOf('900'))).toEqual(['source.js', 'meta.var.expr.js', 'meta.objectliteral.js', 'meta.object.member.js', 'meta.array.literal.js', 'constant.numeric.decimal.js']);
    expect(pathAt(pack, result, source.length - 1)).toEqual([]);
    clip(pack, owner, result, { start: source.indexOf('900'), end: source.indexOf('900') + 1 });
  });
});

it('recovers terminal JSX call and attribute-string shapes without treating string text as code', async () => {
  await usingRoot(roots[1], 'const shown = <Card value={invoke(80,\n', (pack, owner) => {
    const result = decoded(pack, owner);
    expect(pathAt(pack, result, owner.source.indexOf('Card'))).toEqual(['source.js.jsx', 'meta.var.expr.js.jsx', 'meta.tag.js.jsx', 'entity.name.tag.js.jsx', 'support.class.component.js.jsx']);
    expect(pathAt(pack, result, owner.source.indexOf('80'))).toEqual(['source.js.jsx', 'meta.var.expr.js.jsx', 'meta.tag.js.jsx', 'meta.tag.attributes.js.jsx', 'meta.embedded.expression.js.jsx', 'constant.numeric.decimal.js.jsx']);
  });
  await usingRoot(roots[1], 'const shown = <div title="unfinished\n  {value}\n', (pack, owner) => {
    const result = decoded(pack, owner);
    expect(pathAt(pack, result, owner.source.indexOf('{value}'))).toEqual(['source.js.jsx', 'meta.var.expr.js.jsx', 'meta.tag.js.jsx', 'meta.tag.attributes.js.jsx', 'string.quoted.double.js.jsx']);
    expect(pathAt(pack, result, owner.source.indexOf('\n'))).toEqual([]);
  });
});

it.each(roots)('returns whole $language budget failures and stable copied outputs after heap growth', async identity => {
  const source = 'const sample = `🧭${invoke(12)}`;';
  await usingRoot(identity, source, async (pack, owner) => {
    const before = decoded(pack, owner), snapshot = structuredClone(before);
    owner.borrow(pack.sameLanguage, borrowed => {
      expect(pack.run(borrowed, { start: 0, end: source.length }, { maxIntervals: 1 })).toEqual({ status: 2, detail: 23, value: 1 });
      expect(pack.run(borrowed, { start: 0, end: source.length }, { maxSegments: 1 })).toEqual({ status: 2, detail: 24, value: 1 });
    });
    const component = await Component.load(), capacity = component.runtime.heap().length;
    const allocation = component.number('scope_compat_bytes_new', [capacity * 2]);
    try { expect(decoded(pack, owner)).toEqual(snapshot); } finally { component.call('scope_compat_bytes_delete', [allocation]); }
    expect(component.runtime.heap().length).toBeGreaterThan(capacity);
    expect(before).toEqual(snapshot);
    owner.dispose(); pack.dispose();
    expect(before).toEqual(snapshot);
  });
});

const rejectedTails = [
  { identity: roots[0], source: 'const waiting extra = invoke({ amount: [8, 90,' },
  { identity: roots[0], source: 'const waiting = invoke({ amount: [8, 90,]}); const after = 3;' },
  { identity: roots[0], source: 'const waiting = invoke({ amount: [8, 90,\nconst after = 3;' },
  { identity: roots[1], source: 'const shown extra = <Card value={invoke(8,' },
  { identity: roots[1], source: 'const shown = <Card value={invoke(8,)};' },
  { identity: roots[1], source: 'const shown = <Card title="closed">tail</Card>;' },
];
it.each(rejectedTails)('does not recover unrelated bindings, closed tails or later declarations: $source', async ({ identity, source }) => {
  await usingRoot(identity, source, async (pack, owner) => {
    expect((await explainDocument(pack, owner)).filter(row => row.priority === 40)).toEqual([]);
    expect(decoded(pack, owner).status).toBe(0);
  });
});

async function checkCrossed(identity: Root, other: Root, owner: PilotDocument): Promise<void> {
  const crossed = await loadLanguagePack(other.language);
  const borrow = vi.spyOn(PilotDocument.prototype, 'borrow'), retain = vi.spyOn(NativePack.prototype, 'retain');
  try {
    expect(() => nativeScopes(crossed, owner)).toThrow('public language mismatch');
    expect((await nativeDocument(crossed, owner, 'raw')).status).toBe('error');
    await expect(explainDocument(crossed, owner)).rejects.toThrow('public language mismatch');
    expect(() => ScopeSession.attach(owner, new Map([[identity.language, crossed]]))).toThrow('public language mismatch');
    expect(borrow).not.toHaveBeenCalled(); expect(retain).not.toHaveBeenCalled();
  } finally { borrow.mockRestore(); retain.mockRestore(); crossed.dispose(); }
}
