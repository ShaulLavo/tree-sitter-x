import type { InjectionCoverage } from './scope-output.ts';
import { mapIntervals, validateMappings } from './injection-map.ts';
import { OwnerState, sameOwner } from './owner-state.ts';
import type { OwnerKey, EditOutcome } from './owner-state.ts';
import { prepareEdits, pointAt } from './edit-batch.ts';
import type { Edit } from './edit-batch.ts';
import { Runtime, foreign, invoke, release } from './runtime.ts';
import type { Foreign } from './runtime.ts';
import { MarkdownResolver } from './markdown-resolver.ts';
import type { ResolverRecord } from './markdown-resolver.ts';
import { withBorrowed } from './borrow.ts';
import { embeddedScope, NATIVE_LANGUAGES } from './packs.ts';
import type { NativeLanguage } from './packs.ts';
import { NativeScopeError } from './component.ts';
import type { Limits } from './component.ts';
import type { NativePack } from './component.ts';
import { languageRegistrations } from '../oracles/assets.ts';
import { sourceLines } from '../oracles/lines.ts';
import { paintScopes } from '../baselines/theme.ts';
import type { StyleReference } from '../baselines/theme.ts';
import type { ScopeInterval } from '../baselines/compose.ts';
import { MARKDOWN_COMMIT, MARKDOWN_VERSION } from './markdown-assets.ts';
import { explainSource } from './evidence.ts';
import type { IntervalEvidence } from './evidence.ts';

export interface ChildRange { readonly languageId: NativeLanguage; readonly start: number; readonly end: number; readonly rootStart: number; readonly rootEnd: number }
interface Child { readonly range: ChildRange; readonly language: Foreign; readonly parser: Foreign; readonly tree: Foreign }
interface MarkdownAnalysis {
  readonly children: readonly Child[]; readonly decorations: readonly ResolverRecord[];
  readonly diagnostics: readonly string[]; readonly coverage: readonly InjectionCoverage[];
}
interface MarkdownUpdate { readonly key: OwnerKey; readonly children: Child[] }
async function aliases(): Promise<ReadonlyMap<string, NativeLanguage>> {
  const entries: [string, NativeLanguage][] = [];
  for (const id of NATIVE_LANGUAGES) {
    const registration = (await languageRegistrations(id)).find(item => item.name === id);
    const names: string[] = [id];
    for (const name of names.concat(registration?.aliases ?? [])) entries.push([name, id]);
  }
  return new Map(entries);
}
function supportedContainer(source: string, injection: ResolverRecord, decorations: readonly ResolverRecord[]): boolean {
  const block = decorations.find(item => item.kind === 4 && item.extra === 1 && item.start <= injection.start && item.end >= injection.end);
  if (!block) return false;
  const marker = decorations.find(item => item.kind === 35 && item.start >= block.start && item.end <= injection.start);
  if (!marker) return false;
  const lineStart = source.lastIndexOf('\n', marker.start - 1) + 1;
  const prefix = source.slice(lineStart, marker.start);
  return prefix.length <= 3 && Array.from(prefix).every(char => char === ' ');
}
function dropChildren(children: readonly Child[]): void {
  for (const child of children) { try { release(child.tree); } finally { release(child.parser); } }
}
function close(children: readonly Child[], buffer: Foreign | undefined, resolver: MarkdownResolver): void {
  try { dropChildren(children); } finally {
    try { if (buffer) release(buffer); } finally { resolver.dispose(); }
  }
}

async function parseChild(runtime: Runtime, buffer: Foreign, source: string, range: ResolverRecord, languageId: NativeLanguage, current: () => boolean, operation: <T>(action: () => T) => T): Promise<Child> {
  const language = await runtime.language(languageId);
  if (!current()) throw new Error('Closed Markdown transaction');
  return operation(() => constructChild(runtime, buffer, source, range, languageId, language));
}
function constructChild(runtime: Runtime, buffer: Foreign, source: string, range: ResolverRecord, languageId: NativeLanguage, language: Foreign): Child {
  const parser = runtime.construct('Parser');
  let tree: Foreign | undefined;
  try {
    invoke(parser, 'setLanguage', [language]);
    const parsed = invoke(parser, 'parse', [buffer, undefined, { includedRanges: [{
      startIndex: range.start, endIndex: range.end, startPosition: pointAt(source, range.start), endPosition: pointAt(source, range.end),
    }] }]);
    if (!parsed) throw new Error('Markdown child parse returned no tree');
    tree = foreign(parsed);
    const root = foreign(tree.rootNode);
    const rootStart = root.startIndex, rootEnd = root.endIndex;
    if (typeof rootStart !== 'number' || typeof rootEnd !== 'number' || !Number.isSafeInteger(rootStart) || !Number.isSafeInteger(rootEnd) || rootStart < range.start || rootEnd > range.end || rootStart > rootEnd) throw new Error('Markdown child root exceeds injection range');
    validateIncludedRange(tree, source, range);
    return { language, parser, tree, range: Object.freeze({ languageId, start: range.start, end: range.end, rootStart, rootEnd }) };
  } catch (error) {
    try { if (tree) release(tree); } finally { release(parser); }
    throw error;
  }
}

