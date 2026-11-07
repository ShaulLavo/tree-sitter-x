import { expect, it, vi } from 'vitest';
import { Component, NativePack } from '../src/native/component.ts';
import { Runtime } from '../src/native/runtime.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeDocument, nativeScopes } from '../src/native/adapter.ts';
import { explainDocument, explainSource } from '../src/native/evidence.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { decodedSnapshot } from '../src/native/scope-output.ts';
import { replayNative } from '../src/native/replay.ts';
import * as packs from '../src/native/packs.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { vendorAssets } from '../src/baselines/assets.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { acquisition } from './native-theme-presentation-controls.ts';

const identities = [
  { language: 'javascript', other: 'jsx', root: 'source.js', suffix: '.js' },
  { language: 'jsx', other: 'javascript', root: 'source.js.jsx', suffix: '.js.jsx' },
] as const;
type Identity = typeof identities[number];

async function diagnosticPack(language: string): Promise<NativePack> {
  const identity = identities.find(item => item.language === language);
  if (!identity) throw new Error('Unexpected diagnostic language');
  return (await Component.load()).loadPack({ id: `identity-control-${language}`, version: 'diagnostic', languageId: language,
    rootScope: identity.root, suffix: identity.suffix, files: [{ path: 'identity-control.scm', query: '(identifier) @variable' }] });
}

async function pair(identity: Identity, action: (owner: PilotDocument, pack: NativePack) => Promise<void>): Promise<void> {
  const pack = await diagnosticPack(identity.language);
  const owner = await PilotDocument.open(identity.language, 'const value = other;');
  try { await action(owner, pack); } finally { owner.dispose(); pack.dispose(); }
}

it('loads JS and JSX through one pinned parser object without collapsing public owners', async () => {
  const runtime = await Runtime.load();
  const [js, jsx] = await Promise.all([runtime.language('javascript'), runtime.language('jsx')]);
  expect(jsx).toBe(js);
  const a = await PilotDocument.open('javascript', 'value'), b = await PilotDocument.open('jsx', 'value');
  try {
    expect(a.languageId).toBe('javascript'); expect(b.languageId).toBe('jsx');
    expect(a.key().epoch).not.toBe(b.key().epoch);
    expect((await a.applyEdits({ base: a.key(), edits: [{ from: 0, to: 5, insert: 'other' }] })).kind).toBe('ready');
    expect(b.source).toBe('value'); expect(b.key().revision).toBe(0);
    expect(a.languageId).toBe('javascript');
  } finally { a.dispose(); b.dispose(); }
});

it.each(identities)('preserves $language pack, explanation and retained output identity', async identity => {
  await pair(identity, async (owner, pack) => {
    const parser = vendorAssets().find(asset => asset.languageId === 'javascript' && asset.kind === 'wasm');
    expect(pack.engine).toMatchObject({ languageId: identity.language, parserLanguageId: 'javascript', parserSha256: parser?.sha256, abi: '1' });
    expect(nativeScopes(pack, owner).status).toBe(0);
    const explanation = await explainDocument(pack, owner);
    expect(explanation.some(item => item.scope === `variable${identity.suffix}`)).toBe(true);
    const retained = await explainSource(pack, identity.language, owner.source.length, action => owner.borrow(pack.sameLanguage, action));
    expect(retained).toEqual(explanation);
    const session = ScopeSession.attach(owner, new Map([[identity.language, pack]]));
    try { checkRetained(session, owner, identity); } finally { session.dispose(); }
    const output = await nativeDocument(pack, owner, 'raw');
    expect(output.languageId).toBe(identity.language); expect(output.status).toBe('complete');
    expect(output.engine).toMatchObject(pack.engine);
  });
});

it.each(identities)('preserves $language identity through actual theme presentation leases', async identity => {
  await pair(identity, async (owner, pack) => { await checkPresentation(owner, pack, identity); });
});

async function checkPresentation(owner: PilotDocument, pack: NativePack, identity: Identity): Promise<void> {
  const session = ScopeSession.attach(owner, new Map([[identity.language, pack]])), presentation = new ThemePresentation(session);
  try {
    const view = session.attachView({ from: 0, to: owner.source.length }); session.flushOne();
    expect((await presentation.select(view, acquisition())).kind).toBe('complete');
    const lease = presentation.acquire(view);
    if (!lease) throw new Error('Missing presentation lease');
    try { checkPresentationIdentity(lease.snapshot, owner, identity); } finally { lease.release(); }
  } finally { presentation.dispose(); session.dispose(); }
}

function checkPresentationIdentity(snapshot: NonNullable<ReturnType<ThemePresentation['acquire']>>['snapshot'], owner: PilotDocument, identity: Identity): void {
  expect(snapshot.key.owner).toEqual(owner.key()); expect(snapshot.scopes.owner).toEqual(owner.key());
  expect(decodedSnapshot(snapshot.scopes).every(interval => interval.scopes[0] === identity.root)).toBe(true);
}

