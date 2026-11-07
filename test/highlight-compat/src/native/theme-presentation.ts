import type { ScopeSession } from './incremental.ts';
import type { ViewId } from './owner-state.ts';
import type { NormalizedTheme } from './theme-input.ts';
import type { CompileLimits, Failure, InputLimits, OperationalFailure, Outcome, ResolveLimits } from './theme-contract.ts';
import { attempt, limits, reject, COMPILE_DEFAULTS, INPUT_DEFAULTS, RESOLVE_DEFAULTS } from './theme-contract.ts';
import { NativeTheme } from './theme.ts';
import { ThemeCache, clipStyles } from './theme-cache.ts';
import type { StyleRun, ThemePair } from './theme-cache.ts';
import { clipSnapshot, OutputBudgetError } from './scope-output.ts';
import type { FramingPolicy, ScopeLease, ScopeSnapshot, Publication } from './scope-output.ts';

export interface PresentationKey {
  readonly owner: ScopeSnapshot['owner']; readonly generation: ScopeSnapshot['generation']; readonly work: ScopeSnapshot['work'];
  readonly view: Publication; readonly themeRevision: string; readonly profile: NormalizedTheme['profile'];
  readonly framing: FramingPolicy;
}
export interface StyleSnapshot { readonly key: PresentationKey; readonly scopes: ScopeSnapshot; readonly runs: readonly StyleRun[]; readonly metadata: null }
export interface PresentationLease { readonly snapshot: StyleSnapshot; retain(): PresentationLease; release(): void }
export type PresentationOutcome = Readonly<{ kind: 'complete'; key: PresentationKey }> | Failure | OperationalFailure
  | Readonly<{ kind: 'unavailable'; reason: 'scope-not-current' | 'closed' }>
  | Readonly<{ kind: 'canceled' | 'discarded' }> | Readonly<{ kind: 'incomplete'; reason: 'budget' }>;