function validateIncludedRange(tree: Foreign, source: string, range: ResolverRecord): void {
  const included = invoke(tree, 'getIncludedRanges');
  if (!Array.isArray(included) || included.length !== 1) throw new Error('Markdown child included range count');
  const actual = foreign(included[0]), start = foreign(actual.startPosition), end = foreign(actual.endPosition);
  const expectedStart = pointAt(source, range.start), expectedEnd = pointAt(source, range.end);
  if (actual.startIndex !== range.start || actual.endIndex !== range.end || start.row !== expectedStart.row || start.column !== expectedStart.column || end.row !== expectedEnd.row || end.column !== expectedEnd.column) throw new Error('Markdown child included source range mismatch');
}

export class MarkdownPilotDocument {
  #disposed = false;
  #source: string;
  readonly #state: OwnerState<MarkdownAnalysis>;
  #update: MarkdownUpdate | undefined;
  #operation = false;
  #closeRequested = false;
  #sets = 1;
  #parses = 0;
  readonly #names: ReadonlyMap<string, NativeLanguage>;
  get source(): string { return this.#source; }
  get children(): readonly ChildRange[] { return Object.freeze((this.#state.ready()?.children ?? []).map(child => child.range)); }
  get diagnostics(): readonly string[] { return this.#state.ready()?.diagnostics ?? []; }
  get observation() { return Object.freeze({ resolverSetText: this.#sets, childParses: this.#parses }); }
  key() { return this.#state.key(); }
  observe() { return this.#state.observe(); }
  onCommit(listener: () => void) { return this.#state.onCommit(listener); }
  readonly #runtime: Runtime;
  #resolver: MarkdownResolver;
  readonly #buffer: Foreign;
  get injectionCoverage(): readonly InjectionCoverage[] { return this.#state.ready()?.coverage ?? []; }
  private constructor(source: string, runtime: Runtime, resolver: MarkdownResolver, buffer: Foreign, children: readonly Child[], decorations: readonly ResolverRecord[], diagnostics: readonly string[], names: ReadonlyMap<string, NativeLanguage>, coverage: readonly InjectionCoverage[]) {
    this.#source = source; this.#names = names; this.#runtime = runtime; this.#resolver = resolver; this.#buffer = buffer;
    this.#state = new OwnerState({ children: Object.freeze(Array.from(children)), decorations, diagnostics: Object.freeze(diagnostics), coverage: Object.freeze(coverage) });
    this.#parses = children.length;
    Object.freeze(this);
  }
  static async open(source: string): Promise<MarkdownPilotDocument> {
    prepareEdits(source, []);
    const runtime = await Runtime.load(), names = await aliases();
    const resolver = await MarkdownResolver.open(source);
    const children: Child[] = [], diagnostics: string[] = [], coverage: InjectionCoverage[] = [];
    let buffer: Foreign | undefined;
    try {
      buffer = runtime.construct('TextBuffer', [source]);
      const injections = resolver.records(true), decorations = resolver.records(false);
      for (const range of injections) await appendChild({ runtime, buffer, source, range, decorations, names, children, diagnostics, coverage, current: () => true, operation: action => action() });
      return new MarkdownPilotDocument(source, runtime, resolver, buffer, children, decorations, diagnostics, names, coverage);
    } catch (error) { close(children, buffer, resolver); throw error; }
  }
  intervals(packs: ReadonlyMap<string, NativePack>, limits: Limits = {}, current: () => boolean = () => true): readonly ScopeInterval[] {
    if (this.#disposed) throw new Error('Deleted Markdown pilot');
    return this.#state.borrow(analysis => {
      const children = analysis.children.flatMap(child => this.childIntervals(child, packs, limits, current));
      return frame(this.source, analysis.decorations, children);
    });
  }
  scopeChild(index: number, packs: ReadonlyMap<string, NativePack>, limits: Limits): readonly ScopeInterval[] {
    return this.#state.borrow(analysis => {
      const child = analysis.children[index];
      if (!child) throw new Error('Missing current Markdown child');
      return this.childIntervals(child, packs, limits, () => true);
    });
  }
  composeScopes(children: readonly ScopeInterval[]): readonly ScopeInterval[] {
    return this.#state.borrow(analysis => frame(this.source, analysis.decorations, children));
  }
  async explanations(packs: ReadonlyMap<string, NativePack>): Promise<readonly IntervalEvidence[]> {
    if (this.#disposed) throw new Error('Deleted Markdown pilot');
    const key = this.key();
    if (this.observe().kind !== 'ready') throw new Error('Markdown owner unavailable');
    const children = this.#state.ready()?.children ?? [];
    const groups = await Promise.all(children.map(child => {
      const pack = packs.get(child.range.languageId);
      if (!pack) throw new Error(`Missing native child pack ${child.range.languageId}`);
      return explainSource(pack, child.range.languageId, this.source.length,
        action => this.#state.borrow(() => {
          if (!sameOwner(key, this.key())) throw new Error('Stale Markdown explanation');
          return withBorrowed(this.#runtime, child.language, child.tree, this.#buffer, this.source.length, pack.sameLanguage, action);
        }),
        child.range.start, child.range.end);
    }));
    return groups.flat();
  }
  private childIntervals(child: Child, packs: ReadonlyMap<string, NativePack>, limits: Limits, current: () => boolean): ScopeInterval[] {
    if (!current()) throw new Error('Canceled scope work');
    const pack = packs.get(child.range.languageId);
    if (!pack) throw new Error(`Missing native child pack ${child.range.languageId}`);
    const mappings = validateMappings(this.source, this.source, [{ childFrom: child.range.start, childTo: child.range.end, parentFrom: child.range.start, parentTo: child.range.end }]);
    const result = withBorrowed(this.#runtime, child.language, child.tree, this.#buffer, this.source.length,
      pack.sameLanguage, borrowed => pack.run(borrowed, { start: child.range.start, end: child.range.end }, limits));
    if (result.status !== 0) throw new NativeScopeError(result.status, result.detail);
    const intervals = Array.from({ length: result.segments.length / 3 }, (_, index) => ({
      from: result.segments[index * 3], to: result.segments[index * 3 + 1],
      scopes: [embeddedScope(child.range.languageId)].concat(result.paths[result.segments[index * 3 + 2]].slice(1).map(id => pack.scopes[id])),
    }));

    return Array.from(mapIntervals(intervals, mappings));
  }
  async document(packs: ReadonlyMap<string, NativePack>, reference: StyleReference) {
    const identities = Array.from(packs, ([id, pack]) => [id, pack.engine]);
    return paintScopes('native', 'markdown', this.source, this.intervals(packs), reference,
      { resolverCommit: MARKDOWN_COMMIT, resolverVersion: MARKDOWN_VERSION,
        resolverSha256: 'a62768930dddde0a5d9cf49cd35f583d83e9b4aedb34de0f047fcd7879df5159',
        packs: JSON.stringify(identities), flags: '3', mapping: 'resolver-fence-frame-1' }, this.diagnostics);
  }
  async applyEdits(input: Readonly<{ base: OwnerKey; edits: readonly Edit[] }>): Promise<EditOutcome> {
    if (this.#operation) throw new Error('Owner unavailable for mutation');
    this.#state.validate(input.base);
    const prepared = prepareEdits(this.source, input.edits);
    this.#state.validate(input.base);
    if (!prepared.schedule.length) return this.observe().kind === 'ready' ? { kind: 'ready', key: this.key(), oldTextSpans: [], newTextSpans: [] } : { kind: 'unavailable', key: this.key(), reason: 'Owner unavailable' };
    let previous = this.#state.ready();
    const update: MarkdownUpdate = { key: this.key(), children: [] };
    const recovering = this.observe().kind === 'unavailable';
    this.#operation = true;
    let key = this.key();
    const current = () => !this.#disposed && this.observe().kind === 'updating' && sameOwner(key, this.key()) && !!this.#update && sameOwner(key, this.#update.key);
    try {
      key = this.#state.begin(() => { this.#source = prepared.source; });
      this.#update = { key, children: update.children };
      this.#operation = true;
      dropChildren(previous?.children ?? []); previous = undefined;
      invoke(this.#buffer, 'set', [this.source]);
      if (recovering) await this.restoreResolver(current);
      else this.#resolver.replaceText(this.source);
      if (!current()) return { kind: 'closed', key };
      this.#sets++;
      const injections = this.#resolver.records(true), decorations = this.#resolver.records(false);
      this.#operation = false;
      if (this.#closeRequested) this.dispose();
      const diagnostics: string[] = [], coverage: InjectionCoverage[] = [];
      for (const range of injections) {
        if (!current()) return { kind: 'closed', key };
        await appendChild({ runtime: this.#runtime, buffer: this.#buffer, source: this.source, range,
          decorations, names: this.#names, children: update.children, diagnostics, coverage, current, operation: action => this.operation(action) });
      }
      if (!current()) return { kind: 'closed', key };
      this.#parses += update.children.length; this.#update = undefined; this.#operation = true;
      this.#state.finish({ children: Object.freeze(update.children), decorations, diagnostics: Object.freeze(diagnostics), coverage: Object.freeze(coverage) });
      if (this.#closeRequested) return { kind: 'closed', key };
      return { kind: 'ready', key, oldTextSpans: prepared.oldTextSpans, newTextSpans: prepared.newTextSpans };
    } catch (error) {
      if (this.#disposed) return { kind: 'closed', key };
      dropChildren(this.#state.ready()?.children ?? update.children); this.#update = undefined; this.#state.fail();
      return { kind: 'unavailable', key, reason: error instanceof Error ? error.message : String(error) };
    } finally { this.#operation = false; if (this.#closeRequested) this.dispose(); }
  }
  private operation<T>(action: () => T): T {
    this.#operation = true;
    try { return action(); }
    finally { this.#operation = false; if (this.#closeRequested) this.dispose(); }
  }
  private async restoreResolver(current: () => boolean): Promise<void> {
    this.#resolver.dispose(); this.#operation = false;
    if (this.#closeRequested) this.dispose();
    if (!current()) return;
    const resolver = await MarkdownResolver.open(this.source);
    if (!current()) { resolver.dispose(); return; }
    this.#resolver = resolver; this.#operation = true;
  }
  dispose(): void {
    if (this.#disposed) return;
    if (this.#operation) { this.#closeRequested = true; return; }
    this.#state.close(analysis => {
      this.#disposed = true;
      const partial = this.#update?.children.splice(0) ?? []; this.#update = undefined;
      close((analysis?.children ?? []).concat(partial), this.#buffer, this.#resolver);
    });
  }
}

interface AppendChild {
  readonly runtime: Runtime; readonly buffer: Foreign; readonly source: string; readonly range: ResolverRecord;
  readonly decorations: readonly ResolverRecord[]; readonly names: ReadonlyMap<string, NativeLanguage>;
  readonly children: Child[]; readonly diagnostics: string[]; readonly coverage: InjectionCoverage[]; readonly current: () => boolean; readonly operation: <T>(action: () => T) => T;
}
async function appendChild(input: AppendChild): Promise<void> {
  const name = input.source.slice(input.range.kind, input.range.extra).trim();
  if (!name || name === 'markdown' || name === 'md') { outerOnly(input, `frame only: ${name || 'empty info'} at ${input.range.start}`); return; }
  const languageId = input.names.get(name);
  if (!languageId) { outerOnly(input, `missing language ${name} at ${input.range.start}`); return; }
  if (!supportedContainer(input.source, input.range, input.decorations)) { outerOnly(input, `unsupported nested fence ${name} at ${input.range.start}: requires multiple included ranges`); return; }
  if (input.range.start === input.range.end) { outerOnly(input, `empty fence ${name} at ${input.range.start}`); return; }
  const child = await parseChild(input.runtime, input.buffer, input.source, input.range, languageId, input.current, input.operation);
  if (!input.current()) { dropChildren([child]); return; }
  input.children.push(child); input.coverage.push(Object.freeze({ from: input.range.start, to: input.range.end, language: languageId, reason: null }));
}

function outerOnly(input: AppendChild, reason: string): void {
  input.diagnostics.push(reason); input.coverage.push(Object.freeze({ from: input.range.start, to: input.range.end, language: null, reason }));
}

function decorationScopes(record: ResolverRecord): readonly string[] {
  if (record.kind === 4 && record.extra === 1) return ['markup.fenced_code.block.markdown'];
  if (record.kind === 35) return ['punctuation.definition.markdown'];
  if (record.kind === 36) return ['fenced_code.block.language.markdown'];
  return [];
}
function frame(source: string, decorations: readonly ResolverRecord[], children: readonly ScopeInterval[]): ScopeInterval[] {
  const mapped = decorations.filter(record => decorationScopes(record).length > 0);
  const ends = mapped.flatMap(record => [record.start, record.end]).concat(children.flatMap(child => [child.from, child.to]),
    sourceLines(source).flatMap(line => [line.start, line.start + line.text.length, line.next]), [0, source.length]);
  const points = Array.from(new Set(ends)); points.sort((a, b) => a - b);
  return points.slice(0, -1).map((from, index) => {
    const to = points[index + 1];
    const terminator = source.slice(from, to) === '\n' || source.slice(from, to) === '\r\n';
    const parent = mapped.filter(item => item.start <= from && item.end >= to).sort((a, b) => a.start - b.start || b.end - a.end || a.kind - b.kind);
    const child = children.find(item => item.from <= from && item.to >= to);
    return { from, to, scopes: terminator ? [] : ['text.html.markdown'].concat(parent.flatMap(decorationScopes), child?.scopes ?? []) };
  });
}
