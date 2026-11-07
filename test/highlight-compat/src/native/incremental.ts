import { PilotDocument } from './owner.ts';
import { MarkdownPilotDocument } from './markdown.ts';
import { NativeScopeError } from './component.ts';
import type { NativePack } from './component.ts';
import { integer } from './edit-batch.ts';
import type { TextSpan } from './edit-batch.ts';
import { counter, sameOwner, sameWork } from './owner-state.ts';
import type { OwnerKey, WorkKey, ViewId, InterestGeneration, ThemeGeneration } from './owner-state.ts';
import { packIntervals, clipSnapshot, OutputStore, OutputBudgetError } from './scope-output.ts';
import type { ScopeLease, ScopeSnapshot, Publication } from './scope-output.ts';
import type { ScopeInterval } from '../baselines/compose.ts';
export type ScopeOwner = PilotDocument | MarkdownPilotDocument;
export interface ScopeLimits {
  readonly views: number; readonly descriptors: number; readonly depth: number;
  readonly matchLimit: number; readonly maxIntervals: number; readonly maxSegments: number; readonly retainedBytes: number;
}
export const DEFAULT_SCOPE_LIMITS: ScopeLimits = Object.freeze({ views: 16, descriptors: 128, depth: 16,
  matchLimit: 65536, maxIntervals: 262144, maxSegments: 262144, retainedBytes: 64 * 1024 * 1024 });
export type ScopeOutcome = Readonly<{ kind: 'complete'; work: WorkKey }>
  | Readonly<{ kind: 'incomplete'; work: WorkKey; reason: 'unsupported' | 'budget' | 'invalid' | 'no-memory' | 'owner-unavailable'; diagnostic: string }>
  | Readonly<{ kind: 'canceled' | 'discarded'; work: WorkKey; reason: string }>;
