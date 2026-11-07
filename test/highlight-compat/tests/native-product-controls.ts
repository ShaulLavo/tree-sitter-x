import { PilotDocument } from '../src/native/owner.ts';
import { MarkdownPilotDocument } from '../src/native/markdown.ts';
import { ScopeSession, DEFAULT_SCOPE_LIMITS } from '../src/native/incremental.ts';
import type { ScopeLimits } from '../src/native/incremental.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import type { NativePack } from '../src/native/component.ts';
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts';
import type { Outcome, Profile } from '../src/native/theme-contract.ts';
import type { ScopeLease, ScopeSnapshot } from '../src/native/scope-output.ts';
import type { ViewId } from '../src/native/owner-state.ts';

export const product = 'future010-product-lines-v1';
export function value<T>(result: Outcome<T>): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result));
  return result.value;
}
export function theme(foreground = '#102030', profile: Profile = 'product') {
  const input = value(snapshotInput({
    root: 'authored', edges: [], resources: [{
      id: 'authored', format: 'json', bytes: new TextEncoder().encode(JSON.stringify({
        name: 'same name', tokenColors: [{ settings: { foreground, background: '#fafafa', fontStyle: '' } },
        { scope: 'source', settings: { foreground: '#aabbcc', fontStyle: 'bold' } }],
      }))
    }]
  }));
  return normalizeTheme(input, profile, 'authored-framing-contract');
}
export async function context(source: string, limits: Partial<ScopeLimits> = {}, markdown = false) {
  const packs = new Map<string, NativePack>();
  try {
    for (const id of markdown ? ['json', 'typescript', 'tsx'] : ['typescript']) packs.set(id, await loadLanguagePack(id));
    return await attach(source, packs, limits, markdown);
  } catch (error) { disposePacks(packs); throw error; }
}
async function attach(source: string, packs: Map<string, NativePack>, limits: Partial<ScopeLimits>, markdown: boolean) {
  const owner = markdown ? await MarkdownPilotDocument.open(source) : await PilotDocument.open('typescript', source);
  try {
    const session = ScopeSession.attach(owner, packs, { ...DEFAULT_SCOPE_LIMITS, ...limits }), presentation = new ThemePresentation(session);
    const view = session.attachView({ from: 0, to: source.length }); flush(session, owner);
    return { owner, packs, session, presentation, view, dispose: () => dispose(presentation, session, owner, packs) };
  } catch (error) { owner.dispose(); throw error; }
}
function dispose(presentation: ThemePresentation, session: ScopeSession, owner: PilotDocument | MarkdownPilotDocument, packs: Map<string, NativePack>): void {
  try { presentation.dispose(); } finally { session.dispose(); owner.dispose(); disposePacks(packs); }
}
function disposePacks(packs: Map<string, NativePack>): void { for (const pack of packs.values()) pack.dispose(); }
export function resources() {
  const releases: (() => void)[] = [];
  return {
    defer(release: () => void): void { releases.push(release); },
    hold<T extends { release(): void }>(resource: T): T { releases.push(() => resource.release()); return resource; },
    watch<T extends { mockRestore(): void }>(spy: T): T { releases.push(() => spy.mockRestore()); return spy; },
    release(): void { for (const release of releases.reverse()) release(); releases.length = 0; },
  };
}
export function flush(session: ScopeSession, owner: PilotDocument | MarkdownPilotDocument): void {
  for (let turn = 0; turn <= (owner instanceof MarkdownPilotDocument ? owner.children.length : 0); turn++) session.flushOne();
}
export function full(current: Awaited<ReturnType<typeof context>>, view: ViewId = current.view): ScopeLease {
  const result = current.session.acquireFull(view);
  if (!result) throw new Error(JSON.stringify(current.session.outcome(view)));
  return result;
}
export function styled(current: Awaited<ReturnType<typeof context>>, view: ViewId = current.view) {
  const result = current.presentation.acquire(view);
  if (!result) throw new Error('Missing presentation');
  return result;
}
export function pathAt(snapshot: ScopeSnapshot, offset: number): readonly string[] {
  const index = snapshot.segments.findIndex((from, i) => i % 3 === 0 && from <= offset && offset < snapshot.segments[i + 1]);
  if (index < 0) throw new Error('Missing covered unit');
  return snapshot.dictionary.paths[snapshot.segments[index + 2]].map(id => snapshot.dictionary.names[id]);
}
export function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Uninitialized deferred'); };
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