function checkRetained(session: ScopeSession, owner: PilotDocument, identity: Identity): void {
  const view = session.attachView({ from: 0, to: owner.source.length }); session.flushOne();
  expect(session.outcome(view)?.kind).toBe('complete');
  const lease = session.acquire(view);
  if (!lease) throw new Error('Missing retained output');
  try {
    expect(lease.snapshot.owner).toEqual(owner.key());
    expect(decodedSnapshot(lease.snapshot).every(interval => interval.scopes[0] === identity.root)).toBe(true);
  } finally { lease.release(); }
}

const crossedPaths = ['scopes', 'document-explanation', 'retained-explanation', 'session', 'document'] as const;
const crossedCases = identities.flatMap(identity => crossedPaths.map(path => ({ identity, path })));
it.each(crossedCases)('rejects crossed $identity.language through $path before borrowing or retaining', async ({ identity, path }) => {
  await pair(identity, async (owner, pack) => {
    const crossed = await diagnosticPack(identity.other);
    const borrow = vi.spyOn(PilotDocument.prototype, 'borrow'), retain = vi.spyOn(NativePack.prototype, 'retain');
    try {
      await rejectCrossed(owner, crossed, path);
      expect(borrow.mock.calls).toHaveLength(0); expect(retain.mock.calls).toHaveLength(0);
    } finally { borrow.mockRestore(); retain.mockRestore(); crossed.dispose(); }
    expect(nativeScopes(pack, owner).status).toBe(0);
  });
});

async function rejectCrossed(owner: PilotDocument, pack: NativePack, path: typeof crossedPaths[number]): Promise<void> {
  if (path === 'scopes') { expect(() => nativeScopes(pack, owner)).toThrow('public language mismatch'); return; }
  if (path === 'document-explanation') { await expect(explainDocument(pack, owner)).rejects.toThrow('public language mismatch'); return; }
  if (path === 'retained-explanation') {
    await expect(explainSource(pack, owner.languageId, owner.source.length, action => owner.borrow(pack.sameLanguage, action))).rejects.toThrow('public language mismatch'); return;
  }
  if (path === 'session') { expect(() => ScopeSession.attach(owner, new Map([[owner.languageId, pack]]))).toThrow('public language mismatch'); return; }
  const result = await nativeDocument(pack, owner, 'raw');
  expect(result.status).toBe('error'); expect(result.diagnostics.join(' ')).toContain('public language mismatch');
}

it.each(identities)('checks $language at the real owner and low-level scope and explanation borrow seams', async identity => {
  await pair(identity, async (owner, pack) => {
    await checkBorrowSeams(owner, pack, identity);
  });
});

function ignoreBorrow(): void {}

async function checkBorrowSeams(owner: PilotDocument, pack: NativePack, identity: Identity): Promise<void> {
  const crossed = await diagnosticPack(identity.other);
  try {
    expect(() => owner.borrow(crossed.sameLanguage, ignoreBorrow)).toThrow('language mismatch');
    owner.borrow(pack.sameLanguage, borrowed => rejectBorrowed(crossed, borrowed, owner.source.length));
  } finally { crossed.dispose(); }
}

function rejectBorrowed(pack: NativePack, borrowed: Parameters<NativePack['run']>[0], length: number): void {
  expect(() => pack.run(borrowed, { start: 0, end: length })).toThrow('public language mismatch');
  expect(() => pack.explain(borrowed, { start: 0, end: length })).toThrow('public language mismatch');
}

it.each(identities)('guards the real replay path for $language with its experimental pack loader', async identity => {
  const proper = await diagnosticPack(identity.language), crossed = await diagnosticPack(identity.other);
  const loader = vi.spyOn(packs, 'loadLanguagePack').mockResolvedValue(crossed);
  try {
    await expect(Reflect.apply(replayNative, undefined, [{ seed: 1, edits: 2, language: identity.language }])).rejects.toThrow('public language mismatch');
    loader.mockResolvedValue(proper);
    expect(await Reflect.apply(replayNative, undefined, [{ seed: 1, edits: 4, language: identity.language }])).toMatchObject({ complete: 4, revisions: 4, viewportChecks: 4 });
  } finally { loader.mockRestore(); proper.dispose(); crossed.dispose(); }
  const experimental = await packs.loadLanguagePack(identity.language);
  try { expect(experimental.engine.packVersion).toBe('experimental-1'); } finally { experimental.dispose(); }
});

it('grows root availability without growing Markdown fence membership', async () => {
  expect(packs.NATIVE_LANGUAGES).toEqual(['json', 'typescript', 'tsx', 'javascript', 'jsx']);
  const owner = await MarkdownPilotDocument.open(['javascript', 'js', 'jsx', 'node'].map(id => `\`\`\`${id}\nvalue\n\`\`\`\n`).join(''));
  try { expect(owner.children).toHaveLength(0); expect(owner.injectionCoverage.every(item => item.language === null)).toBe(true); }
  finally { owner.dispose(); }
});