interface View {
  readonly id: ViewId; interest: InterestGeneration; theme: ThemeGeneration; viewport: TextSpan; wants: boolean;
  last: Extract<Publication['change'], { kind: 'replace' }> | undefined;
  output: ScopeLease | undefined; outcome: ScopeOutcome | undefined;
}
interface Work { readonly key: WorkKey; canceled: boolean; readonly interests: ReadonlyMap<ViewId, InterestGeneration>; readonly progress: { next: number; intervals: ScopeInterval[]; bytes: number } }
class ScopeFailure extends Error {
  readonly reason: 'unsupported' | 'budget' | 'invalid' | 'no-memory';
  constructor(reason: ScopeFailure['reason'], diagnostic: string) { super(diagnostic); this.reason = reason; }
}
export class ScopeSession {
  static readonly #attached = new WeakSet<ScopeOwner>();
  readonly #owner: ScopeOwner;
  readonly #packs: ReadonlyMap<string, NativePack>;
  readonly #limits: ScopeLimits;
  readonly #outputs: OutputStore;
  readonly #releasePacks: (() => void)[] = [];
  readonly #unsubscribe: () => void;
  readonly #views = new Map<ViewId, View>();
  #cache: ScopeLease | undefined;
  #pending: OwnerKey | undefined;
  #active: Work | undefined;
  #disposed = false;
  #viewId = 0;
  #request = 0;
  #generation = 0;
  private constructor(owner: ScopeOwner, packs: ReadonlyMap<string, NativePack>, limits: ScopeLimits) {
    for (const value of Object.values(limits)) { integer(value, 0xffffffff); if (!value) throw new RangeError('Scope limit must be positive'); }
    this.#owner = owner; this.#packs = new Map(packs); this.#limits = Object.freeze({ ...limits }); this.#outputs = new OutputStore(limits.retainedBytes);
    try { for (const pack of new Set(packs.values())) this.#releasePacks.push(pack.retain()); }
    catch (error) { this.releasePacks(); throw error; }
    this.#unsubscribe = owner.onCommit(() => this.invalidate());
  }
  static attach(owner: ScopeOwner, packs: ReadonlyMap<string, NativePack>, limits: ScopeLimits = DEFAULT_SCOPE_LIMITS): ScopeSession {
    if (owner.observe().kind === 'closed') throw new Error('Closed scope owner');
    if (ScopeSession.#attached.has(owner)) throw new Error('Scope session already attached');
    const session = new ScopeSession(owner, packs, limits); ScopeSession.#attached.add(owner); return session;
  }
  attachView(viewport: TextSpan): ViewId {
    this.open(); this.viewport(viewport);
    if (this.#views.size >= this.#limits.views) throw new RangeError('Scope view limit');
    const id = counter<'ViewId'>(++this.#viewId);
    this.#views.set(id, { id, viewport: Object.freeze({ ...viewport }), interest: counter<'InterestGeneration'>(1), theme: counter<'ThemeGeneration'>(0), wants: true, last: undefined, output: undefined, outcome: undefined });
    this.#pending = this.#owner.key(); return id;
  }
  request(id: ViewId, input: Readonly<{ viewport: TextSpan; theme: number }>): InterestGeneration {
    this.open(); this.viewport(input.viewport);
    const theme = counter<'ThemeGeneration'>(input.theme), view = this.view(id);
    const interest = counter<'InterestGeneration'>(view.interest + 1);
    view.viewport = Object.freeze({ ...input.viewport }); view.theme = theme; view.interest = interest; view.wants = true; view.outcome = undefined;
    this.#pending = this.#owner.key(); return interest;
  }
  cancel(id: ViewId, interest: InterestGeneration): void {
    const view = this.#views.get(id);
    if (!view || view.interest !== interest) return;
    view.wants = false;
    view.outcome = { kind: 'canceled', work: this.#active?.key ?? this.workKey(this.#owner.key()), reason: 'explicit' };
    if (!this.interested()) { this.cancelActive(); this.#pending = undefined; }
  }
  detachView(id: ViewId): void {
    const view = this.#views.get(id); if (!view) return;
    view.output?.release(); this.#views.delete(id);
    if (this.#views.size) return;
    this.cancelActive();
    this.#pending = undefined; this.#cache?.release(); this.#cache = undefined;
  }
  acquire(id: ViewId): ScopeLease | undefined {
    const output = this.#views.get(id)?.output;
    return output ? this.#outputs.retain(output.snapshot, output.publication) : undefined;
  }
  outcome(id: ViewId): ScopeOutcome | undefined { return this.#views.get(id)?.outcome; }
  retainedBytes(): number { return this.#outputs.bytes() + (this.#active?.progress.bytes ?? 0); }
  flushOne(): void {
    if (this.#disposed) return;
    const work = this.#active ?? this.dispatch();
    if (!work) return;
    let finished = true;
    try { finished = this.run(work); }
    finally {
      if (finished) this.finishWork(work);
    }
  }
  private finishWork(work: Work): void {
    if (!this.#active || !sameWork(this.#active.key, work.key)) return;
    this.#active = undefined;
    if (this.#pending && sameOwner(this.#pending, work.key)) this.#pending = undefined;
  }
  private dispatch(): Work | undefined {
    if (!this.#pending || !this.interested() || this.#owner.observe().kind === 'updating') return undefined;
    const work: Work = { key: this.workKey(this.#owner.key()), canceled: false, interests: new Map(Array.from(this.#views.values(), view => [view.id, view.interest])), progress: { next: 0, intervals: [], bytes: 0 } };
    this.#request = work.key.request; this.#active = work; this.#pending = undefined; return work;
  }
  private run(work: Work): boolean {
    const kind = this.#owner.observe().kind;
    if (kind !== 'ready') { this.failure(work, 'owner-unavailable', `Owner ${kind}`); return true; }
    if (!this.current(work)) { this.terminal(work); return true; }
    try {
      let snapshot = this.#cache?.snapshot;
      if (!snapshot || !sameOwner(snapshot.owner, work.key)) snapshot = this.advance(work);
      if (!snapshot) return false;
      if (!this.current(work)) { this.terminal(work); return true; }
      if (!this.#cache || this.#cache.snapshot !== snapshot) {
        this.#cache?.release(); this.#cache = undefined; this.#cache = this.#outputs.retain(snapshot);
      }
      work.progress.intervals = []; work.progress.bytes = 0;
      for (const view of this.#views.values()) this.publish(view, work, snapshot);
      return true;
    } catch (error) {
      if (!this.current(work)) { this.terminal(work); return true; }
      const diagnostic = error instanceof Error ? error.message : String(error);
      const reason = (error instanceof ScopeFailure || error instanceof NativeScopeError) ? error.reason : /budget/i.test(diagnostic) ? 'budget' : /allocation failed/.test(diagnostic) ? 'no-memory' : 'invalid';
      this.failure(work, reason, diagnostic); return true;
    }
  }
  private advance(work: Work): ScopeSnapshot | undefined {
    const owner = this.#owner;
    if (owner instanceof PilotDocument) return this.compute(work, this.rootIntervals(owner));
    if (owner.injectionCoverage.length > this.#limits.descriptors) throw new ScopeFailure('unsupported', 'Injection descriptor limit');
    const progress = work.progress, count = owner.children.length;
    if (progress.next < count) {
      const intervals = owner.scopeChild(progress.next++, this.#packs, this.#limits);
      const bytes = intervals.reduce((sum, interval) => sum + 16 + interval.scopes.reduce((n, name) => n + 8 + name.length * 2, 0), 0);
      if (this.retainedBytes() + bytes > this.#limits.retainedBytes) throw new ScopeFailure('budget', 'Partial child scope byte budget');
      if (progress.intervals.length + intervals.length > this.#limits.maxSegments) throw new ScopeFailure('budget', 'Partial child segment budget');
      for (const interval of intervals) progress.intervals.push(interval);
      progress.bytes += bytes;
    }
    if (progress.next < count) return undefined;
    return this.compute(work, owner.composeScopes(progress.intervals));
  }
  private compute(work: Work, intervals: readonly ScopeInterval[]): ScopeSnapshot {
    if (intervals.length > this.#limits.maxSegments) throw new ScopeFailure('budget', 'Composed scope segment budget');
    const packed = packIntervals(intervals, this.#owner.source.length);
    const owner = this.#owner;
    const injections = owner instanceof MarkdownPilotDocument ? owner.injectionCoverage : [];
    return Object.freeze({ ...packed, owner: owner.key(), work: work.key, generation: counter<'ResultGeneration'>(++this.#generation),
      coverage: Object.freeze({ from: 0, to: owner.source.length }), sourceLength: owner.source.length, metadata: null,
      injections: Object.freeze(injections), diagnostics: Object.freeze(owner instanceof MarkdownPilotDocument ? Array.from(owner.diagnostics) : []) });
  }
  private rootIntervals(owner: PilotDocument): readonly ScopeInterval[] {
    const pack = this.#packs.get(owner.languageId);
    if (!pack) throw new ScopeFailure('unsupported', `Missing native pack ${owner.languageId}`);
    const result = owner.borrow(pack.sameLanguage, borrowed => pack.run(borrowed, { start: 0, end: owner.source.length }, this.#limits));
    if (result.status !== 0) throw new NativeScopeError(result.status, result.detail);
    return Array.from({ length: result.segments.length / 3 }, (_, index) => ({ from: result.segments[index * 3], to: result.segments[index * 3 + 1], scopes: result.paths[result.segments[index * 3 + 2]].map(id => pack.scopes[id]) }));
  }
  private publish(view: View, work: Work, full: ScopeSnapshot): void {
    if (!view.wants || !this.current(work)) return;
    if (view.viewport.to > full.sourceLength) { view.outcome = { kind: 'incomplete', work: work.key, reason: 'invalid', diagnostic: 'Viewport outside current source' }; return; }
    const before = view.output;
    const publication: Publication = Object.freeze({ view: view.id, interest: view.interest, theme: view.theme, viewport: view.viewport,
      change: view.last ?? Object.freeze({ kind: 'reset' }) });
    const clipped = clipSnapshot(full, view.viewport);
    view.output = undefined; before?.release();
    try { view.output = this.#outputs.retain(clipped, publication); }
    catch (error) {
      if (!(error instanceof OutputBudgetError)) throw error;
      view.outcome = { kind: 'incomplete', work: work.key, reason: 'budget', diagnostic: error.message }; return;
    }
    view.last = Object.freeze({ kind: 'replace', old: clipped.owner, generation: clipped.generation, coverage: clipped.coverage });
    view.outcome = { kind: 'complete', work: work.key };
  }
  private current(work: Work): boolean {
    return !this.#disposed && !work.canceled && this.interested() && this.#owner.observe().kind === 'ready' && sameOwner(this.#owner.key(), work.key) && !!this.#active && sameWork(this.#active.key, work.key);
  }
  private terminal(work: Work): void {
    const kind = !sameOwner(this.#owner.key(), work.key) ? 'discarded' : 'canceled';
    for (const view of this.#views.values()) {
      if (!view.wants || work.interests.get(view.id) !== view.interest) continue;
      if (view.outcome && view.outcome.work.request > work.key.request) continue;
      view.outcome = { kind, work: work.key, reason: kind === 'discarded' ? 'stale-owner' : 'superseded' };
    }
  }
  private failure(work: Work, reason: Extract<ScopeOutcome, { kind: 'incomplete' }>['reason'], diagnostic: string): void {
    for (const view of this.#views.values()) { if (view.wants) view.outcome = { kind: 'incomplete', work: work.key, reason, diagnostic: diagnostic.slice(0, 1024) }; }
  }
  private invalidate(): void {
    this.cancelActive();
    this.#cache?.release(); this.#cache = undefined;
    for (const view of this.#views.values()) { view.output?.release(); view.output = undefined; }
    this.#pending = this.interested() ? this.#owner.key() : undefined;
    if (this.#owner.observe().kind === 'closed') this.dispose();
  }
  private workKey(key: OwnerKey): WorkKey { return Object.freeze({ ...key, request: counter<'RequestId'>(this.#request + 1) }); }
  private interested(): boolean { for (const view of this.#views.values()) { if (view.wants) return true; } return false; }
  private viewport(span: TextSpan): void {
    integer(span.from, this.#owner.source.length); integer(span.to, this.#owner.source.length);
    if (span.from > span.to) throw new RangeError('Reversed viewport');
  }
  private open(): void { if (this.#disposed) throw new Error('Disposed scope session'); }
  private view(id: ViewId): View { const view = this.#views.get(id); if (!view) throw new Error('Unknown scope view'); return view; }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true; ScopeSession.#attached.delete(this.#owner); this.#unsubscribe();
    this.cancelActive();
    for (const id of this.#views.keys()) this.detachView(id);
    this.#cache?.release(); this.#cache = undefined; this.#pending = undefined;
    this.releasePacks();
  }
  private cancelActive(): void { if (this.#active) this.#active.canceled = true; this.#active = undefined; }
  private releasePacks(): void { for (const release of this.#releasePacks.splice(0)) release(); }
}