export interface PresentationOptions {
  readonly framing?: FramingPolicy;
  readonly signal?: AbortSignal; readonly compile?: Partial<CompileLimits>; readonly input?: Partial<InputLimits>; readonly resolve?: Partial<ResolveLimits>;
}
interface Request {
  readonly view: ViewId; readonly scope: ScopeLease; readonly options: PresentationOptions;
  canceled: boolean; released: boolean;
}
class Output {
  #references = 0;
  #pair: ThemePair | undefined;
  readonly #releaseBytes: () => void;
  #snapshot: StyleSnapshot | undefined;
  constructor(pair: ThemePair, key: PresentationKey) {
    const scopes = clipSnapshot(pair.snapshot, key.view.viewport), runs = clipStyles(pair.runs, key.view.viewport);
    this.#releaseBytes = pair.reserve(runs.length * 24 + scopes.segments.length * 8 + scopes.injections.length * 32 + 128);
    this.#pair = pair; this.#snapshot = Object.freeze({ key, scopes, runs, metadata: null });
  }
  retain(): PresentationLease {
    if (!this.#snapshot) throw new Error('Released presentation output');
    this.#references++; let held: StyleSnapshot | undefined = this.#snapshot;
    return Object.freeze({ get snapshot() { if (!held) throw new Error('Released presentation lease'); return held; },
      retain: () => { if (!held) throw new Error('Released presentation lease'); return this.retain(); }, release: () => {
        if (!held) return; held = undefined;
        if (--this.#references) return;
        this.release();
      } });
  }
  private release(): void {
    const pair = this.#pair; this.#pair = undefined; this.#snapshot = undefined;
    try { this.#releaseBytes(); } finally { pair?.release(); }
  }
}
export class ThemePresentation {
  static readonly #attached = new WeakSet<ScopeSession>();
  readonly #session: ScopeSession;
  readonly #cache = new ThemeCache();
  readonly #pending = new Map<ViewId, Request>();
  readonly #outputs = new Map<ViewId, PresentationLease>();
  readonly #unsubscribe: () => void;
  #disposed = false;
  constructor(session: ScopeSession) {
    if (ThemePresentation.#attached.has(session)) throw new Error('Theme presentation already attached');
    this.#session = session;
    this.#unsubscribe = session.onPresentationChange(view => { if (view === null) this.clear(); else this.drop(view); });
    ThemePresentation.#attached.add(session);
  }
  async select(view: ViewId, acquire: () => Promise<Outcome<NormalizedTheme>>, options: PresentationOptions = {}): Promise<PresentationOutcome> {
    if (this.#disposed) return { kind: 'unavailable', reason: 'closed' };
    const checked = attempt(() => snapshotOptions(options));
    if (checked.kind !== 'ok') return checked;
    const generation = this.#session.selectTheme(view);
    if (generation === undefined) return { kind: 'unavailable', reason: 'closed' };
    const scope = this.#session.acquireFull(view);
    if (!scope) return { kind: 'unavailable', reason: 'scope-not-current' };
    if (this.#disposed || scope.publication?.theme !== generation || !this.#session.presentationCurrent(scope)) {
      scope.release(); return { kind: 'discarded' };
    }
    const request: Request = { view, scope, options: checked.value, canceled: false, released: false };
    this.#pending.set(view, request);
    const abort = () => { request.canceled = true; this.finish(request); };
    const signal = request.options.signal;
    try { signal?.addEventListener('abort', abort, { once: true }); return await this.run(request, acquire); }
    finally { this.finish(request); signal?.removeEventListener('abort', abort); }
  }
  private async run(request: Request, acquire: () => Promise<Outcome<NormalizedTheme>>): Promise<PresentationOutcome> {
    if (!this.current(request)) return this.terminal(request);
    let normalized: Outcome<NormalizedTheme>;
    try { normalized = await acquire(); }
    catch { return this.current(request) ? { kind: 'error', code: 'acquisition-failed', location: { kind: 'request' } } : this.terminal(request); }
    if (!this.current(request)) return this.terminal(request);
    if (normalized.kind !== 'ok') return normalized;
    if (request.options.framing === 'future010-product-lines-v1' && normalized.value.profile !== 'product') return { kind: 'unsupported', code: 'profile', location: { kind: 'request' } };
    const compiled = await NativeTheme.compile(normalized.value, request.options.compile);
    if (compiled.kind !== 'ok') return this.current(request) ? compiled : this.terminal(request);
    try {
      if (!this.current(request)) return this.terminal(request);
      return this.publish(request, normalized.value, compiled.value);
    } finally { compiled.value.dispose(); }
  }
  private publish(request: Request, normalized: NormalizedTheme, theme: NativeTheme): PresentationOutcome {
    let pair: ThemePair | undefined;
    try {
      const resolved = this.#cache.acquire(request.scope, normalized, theme, request.options.input ?? {}, request.options.resolve ?? {}, request.options.framing);
      if (resolved.kind !== 'ok') return this.current(request) ? resolved : this.terminal(request);
      pair = resolved.value;
      if (!this.current(request)) return this.terminal(request);
      const publication = request.scope.publication;
      if (!publication) throw new Error('Missing scope view identity');
      const scope = request.scope.snapshot;
      const key = Object.freeze({ owner: scope.owner, generation: scope.generation, work: scope.work, view: publication,
        themeRevision: normalized.contentRevision, profile: normalized.profile, framing: request.options.framing ?? 'identity-v1' });
      const output = new Output(pair, key).retain(); pair = undefined;
      if (!this.current(request)) { output.release(); return this.terminal(request); }
      this.#outputs.set(request.view, output);
      return { kind: 'complete', key };
    } catch (error) { return this.failure(request, error); }
    finally { pair?.release(); }
  }
  private failure(request: Request, error: unknown): PresentationOutcome {
    if (!(error instanceof OutputBudgetError)) throw error;
    return this.current(request) ? { kind: 'incomplete', reason: 'budget' } : this.terminal(request);
  }
  private current(request: Request): boolean {
    return !this.#disposed && !request.released && !request.canceled && !request.options.signal?.aborted &&
      this.#pending.get(request.view) === request && this.#session.presentationCurrent(request.scope);
  }
  private terminal(request: Request): PresentationOutcome { return { kind: request.canceled || request.options.signal?.aborted ? 'canceled' : 'discarded' }; }
  private finish(request: Request): void {
    if (this.#pending.get(request.view) === request) this.#pending.delete(request.view);
    if (request.released) return; request.released = true; request.scope.release();
  }
  cancel(view: ViewId): void {
    const request = this.#pending.get(view);
    if (request) { request.canceled = true; this.finish(request); }
  }
  acquire(view: ViewId): PresentationLease | undefined { return this.#outputs.get(view)?.retain(); }
  private drop(view: ViewId): void {
    const request = this.#pending.get(view), output = this.#outputs.get(view);
    this.#pending.delete(view); this.#outputs.delete(view);
    if (request) this.finish(request);
    output?.release();
  }
  private clear(): void {
    const requests = Array.from(this.#pending.values()), outputs = Array.from(this.#outputs.values());
    this.#pending.clear(); this.#outputs.clear();
    for (const request of requests) this.finish(request);
    for (const output of outputs) output.release();
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true; this.clear(); this.#unsubscribe(); ThemePresentation.#attached.delete(this.#session);
  }
}
function snapshotOptions(options: PresentationOptions): PresentationOptions {
  const framing = options.framing === undefined ? 'identity-v1' : options.framing;
  if (framing !== 'identity-v1' && framing !== 'future010-product-lines-v1') reject({ kind: 'invalid', code: 'schema', location: { kind: 'request' } });
  return Object.freeze({ ...options, framing,
    compile: Object.freeze(limits(COMPILE_DEFAULTS, options.compile === undefined ? {} : options.compile)),
    input: Object.freeze(limits(INPUT_DEFAULTS, options.input === undefined ? {} : options.input, true)),
    resolve: Object.freeze(limits(RESOLVE_DEFAULTS, options.resolve === undefined ? {} : options.resolve)) });
}
