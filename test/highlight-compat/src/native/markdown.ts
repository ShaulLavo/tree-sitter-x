import { Runtime, foreign, invoke, release } from './runtime.ts';
import type { Foreign } from './runtime.ts';
import { MarkdownResolver } from './markdown-resolver.ts';
import type { ResolverRecord } from './markdown-resolver.ts';
import { withBorrowed } from './borrow.ts';
import { embeddedScope, NATIVE_LANGUAGES } from './packs.ts';
import type { NativeLanguage } from './packs.ts';
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
async function aliases(): Promise<ReadonlyMap<string, NativeLanguage>> {
  const entries: [string, NativeLanguage][] = [];
  for (const id of NATIVE_LANGUAGES) {
    const registration = (await languageRegistrations(id)).find(item => item.name === id);
    const names: string[] = [id];
    for (const name of names.concat(registration?.aliases ?? [])) entries.push([name, id]);
  }
  return new Map(entries);
}
function point(source: string, offset: number): { row: number; column: number } {
  const before = source.slice(0, offset);
  return { row: before.split('\n').length - 1, column: offset - before.lastIndexOf('\n') - 1 };
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

async function parseChild(runtime: Runtime, buffer: Foreign, source: string, range: ResolverRecord, languageId: NativeLanguage): Promise<Child> {
  const language = await runtime.language(languageId), parser = runtime.construct('Parser');
  let tree: Foreign | undefined;
  try {
    invoke(parser, 'setLanguage', [language]);
    const parsed = invoke(parser, 'parse', [buffer, undefined, { includedRanges: [{
      startIndex: range.start, endIndex: range.end, startPosition: point(source, range.start), endPosition: point(source, range.end),
    }] }]);
    if (!parsed) throw new Error('Markdown child parse returned no tree');
    tree = foreign(parsed);
    const root = foreign(tree.rootNode);
    if (root.startIndex !== range.start || root.endIndex !== range.end) throw new Error('Markdown child root differs from injection range');
    return { language, parser, tree, range: Object.freeze({ languageId, start: range.start, end: range.end, rootStart: range.start, rootEnd: range.end }) };
  } catch (error) {
    try { if (tree) release(tree); } finally { release(parser); }
    throw error;
  }
}

export class MarkdownPilotDocument {
  #disposed = false;
  readonly source: string;
  readonly children: readonly ChildRange[];
  readonly diagnostics: readonly string[];
  readonly observation: Readonly<{ resolverSetText: number; childParses: number }>;
  readonly #runtime: Runtime;
  readonly #resolver: MarkdownResolver;
  readonly #buffer: Foreign;
  readonly #children: readonly Child[];
  readonly #decorations: readonly ResolverRecord[];
  private constructor(source: string, runtime: Runtime, resolver: MarkdownResolver, buffer: Foreign, children: readonly Child[], decorations: readonly ResolverRecord[], diagnostics: readonly string[]) {
    this.source = source; this.#runtime = runtime; this.#resolver = resolver; this.#buffer = buffer;
    this.#children = children; this.children = Object.freeze(children.map(child => child.range));
    this.#decorations = decorations; this.diagnostics = Object.freeze(diagnostics);
    this.observation = Object.freeze({ resolverSetText: 1, childParses: children.length });
    Object.freeze(this);
  }
  static async open(source: string): Promise<MarkdownPilotDocument> {
    const runtime = await Runtime.load(), names = await aliases();
    const resolver = await MarkdownResolver.open(source);
    const children: Child[] = [], diagnostics: string[] = [];
    let buffer: Foreign | undefined;
    try {
      buffer = runtime.construct('TextBuffer', [source]);
      const injections = resolver.records(true), decorations = resolver.records(false);
      for (const range of injections) await appendChild({ runtime, buffer, source, range, decorations, names, children, diagnostics });
      return new MarkdownPilotDocument(source, runtime, resolver, buffer, children, decorations, diagnostics);
    } catch (error) { close(children, buffer, resolver); throw error; }
  }
  intervals(packs: ReadonlyMap<string, NativePack>): readonly ScopeInterval[] {
    if (this.#disposed) throw new Error('Deleted Markdown pilot');
    const children = this.#children.flatMap(child => this.childIntervals(child, packs));
    return frame(this.source, this.#decorations, children);
  }
  async explanations(packs: ReadonlyMap<string, NativePack>): Promise<readonly IntervalEvidence[]> {
    if (this.#disposed) throw new Error('Deleted Markdown pilot');
    const groups = await Promise.all(this.#children.map(child => {
      const pack = packs.get(child.range.languageId);
      if (!pack) throw new Error(`Missing native child pack ${child.range.languageId}`);
      return explainSource(pack, child.range.languageId, this.source.length,
        action => withBorrowed(this.#runtime, child.language, child.tree, this.#buffer, this.source.length, pack.sameLanguage, action),
        child.range.start, child.range.end);
    }));
    return groups.flat();
  }
  private childIntervals(child: Child, packs: ReadonlyMap<string, NativePack>): ScopeInterval[] {
    const pack = packs.get(child.range.languageId);
    if (!pack) throw new Error(`Missing native child pack ${child.range.languageId}`);
    const result = withBorrowed(this.#runtime, child.language, child.tree, this.#buffer, this.source.length,
      pack.sameLanguage, borrowed => pack.run(borrowed, { start: child.range.start, end: child.range.end }));
    if (result.status !== 0) throw new Error(`Markdown native child status ${result.status}, detail ${result.detail}`);
    return Array.from({ length: result.segments.length / 3 }, (_, index) => ({
      from: result.segments[index * 3], to: result.segments[index * 3 + 1],
      scopes: [embeddedScope(child.range.languageId)].concat(result.paths[result.segments[index * 3 + 2]].slice(1).map(id => pack.scopes[id])),
    }));
  }
  async document(packs: ReadonlyMap<string, NativePack>, reference: StyleReference) {
    const identities = Array.from(packs, ([id, pack]) => [id, pack.engine]);
    return paintScopes('native', 'markdown', this.source, this.intervals(packs), reference,
      { resolverCommit: MARKDOWN_COMMIT, resolverVersion: MARKDOWN_VERSION,
        resolverSha256: 'a62768930dddde0a5d9cf49cd35f583d83e9b4aedb34de0f047fcd7879df5159',
        packs: JSON.stringify(identities), flags: '3', mapping: 'resolver-fence-frame-1' }, this.diagnostics);
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    close(this.#children, this.#buffer, this.#resolver);
  }
}

interface AppendChild {
  readonly runtime: Runtime; readonly buffer: Foreign; readonly source: string; readonly range: ResolverRecord;
  readonly decorations: readonly ResolverRecord[]; readonly names: ReadonlyMap<string, NativeLanguage>;
  readonly children: Child[]; readonly diagnostics: string[];
}
async function appendChild(input: AppendChild): Promise<void> {
  const name = input.source.slice(input.range.kind, input.range.extra).trim();
  if (!name || name === 'markdown' || name === 'md') { input.diagnostics.push(`frame only: ${name || 'empty info'} at ${input.range.start}`); return; }
  const languageId = input.names.get(name);
  if (!languageId) { input.diagnostics.push(`missing language ${name} at ${input.range.start}`); return; }
  if (!supportedContainer(input.source, input.range, input.decorations)) { input.diagnostics.push(`unsupported nested fence ${name} at ${input.range.start}: requires multiple included ranges`); return; }
  if (input.range.start === input.range.end) { input.diagnostics.push(`empty fence ${name} at ${input.range.start}`); return; }
  input.children.push(await parseChild(input.runtime, input.buffer, input.source, input.range, languageId));
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
