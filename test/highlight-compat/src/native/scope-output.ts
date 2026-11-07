import type { ScopeInterval } from '../baselines/compose.ts';
import type { OwnerKey, ResultGeneration, WorkKey, ViewId, InterestGeneration, ThemeGeneration } from './owner-state.ts';
import type { TextSpan } from './edit-batch.ts';
import { sourceFactBytes, planProduct, buildProduct } from './scope-framing.ts';
export interface ScopeDictionary { readonly names: readonly string[]; readonly paths: readonly (readonly number[])[] }
export interface InjectionCoverage { readonly from: number; readonly to: number; readonly language: string | null; readonly reason: string | null }
export interface ScopeSnapshot {
  readonly owner: OwnerKey; readonly generation: ResultGeneration; readonly work: WorkKey;
  readonly coverage: TextSpan; readonly sourceLength: number; readonly dictionary: ScopeDictionary;
  readonly segments: readonly number[]; readonly metadata: null;
  readonly separators: readonly TextSpan[];
  readonly injections: readonly InjectionCoverage[]; readonly diagnostics: readonly string[];
  readonly sourceFacts: SourceFacts;
}
export interface SourceFacts extends Pick<ScopeSnapshot, 'owner' | 'generation' | 'sourceLength' | 'separators'> {
  readonly oversized: readonly TextSpan[]; readonly finalCr: TextSpan | null;
}
export type FramingPolicy = 'identity-v1' | 'future010-product-lines-v1';
export type FramingReason = 'classified' | 'plain-line' | 'separator';
export type FramedScopes = Readonly<{ kind: 'identity'; policy: 'identity-v1'; snapshot: ScopeSnapshot }>
  | Readonly<{ kind: 'product-lines'; policy: 'future010-product-lines-v1'; snapshot: ScopeSnapshot; reasons: readonly FramingReason[] }>;
export interface Publication {
  readonly view: ViewId; readonly interest: InterestGeneration; readonly theme: ThemeGeneration; readonly viewport: TextSpan;
  readonly change: Readonly<{ kind: 'reset' }> | Readonly<{ kind: 'replace'; old: ScopeSnapshot['owner']; generation: ResultGeneration; coverage: TextSpan }>;
}
export interface ScopeLease {
  readonly snapshot: ScopeSnapshot; readonly publication: Publication | null;
  retain(): ScopeLease; reserve(bytes: number): () => void; projectFraming(policy: FramingPolicy): FramedScopes; release(): void;
}
export function separatorSpans(source: string): readonly TextSpan[] {
  return Object.freeze(Array.from(source.matchAll(/\r?\n/g), match => Object.freeze({ from: match.index, to: match.index + match[0].length })));
}
export function packIntervals(intervals: readonly ScopeInterval[], length: number): { dictionary: ScopeDictionary; segments: readonly number[] } {
  const names: string[] = [], paths: number[][] = [], segments: number[] = [];
  const nameIds = new Map<string, number>(), pathIds = new Map<string, number>();
  let end = 0;
  for (const interval of intervals) {
    if (!Number.isSafeInteger(interval.from) || !Number.isSafeInteger(interval.to) || interval.from !== end || interval.to <= interval.from || interval.to > length) throw new Error('Invalid full scope coverage');
    const path = interval.scopes.map(name => internName(name, names, nameIds));
    const key = JSON.stringify(path);
    let id = pathIds.get(key);
    if (id === undefined) { id = paths.length; paths.push(path); pathIds.set(key, id); }
    if (segments.length && segments[segments.length - 1] === id) segments[segments.length - 2] = interval.to;
    else segments.push(interval.from, interval.to, id);
    end = interval.to;
  }
  if (end !== length) throw new Error('Incomplete full scope coverage');
  return { dictionary: Object.freeze({ names: Object.freeze(names), paths: Object.freeze(paths.map(path => Object.freeze(path))) }), segments: Object.freeze(segments) };
}
function internName(name: string, names: string[], ids: Map<string, number>): number {
  if (!name || /\s/.test(name)) throw new Error('Invalid scope name');
  let id = ids.get(name);
  if (id !== undefined) return id;
  id = names.length; names.push(name); ids.set(name, id); return id;
}
export function clipSnapshot(full: ScopeSnapshot, coverage: TextSpan): ScopeSnapshot {
  const segments: number[] = [];
  for (let i = 0; i < full.segments.length; i += 3) {
    const from = Math.max(coverage.from, full.segments[i]), to = Math.min(coverage.to, full.segments[i + 1]);
    if (from < to) segments.push(from, to, full.segments[i + 2]);
  }
  const injections = full.injections.flatMap(item => {
    const from = Math.max(coverage.from, item.from), to = Math.min(coverage.to, item.to);
    return from < to ? [Object.freeze({ ...item, from, to })] : [];
  });
  return Object.freeze({ ...full, coverage, segments: Object.freeze(segments), injections: Object.freeze(injections) });
}
export function decodedSnapshot(snapshot: ScopeSnapshot): readonly ScopeInterval[] {
  return Array.from({ length: snapshot.segments.length / 3 }, (_, index) => ({ from: snapshot.segments[index * 3], to: snapshot.segments[index * 3 + 1],
    scopes: snapshot.dictionary.paths[snapshot.segments[index * 3 + 2]].map(id => snapshot.dictionary.names[id]) }));
}
export class OutputBudgetError extends Error {}
type OutputRecord = { readonly kind: 'clipped'; readonly snapshot: ScopeSnapshot; count: number }
  | { readonly kind: 'raw-full'; readonly snapshot: ScopeSnapshot; count: number; product: Extract<FramedScopes, { kind: 'product-lines' }> | undefined; productBytes: number };
