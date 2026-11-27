import { OwnerState } from './owner-state.ts';
import type { OwnerKey, EditOutcome } from './owner-state.ts';
import { prepareEdits, BINDING_LIMITS } from './edit-batch.ts';
import type { Edit, NumericLimits, TextSpan } from './edit-batch.ts';
import { withBorrowed } from './borrow.ts';
import type { Borrowed } from './borrow.ts';
import { Runtime, invoke, release, foreign } from './runtime.ts';
import type { Foreign } from './runtime.ts';
import { computeLocalWindow, extractChangedRanges, nodeHasError } from './local-invalidation.ts';
import type { LocalWindow, OwnerChange } from './local-invalidation.ts';
import { resolveWave1Alias } from './wave1-assets.ts';

function releasePair(first: Foreign | undefined, second: Foreign | undefined): void {
  try { if (first) release(first); } finally { if (second) release(second); }
}
function unwind(tree: Foreign | undefined, parser: Foreign | undefined, buffer: Foreign | undefined): void {
  try { if (tree) release(tree); } finally { releasePair(parser, buffer); }
}

export class PilotDocument {
  #disposed = false;
  readonly languageId: string;
  #source: string;
  readonly #state: OwnerState<Foreign>;
  readonly #limits: NumericLimits;
  #operation = false;
  #closeRequested = false;
  #lastChange: OwnerChange | undefined;
  get source(): string { return this.#source; }
  get lastChange(): OwnerChange | undefined { return this.#lastChange; }
  key() { return this.#state.key(); }
  observe() { return this.#state.observe(); }
  onCommit(listener: () => void) { return this.#state.onCommit(listener); }
  readonly #runtime: Runtime;
  readonly #language: Foreign;
  readonly #buffer: Foreign;
  readonly #parser: Foreign;
  private constructor(languageId: string, source: string, runtime: Runtime, language: Foreign,
    buffer: Foreign, parser: Foreign, tree: Foreign, limits: NumericLimits) {
    this.languageId = languageId; this.#source = source; this.#limits = Object.freeze({ ...limits }); this.#runtime = runtime;
    this.#language = language; this.#buffer = buffer; this.#parser = parser; this.#state = new OwnerState(tree);
    Object.freeze(this);
  }

  static async open(languageId: string, source: string, limits: NumericLimits = BINDING_LIMITS): Promise<PilotDocument> {
    prepareEdits(source, [], limits);
    const canonicalId = resolveWave1Alias(languageId);
    const runtime = await Runtime.load();
    const language = await runtime.language(canonicalId);
    let buffer: Foreign | undefined, parser: Foreign | undefined, tree: Foreign | undefined;
    try {
      buffer = runtime.construct('TextBuffer', [source]);
      parser = runtime.construct('Parser');
      invoke(parser, 'setLanguage', [language]);
      const parsed = invoke(parser, 'parse', [buffer]);
      if (!parsed) throw new Error('Native owner parse returned no tree');
      tree = foreign(parsed);
      return new PilotDocument(canonicalId, source, runtime, language, buffer, parser, tree, limits);
    } catch (error) {
      unwind(tree, parser, buffer);
      throw error;
    }
  }

  borrow<T>(sameLanguage: (language: Foreign, languageId: string) => boolean, action: (borrowed: Borrowed) => T): T {
    if (this.#disposed) throw new Error('Deleted native document');
    return this.#state.borrow(tree => {
      return withBorrowed(this.#runtime, this.languageId, this.#language, tree, this.#buffer, this.source.length, sameLanguage, action);
    });
  }

  localWindow(change: OwnerChange): LocalWindow | undefined {
    if (this.#disposed) return undefined;
    return this.#state.borrow(tree => computeLocalWindow(tree, this.languageId, this.#source, change));
  }

  async applyEdits(input: Readonly<{ base: OwnerKey; edits: readonly Edit[] }>): Promise<EditOutcome> {
    if (this.#operation) throw new Error('Owner unavailable for mutation');
    this.#state.validate(input.base);
    const prepared = prepareEdits(this.source, input.edits, this.#limits);
    this.#state.validate(input.base);
    if (!prepared.schedule.length) return this.observe().kind === 'ready' ? { kind: 'ready', key: this.key(), oldTextSpans: [], newTextSpans: [] } : { kind: 'unavailable', key: this.key(), reason: 'Owner unavailable' };
    const recovering = this.observe().kind === 'unavailable', previousSource = this.source, beforeKey = this.key();
    this.#operation = true;
    let key = beforeKey, tree = this.#state.ready();
    const hadErrorBefore = tree ? nodeHasError(tree) : true;
    this.#lastChange = undefined;
    try {
      key = this.#state.begin(() => { this.#source = prepared.source; });
      this.#state.notify();
      if (recovering) invoke(this.#buffer, 'set', [previousSource]);
      for (const step of prepared.schedule) {
        if (tree) invoke(tree, 'edit', [step.binding]);
        invoke(this.#buffer, 'edit', [step.edit.from, step.edit.to, step.edit.insert]);
      }
      const parsed = invoke(this.#parser, 'parse', [this.#buffer, tree]);
      if (!parsed) throw new Error('Native owner parse returned no tree');
      const next = foreign(parsed), old = tree; tree = next;
      const changedRanges = this.retireTree(old, next, prepared.source.length);
      if (this.#closeRequested) { release(next); tree = undefined; this.#operation = false; this.dispose(); return { kind: 'closed', key }; }
      const hasErrorAfter = nodeHasError(next);
      this.#lastChange = Object.freeze({
        fromKey: beforeKey, toKey: key, oldLength: previousSource.length, newLength: prepared.source.length,
        oldTextSpans: prepared.oldTextSpans, newTextSpans: prepared.newTextSpans, changedRanges,
        hadErrorBefore, hasErrorAfter, recovering,
      });
      this.#state.finish(next);
      if (this.#closeRequested) return { kind: 'closed', key };
      return { kind: 'ready', key, oldTextSpans: prepared.oldTextSpans, newTextSpans: prepared.newTextSpans };
    } catch (error) {
      this.#lastChange = undefined;
      if (tree) release(tree); tree = undefined;
      invoke(this.#parser, 'reset');
      return { kind: 'unavailable', key: this.key(), reason: this.#state.fail(error) };
    } finally { this.#operation = false; if (this.#closeRequested) this.dispose(); }
  }

  private retireTree(old: Foreign | undefined, next: Foreign, newLength: number): readonly TextSpan[] {
    if (!old) return [];
    try { return extractChangedRanges(invoke(old, 'getChangedRanges', [next]), newLength); } finally { release(old); }
  }
  dispose(): void {
    if (this.#disposed) return;
    if (this.#operation) { this.#closeRequested = true; return; }
    this.#state.close(tree => { this.#disposed = true; unwind(tree, this.#parser, this.#buffer); });
  }
}
