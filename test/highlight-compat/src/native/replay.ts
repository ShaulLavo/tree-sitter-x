import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PilotDocument } from './owner.ts';
import { MarkdownPilotDocument } from './markdown.ts';
import { loadLanguagePack } from './packs.ts';
import { ScopeSession } from './incremental.ts';
import type { ScopeOwner } from './incremental.ts';
import { decodedSnapshot, packIntervals } from './scope-output.ts';
import type { InjectionCoverage } from './scope-output.ts';
import { nativeScopes } from './adapter.ts';
import type { NativePack } from './component.ts';
import type { Edit, TextSpan } from './edit-batch.ts';
import { integer } from './edit-batch.ts';
import type { ScopeInterval } from '../baselines/compose.ts';
export interface ReplayOptions { readonly seed: number; readonly edits: number; readonly language: 'json' | 'typescript' | 'tsx' | 'markdown' }
export class ReplayFailure extends Error {
  readonly reproduction: Readonly<Record<string, unknown>>;
  constructor(reproduction: Readonly<Record<string, unknown>>) { super(`Native replay mismatch: ${JSON.stringify(reproduction)}`); this.reproduction = reproduction; }
}
async function open(language: ReplayOptions['language'], source: string): Promise<ScopeOwner> {
  return language === 'markdown' ? MarkdownPilotDocument.open(source) : PilotDocument.open(language, source);
}
function initial(language: ReplayOptions['language']): string {
  if (language === 'markdown') return '# Replay\r\n```typescript\nconst value = JSON;\n```\n```json\n{"x":1}\n```\n';
  if (language === 'json') return '\ufeff{"value":[1,true,"😀"]}\r\n';
  return language === 'tsx' ? 'const view = <div>{JSON.stringify("😀")}</div>;\r\n' : '\ufeffconst value = JSON;\r\nconst text = "😀é";\n';
}
function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value; };
}
function batch(source: string, step: number, next: () => number, language: ReplayOptions['language']): readonly Edit[] {
  if (language === 'markdown' && step % 4 === 0) {
    const variants = ['```json\n{"x":2}\n```\n', 'before\r\n```tsx\n<div/>\n```\n', '```unknown\na\n```\n', '```typescript\nconst VALUE = Math;\n```\n', '> ```json\n> 1\n> ```\n'];
    return [{ from: 0, to: source.length, insert: variants[next() % variants.length] }];
  }
  const inserts = ['', 'JSON', 'Math', 'VALUE', 'value', '"', '`', '/*', '*/', '\n', '\r\n', '\r', '\ud83d', '\ude00', '😀', 'é', '\t', ' ', '```', '<div/>'];
  const from = next() % (source.length + 1), to = Math.min(source.length, from + next() % 4);
  const edit = { from, to, insert: inserts[next() % inserts.length] };
  if (step % 5 !== 0 || from === 0) return [edit];
  return [{ from: 0, to: 0, insert: ' ' }, edit];
}
function canonical(intervals: readonly ScopeInterval[], length: number): readonly ScopeInterval[] {
  const packed = packIntervals(intervals, length);
  return Array.from({ length: packed.segments.length / 3 }, (_, i) => ({ from: packed.segments[i * 3], to: packed.segments[i * 3 + 1], scopes: packed.dictionary.paths[packed.segments[i * 3 + 2]].map(id => packed.dictionary.names[id]) }));
}
function clip(intervals: readonly ScopeInterval[], viewport: TextSpan): readonly ScopeInterval[] {
  return intervals.flatMap(item => { const from = Math.max(viewport.from, item.from), to = Math.min(viewport.to, item.to); return from < to ? [{ ...item, from, to }] : []; });
}
function freshOutput(owner: ScopeOwner, packs: ReadonlyMap<string, NativePack>): { intervals: readonly ScopeInterval[]; injections: readonly InjectionCoverage[]; diagnostics: readonly string[]; metadata: null } {
  if (owner instanceof MarkdownPilotDocument) return { intervals: canonical(owner.intervals(packs), owner.source.length), injections: owner.injectionCoverage, diagnostics: owner.diagnostics, metadata: null };
  const pack = packs.get(owner.languageId);
  if (!pack) throw new Error('Missing replay pack');
  const result = nativeScopes(pack, owner);
  if (result.status !== 0) throw new Error(`Fresh native incomplete ${result.status}`);
  const intervals = Array.from({ length: result.segments.length / 3 }, (_, i) => ({ from: result.segments[i * 3], to: result.segments[i * 3 + 1], scopes: result.paths[result.segments[i * 3 + 2]].map(id => pack.scopes[id]) }));
  return { intervals: canonical(intervals, owner.source.length), injections: [], diagnostics: [], metadata: null };
}
export async function replayNative(options: ReplayOptions): Promise<Readonly<{ seed: number; revisions: number; viewportChecks: number; complete: number; outerOnly: number }>> {
  integer(options.seed, 0xffffffff); integer(options.edits, 1024);
  const packs = new Map<string, NativePack>(), next = random(options.seed), history: string[] = [];
  let owner: ScopeOwner | undefined, session: ScopeSession | undefined, complete = 0, outerOnly = 0;
  try {
    for (const language of options.language === 'markdown' ? ['json', 'typescript', 'tsx'] : [options.language]) packs.set(language, await loadLanguagePack(language));
    owner = await open(options.language, initial(options.language)); session = ScopeSession.attach(owner, packs);
    const fullView = session.attachView({ from: 0, to: owner.source.length }), windowView = session.attachView({ from: 0, to: 0 });
    for (let step = 0; step < options.edits; step++) {
      const before = owner.source;
      const edits = step % 8 === 7 && history.length ? [{ from: 0, to: before.length, insert: history.pop() ?? '' }] : batch(before, step, next, options.language);
      if (step % 8 !== 7) history.push(before);
      const outcome = await owner.applyEdits({ base: owner.key(), edits });
      if (outcome.kind !== 'ready') throw new ReplayFailure({ ...options, step, edits, before, outcome });
      const a = next() % (owner.source.length + 1), b = next() % (owner.source.length + 1), viewport = { from: Math.min(a, b), to: Math.max(a, b) };
      session.request(fullView, { viewport: { from: 0, to: owner.source.length }, theme: step }); session.request(windowView, { viewport, theme: step + 1 });
      flushCurrent(session, owner);
      outerOnly += await verifyStep({ owner, session, packs, fullView, windowView, options, step, viewport, before, edits }); complete++;
    }
    return Object.freeze({ seed: options.seed, revisions: options.edits, viewportChecks: options.edits, complete, outerOnly });
  } finally { session?.dispose(); owner?.dispose(); for (const pack of packs.values()) pack.dispose(); }
}
function flushCurrent(session: ScopeSession, owner: ScopeOwner): void {
  const turns = owner instanceof MarkdownPilotDocument ? owner.children.length + 1 : 1;
  for (let turn = 0; turn < turns; turn++) session.flushOne();
}