export class OutputStore {
  readonly #live = new Map<ScopeSnapshot, OutputRecord>();
  readonly #ceiling: number;
  readonly #maxSegments: number;
  #reserved = 0;
  #working: Readonly<{ owner: object; bytes: number }> | undefined;
  constructor(ceiling: number, maxSegments = 262144) { this.#ceiling = ceiling; this.#maxSegments = maxSegments; }
  available(extra?: ScopeSnapshot | Omit<ScopeSnapshot, 'sourceFacts'>): number { return this.#ceiling - this.bytes(extra); }
  working(owner: object, bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new RangeError('Invalid working byte charge');
    if (this.#working && this.#working.owner !== owner) throw new Error('Other active scope work');
    if (this.bytes() - (this.#working?.bytes ?? 0) + bytes > this.#ceiling) throw new OutputBudgetError('Partial child scope byte budget');
    this.#working = { owner, bytes };
  }
  clearWorking(owner: object): void { if (this.#working?.owner === owner) this.#working = undefined; }
  bytes(extra?: ScopeSnapshot | Omit<ScopeSnapshot, 'sourceFacts'>): number {
    const snapshots: Omit<ScopeSnapshot, 'sourceFacts'>[] = Array.from(this.#live.keys());
    if (extra && !snapshots.includes(extra)) snapshots.push(extra);
    const dictionaries = new Set(snapshots.map(snapshot => snapshot.dictionary));
    const dictionaryBytes = Array.from(dictionaries, dictionary => dictionary.names.reduce((sum, name) => sum + name.length * 2, 0) + dictionary.paths.reduce((sum, path) => sum + path.length * 8, 0)).reduce((a, b) => a + b, 0);
    const segmentArrays = new Set(snapshots.map(snapshot => snapshot.segments));
    const injectionArrays = new Set(snapshots.map(snapshot => snapshot.injections));
    const diagnosticArrays = new Set(snapshots.map(snapshot => snapshot.diagnostics));
    const segmentBytes = Array.from(segmentArrays, segments => segments.length * 8).reduce((a, b) => a + b, 0);
    const injectionBytes = Array.from(injectionArrays, injections => injections.reduce((sum, item) => sum + 32 + (item.language?.length ?? 0) * 2 + (item.reason?.length ?? 0) * 2, 0)).reduce((a, b) => a + b, 0);
    const diagnosticBytes = Array.from(diagnosticArrays, diagnostics => diagnostics.reduce((sum, text) => sum + text.length * 2, 0)).reduce((a, b) => a + b, 0);
    const separators = new Set(snapshots.map(snapshot => snapshot.separators));
    const separatorBytes = Array.from(separators, spans => spans.length * 16).reduce((a, b) => a + b, 0);
    const facts = new Set(Array.from(this.#live.keys(), snapshot => snapshot.sourceFacts));
    if (extra && 'sourceFacts' in extra) facts.add(extra.sourceFacts);
    const factBytes = Array.from(facts, sourceFactBytes).reduce((sum, bytes) => sum + bytes, 0);
    const productBytes = Array.from(this.#live.values(), record => record.kind === 'raw-full' ? record.productBytes : 0).reduce((sum, bytes) => sum + bytes, 0);
    return this.#reserved + (this.#working?.bytes ?? 0) + factBytes + productBytes + dictionaryBytes + segmentBytes + injectionBytes + diagnosticBytes + separatorBytes + snapshots.length * 128;
  }
  private reserve(bytes: number): () => void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new RangeError('Invalid retained byte charge');
    if (this.bytes() + bytes > this.#ceiling) throw new OutputBudgetError('Retained presentation byte budget');
    this.#reserved += bytes;
    let held = true;
    return () => { if (!held) return; held = false; this.#reserved -= bytes; };
  }
  retain(snapshot: ScopeSnapshot, publication: Publication | null = null): ScopeLease {
    if (this.bytes(snapshot) > this.#ceiling) throw new OutputBudgetError('Retained scope byte budget');
    const record = this.#live.get(snapshot) ?? { kind: 'clipped', snapshot, count: 0 };
    this.#live.set(snapshot, record); record.count++;
    return this.lease(record, publication);
  }
  admitFull(snapshot: ScopeSnapshot): ScopeLease {
    if (this.#live.has(snapshot)) throw new Error('Full scope already admitted');
    if (this.bytes(snapshot) > this.#ceiling) throw new OutputBudgetError('Retained scope byte budget');
    const record: OutputRecord = { kind: 'raw-full', snapshot, count: 1, product: undefined, productBytes: 0 };
    this.#live.set(snapshot, record);
    return this.lease(record, null);
  }
  private project(record: OutputRecord, policy: FramingPolicy): FramedScopes {
    if (record.kind !== 'raw-full') throw new Error('Raw full scope lease required');
    if (policy === 'identity-v1') return { kind: 'identity', policy, snapshot: record.snapshot };
    if (policy !== 'future010-product-lines-v1') throw new Error('Unknown framing policy');
    if (record.product) return record.product;
    const plan = planProduct(record.snapshot, { ranges: this.#maxSegments, bytes: this.available() });
    const product = buildProduct(record.snapshot, plan);
    if (plan.bytes > this.available()) throw new OutputBudgetError('Retained projection byte budget');
    record.product = product; record.productBytes = plan.bytes;
    return product;
  }
  private lease(record: OutputRecord, publication: Publication | null): ScopeLease {
    let heldRecord: OutputRecord | undefined = record;
    let held: ScopeSnapshot | undefined = record.snapshot;
    const reservations = new Set<() => void>();
    const reserve = (bytes: number): (() => void) => {
      if (!held) throw new Error('Released scope lease');
      const drop = this.reserve(bytes);
      const release = () => { drop(); reservations.delete(release); };
      reservations.add(release); return release;
    };
    const retain = (): ScopeLease => { if (!held) throw new Error('Released scope lease'); return this.retain(held, publication); };
    const projectFraming = (policy: FramingPolicy): FramedScopes => { if (!heldRecord) throw new Error('Released scope lease'); return this.project(heldRecord, policy); };
    return Object.freeze({ get snapshot() { if (!held) throw new Error('Released scope lease'); return held; }, publication, retain, reserve, projectFraming, release: () => {
      const previous = held, previousRecord = heldRecord; if (!previous || !previousRecord) return;
      held = undefined; heldRecord = undefined;
      for (const release of reservations) release();
      if (--previousRecord.count) return;
      if (previousRecord.kind === 'raw-full') { previousRecord.product = undefined; previousRecord.productBytes = 0; }
      if (this.#live.get(previous) === previousRecord) this.#live.delete(previous);
    } });
  }
}
