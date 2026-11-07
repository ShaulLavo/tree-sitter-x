import { expect, it } from 'vitest';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { acquired, acquisition, complete, context, observe, reference, stylesAt, theme } from './native-theme-presentation-controls.ts';

it('presents independent themes on two real scope views and releases only the replaced view', async () => {
  const owner = await PilotDocument.open('json', '[1,2]\r\n'), pack = await loadLanguagePack('json');
  const session = ScopeSession.attach(owner, new Map([['json', pack]])), presentation = new ThemePresentation(session);
  try {
    const left = session.attachView({ from: 0, to: 7 }), right = session.attachView({ from: 1, to: 2 }); session.flushOne();
    expect((await presentation.select(left, async () => theme('inheritance'))).kind).toBe('complete');
    expect((await presentation.select(right, async () => theme('inheritance-changed'))).kind).toBe('complete');
    const a = presentation.acquire(left), b = presentation.acquire(right);
    expect(a).toBeDefined(); expect(b).toBeDefined();
    if (a) reference(a, owner.source);
    if (b) reference(b, owner.source, 'inheritance-changed');
    a?.release(); b?.release();
    session.detachView(left); expect(presentation.acquire(left)).toBeUndefined();
    const retained = presentation.acquire(right); expect(retained).toBeDefined(); retained?.release();
    session.detachView(right); expect(session.retainedBytes()).toBe(0);
  } finally { presentation.dispose(); session.dispose(); owner.dispose(); pack.dispose(); }
});

it('keeps old generation-local path zero distinct while retained output survives an edit', async () => {
  const current = await context('json', '1');
  try {
    complete(await current.presentation.select(current.view, acquisition()));
    const old = acquired(current), previous = old.snapshot.scopes;
    await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 0, to: 1, insert: '"x"' }] });
    current.session.request(current.view, { viewport: { from: 0, to: 3 }, theme: 0 }); current.session.flushOne();
    complete(await current.presentation.select(current.view, acquisition()));
    const next = acquired(current), fresh = next.snapshot.scopes;
    expect(previous.dictionary.paths[0]).toBeDefined(); expect(fresh.dictionary.paths[0]).toBeDefined();
    expect(previous.dictionary.paths[0].map(id => previous.dictionary.names[id])).not.toEqual(fresh.dictionary.paths[0].map(id => fresh.dictionary.names[id]));
    expect(fresh.generation).not.toBe(previous.generation); expect(fresh.owner.revision).not.toBe(previous.owner.revision);
    reference(old, '1'); reference(next, '"x"');
    old.release(); reference(next, '"x"'); next.release();
  } finally { current.dispose(); }
});

it.each([
  '- item\n\n  ```json\n  1\n  ```\n', '> ```json\n> 1\n> ```\n', '```unknown\n1\n```\n', '```\n1\n```\n',
])('preserves explicit outer-only Markdown coverage during theme presentation: %s', async source => {
  const current = await context('markdown', source);
  try {
    complete(await current.presentation.select(current.view, acquisition()));
    const output = acquired(current), scope = current.session.acquireFull(current.view);
    expect(output.snapshot.scopes.injections).toEqual(scope?.snapshot.injections);
    expect(output.snapshot.scopes.diagnostics).toEqual(scope?.snapshot.diagnostics);
    expect(output.snapshot.scopes.injections.some(item => item.reason !== null)).toBe(true);
    reference(output, source); output.release(); scope?.release();
  } finally { current.dispose(); }
});

it.each(['', '\r', '\n', '\r\n', '"😀"\r\n'])('presents exact source/metadata and separators for %j', async source => {
  const current = await context('json', source);
  try { complete(await current.presentation.select(current.view, acquisition())); const output = acquired(current); reference(output, source); output.release(); }
  finally { current.dispose(); }
});

it.each([
  ['json', '[1,2]\r\n'], ['typescript', 'const value = "😀";\r\n'], ['tsx', 'const v = <p>😀</p>;\n'],
  ['markdown', '```typescript\nconst a = 1\n```\n```json\n{"a":1}\n```\n'],
])('arms actual %s observers then presents A/B/changed-A with no parse, classify or resolver calls', async (language, source) => {
  const observer = await observe(), current = await context(language, source);
  try {
    expect(observer.read().parse).toBeGreaterThan(0); expect(observer.read().classify).toBeGreaterThan(0);
    if (language === 'markdown') expect(observer.read().resolver).toBeGreaterThan(0);
    const scope = current.session.acquire(current.view);
    if (!scope) throw new Error('Unarmed scopes');
    const before = JSON.stringify(scope.snapshot), generation = scope.snapshot.generation, work = scope.snapshot.work;
    observer.reset();
    for (const id of ['inheritance', 'empty-light', 'inheritance-changed']) {
      expect((await current.presentation.select(current.view, acquisition(id))).kind).toBe('complete');
      const output = acquired(current); reference(output, source, id);
      expect(output.snapshot.key.generation).toBe(generation); expect(output.snapshot.key.work).toEqual(work); output.release();
    }
    expect(observer.read()).toEqual({ parse: 0, classify: 0, resolver: 0 });
    expect(JSON.stringify(scope.snapshot)).toBe(before); expect(current.owner.source).toBe(source); scope.release();
  } finally { current.dispose(); observer.restore(); }
});

it.each(['raw', 'product'] as const)('keeps same-name root/include changes and %s field sets independent', async profile => {
  const current = await context();
  try {
    const revisions = new Set<string>();
    for (const id of ['inheritance', 'inheritance-changed', 'included', 'included-changed']) {
      const result = complete(await current.presentation.select(current.view, acquisition(id, profile)));
      revisions.add(result.key.themeRevision); const output = acquired(current); reference(output, current.owner.source, id, profile); output.release();
    }
    expect(revisions.size).toBe(4);
  } finally { current.dispose(); }
});

it('builds full styles before clipping CRLF, astral, empty and deterministic windows', async () => {
  const source = 'const value = "😀";\r\nconst second = 1;\n', current = await context('typescript', source);
  try {
    await current.presentation.select(current.view, async () => theme());
    const full = acquired(current);
    for (let turn = 0; turn < 40; turn++) {
      const from = turn % 5 === 0 ? source.indexOf('\r') + turn % 2 : turn * 17 % (source.length + 1);
      const to = Math.min(source.length, from + turn % 13), view = current.session.attachView({ from, to }); current.session.flushOne();
      expect((await current.presentation.select(view, acquisition())).kind).toBe('complete');
      const window = acquired(current, view); reference(window, source);
      expect(stylesAt(window, from, to)).toEqual(stylesAt(full, from, to));
      window.release(); current.session.detachView(view);
    }
    full.release();
  } finally { current.dispose(); }
});