interface VerifyStep {
  readonly owner: ScopeOwner; readonly session: ScopeSession; readonly packs: ReadonlyMap<string, NativePack>;
  readonly fullView: Parameters<ScopeSession['acquire']>[0]; readonly windowView: Parameters<ScopeSession['acquire']>[0];
  readonly options: ReplayOptions; readonly step: number; readonly viewport: TextSpan; readonly before: string; readonly edits: readonly Edit[];
}
async function verifyStep(input: VerifyStep): Promise<number> {
  const { owner, session, packs, options, step, viewport, before, edits } = input;
  const fresh = await open(options.language, owner.source);
  const full = session.acquire(input.fullView), window = session.acquire(input.windowView);
  try {
    const expected = freshOutput(fresh, packs);
    const actual = full ? { intervals: decodedSnapshot(full.snapshot), injections: full.snapshot.injections, diagnostics: full.snapshot.diagnostics, metadata: full.snapshot.metadata } : null;
    const clipped = window ? decodedSnapshot(window.snapshot) : null;
    const expectedCoverage = expected.injections.flatMap(item => { const from = Math.max(viewport.from, item.from), to = Math.min(viewport.to, item.to); return from < to ? [{ ...item, from, to }] : []; });
    if (!isDeepStrictEqual(actual, expected) || !isDeepStrictEqual(clipped, clip(expected.intervals, viewport)) || !isDeepStrictEqual(window?.snapshot.injections, expectedCoverage) || window?.snapshot.metadata !== null) throw new ReplayFailure({ ...options, step, revision: owner.key().revision, viewport,
      sourceDigest: createHash('sha256').update(owner.source, 'utf16le').digest('hex'), before, edits, expected, actual, clipped, firstRange: firstRange(actual?.intervals ?? [], expected.intervals), outcome: session.outcome(input.fullView) });
    return Number(expected.diagnostics.length > 0);
  } finally { full?.release(); window?.release(); fresh.dispose(); }
}

function firstRange(actual: readonly ScopeInterval[], expected: readonly ScopeInterval[]): unknown {
  const index = expected.findIndex((item, i) => !isDeepStrictEqual(item, actual[i]));
  return { index, actual: actual[index] ?? null, expected: expected[index] ?? null };
}
