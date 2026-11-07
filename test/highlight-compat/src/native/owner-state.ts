import { integer } from './edit-batch.ts';
import type { TextSpan } from './edit-batch.ts';
export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type DocumentEpoch = Brand<number, 'DocumentEpoch'>;
export type Revision = Brand<number, 'Revision'>;
export type SyntaxGeneration = Brand<number, 'SyntaxGeneration'>;
export type RequestId = Brand<number, 'RequestId'>;
export type ViewId = Brand<number, 'ViewId'>;
export type InterestGeneration = Brand<number, 'InterestGeneration'>;
export type ThemeGeneration = Brand<number, 'ThemeGeneration'>;
export type ResultGeneration = Brand<number, 'ResultGeneration'>;
export type OwnerKey = Readonly<{ epoch: DocumentEpoch; revision: Revision; syntax: SyntaxGeneration }>;
export type WorkKey = OwnerKey & Readonly<{ request: RequestId }>;
export type OwnerObservation = Readonly<{ kind: 'ready' | 'updating' | 'unavailable' | 'closed'; key: OwnerKey }>;
export type EditOutcome = Readonly<{ kind: 'ready'; key: OwnerKey; oldTextSpans: readonly TextSpan[]; newTextSpans: readonly TextSpan[] }>
  | Readonly<{ kind: 'unavailable'; key: OwnerKey; reason: string }> | Readonly<{ kind: 'closed'; key: OwnerKey }>;
let epoch = 0;
export function sameOwner(a: OwnerKey, b: OwnerKey): boolean { return a.epoch === b.epoch && a.revision === b.revision && a.syntax === b.syntax; }
export function sameWork(a: WorkKey, b: WorkKey): boolean { return sameOwner(a, b) && a.request === b.request; }
export function counter<Name extends string>(value: number): Brand<number, Name> { return integer(value) as Brand<number, Name>; }
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
type Lifecycle<Ready> = Readonly<{ kind: 'ready'; analysis: Ready }> | Readonly<{ kind: 'updating' | 'unavailable' | 'closed' }>;
export class OwnerState<Ready> {
  #key: OwnerKey = Object.freeze({ epoch: counter<'DocumentEpoch'>(++epoch), revision: counter<'Revision'>(0), syntax: counter<'SyntaxGeneration'>(0) });
  #state: Lifecycle<Ready>;
  constructor(analysis: Ready) { this.#state = { kind: 'ready', analysis }; }
  ready(): Ready | undefined { return this.#state.kind === 'ready' ? this.#state.analysis : undefined; }
  #borrows = 0;
  readonly #listeners = new Set<() => void>();
  key(): OwnerKey { return this.#key; }
  observe(): OwnerObservation { return Object.freeze({ kind: this.#state.kind, key: this.#key }); }
  onCommit(listener: () => void): () => void { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; }
  validate(base: OwnerKey): void {
    if (this.#state.kind === 'closed' || this.#state.kind === 'updating' || this.#borrows) throw new Error('Owner unavailable for mutation');
    if (!sameOwner(base, this.#key)) throw new Error('Stale owner base');
    integer(this.#key.revision + 1); integer(this.#key.syntax + 1);
  }
  begin(commit: () => void): OwnerKey {
    this.#key = Object.freeze({ epoch: this.#key.epoch, revision: counter<'Revision'>(this.#key.revision + 1), syntax: counter<'SyntaxGeneration'>(this.#key.syntax + 1) });
    this.#state = { kind: 'updating' }; commit(); return this.#key;
  }
  finish(analysis: Ready): void { if (this.#state.kind !== 'closed') { this.#state = { kind: 'ready', analysis }; this.notify(); } }
  fail(error: unknown): string {
    const reason = errorText(error);
    if (this.#state.kind === 'closed') return reason;
    this.#state = { kind: 'unavailable' };
    try { this.notify(); } catch (notification) { return `${reason}; ${errorText(notification)}`; }
    return reason;
  }
  close(release: (analysis: Ready | undefined) => void): void {
    if (this.#state.kind === 'closed') return;
    if (this.#borrows) throw new Error('Cannot dispose during native borrow');
    const analysis = this.ready(); this.#state = { kind: 'closed' };
    try { this.notify(); } finally { this.#listeners.clear(); release(analysis); }
  }
  borrow<T>(action: (analysis: Ready) => T): T {
    if (this.#state.kind !== 'ready') throw new Error(`Owner ${this.#state.kind}`);
    this.#borrows++;
    try { const result = action(this.#state.analysis); if (result instanceof Promise) throw new Error('Owner borrow must be synchronous'); return result; }
    finally { this.#borrows--; }
  }
  notify(): void {
    const errors: unknown[] = [];
    for (const listener of Array.from(this.#listeners)) {
      try { listener(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Owner notification failed');
  }
}
