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
  readonly source: string;
  readonly #runtime: Runtime;
  readonly #language: Foreign;
  readonly #buffer: Foreign;
  readonly #parser: Foreign;
  readonly #tree: Foreign;
  private constructor(languageId: string, source: string, runtime: Runtime, language: Foreign,
    buffer: Foreign, parser: Foreign, tree: Foreign) {
    this.languageId = languageId; this.source = source; this.#runtime = runtime;
    this.#language = language; this.#buffer = buffer; this.#parser = parser; this.#tree = tree;
    Object.freeze(this);
  }

  static async open(languageId: string, source: string): Promise<PilotDocument> {
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
      return new PilotDocument(languageId, source, runtime, language, buffer, parser, tree);
    } catch (error) {
      unwind(tree, parser, buffer);
      throw error;
    }
  }

  borrow<T>(sameLanguage: (language: Foreign) => boolean, action: (borrowed: Borrowed) => T): T {
    if (this.#disposed) throw new Error('Deleted native document');
    return withBorrowed(this.#runtime, this.#language, this.#tree, this.#buffer, this.source.length, sameLanguage, action);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try { release(this.#tree); } finally {
      try { release(this.#parser); } finally { release(this.#buffer); }
    }
  }
}
