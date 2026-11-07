import { OwnerState } from './owner-state.ts';
import type { OwnerKey, EditOutcome } from './owner-state.ts';
import { prepareEdits, BINDING_LIMITS } from './edit-batch.ts';
import type { Edit, NumericLimits } from './edit-batch.ts';
import { withBorrowed } from './borrow.ts';
import type { Borrowed } from './borrow.ts';
import { Runtime, invoke, release, foreign } from './runtime.ts';
import type { Foreign } from './runtime.ts';

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
  get source(): string { return this.#source; }
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
    const runtime = await Runtime.load();
    const language = await runtime.language(languageId);
    let buffer: Foreign | undefined, parser: Foreign | undefined, tree: Foreign | undefined;
    try {
      buffer = runtime.construct('TextBuffer', [source]);
      parser = runtime.construct('Parser');
      invoke(parser, 'setLanguage', [language]);
      const parsed = invoke(parser, 'parse', [buffer]);
      if (!parsed) throw new Error('Native owner parse returned no tree');
      tree = foreign(parsed);
      return new PilotDocument(languageId, source, runtime, language, buffer, parser, tree, limits);
    } catch (error) {
      unwind(tree, parser, buffer);
      throw error;
    }
  }

  borrow<T>(sameLanguage: (language: Foreign) => boolean, action: (borrowed: Borrowed) => T): T {
    if (this.#disposed) throw new Error('Deleted native document');
    return this.#state.borrow(tree => {
      return withBorrowed(this.#runtime, this.#language, tree, this.#buffer, this.source.length, sameLanguage, action);
    });
  }

  async applyEdits(input: Readonly<{ base: OwnerKey; edits: readonly Edit[] }>): Promise<EditOutcome> {
    if (this.#operation) throw new Error('Owner unavailable for mutation');
    this.#state.validate(input.base);
    const prepared = prepareEdits(this.source, input.edits, this.#limits);
    this.#state.validate(input.base);
    if (!prepared.schedule.length) return this.observe().kind === 'ready' ? { kind: 'ready', key: this.key(), oldTextSpans: [], newTextSpans: [] } : { kind: 'unavailable', key: this.key(), reason: 'Owner unavailable' };
    const recovering = this.observe().kind === 'unavailable', previousSource = this.source;
    this.#operation = true;
    let key = this.key(), tree = this.#state.ready();
    try {
      key = this.#state.begin(() => { this.#source = prepared.source; });
      if (recovering) invoke(this.#buffer, 'set', [previousSource]);
      for (const step of prepared.schedule) {
        if (tree) invoke(tree, 'edit', [step.binding]);
        invoke(this.#buffer, 'edit', [step.edit.from, step.edit.to, step.edit.insert]);
      }
      const parsed = invoke(this.#parser, 'parse', [this.#buffer, tree]);
      if (!parsed) throw new Error('Native owner parse returned no tree');
      const next = foreign(parsed), old = tree; tree = next;
      this.retireTree(old, next);
      if (this.#closeRequested) { release(next); tree = undefined; this.#operation = false; this.dispose(); return { kind: 'closed', key }; }
      this.#state.finish(next);
      if (this.#closeRequested) return { kind: 'closed', key };
      return { kind: 'ready', key, oldTextSpans: prepared.oldTextSpans, newTextSpans: prepared.newTextSpans };
    } catch (error) {
      if (tree) release(tree); tree = undefined;
      invoke(this.#parser, 'reset'); this.#state.fail();
      return { kind: 'unavailable', key, reason: error instanceof Error ? error.message : String(error) };
    } finally { this.#operation = false; if (this.#closeRequested) this.dispose(); }
  }

  private retireTree(old: Foreign | undefined, next: Foreign): void {
    if (!old) return;
    try { invoke(old, 'getChangedRanges', [next]); } finally { release(old); }
  }
  dispose(): void {
    if (this.#disposed) return;
    if (this.#operation) { this.#closeRequested = true; return; }
    this.#state.close(tree => { this.#disposed = true; unwind(tree, this.#parser, this.#buffer); });
  }
}
