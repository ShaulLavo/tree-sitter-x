import { ScopeCompatError } from './types.ts';
import type {
  FallbackHighlightOptions,
  ScopeResult,
  ScopeWindow,
  TreeSitterCapture,
  TreeSitterCaptureRange,
  TreeSitterQuery,
  TreeSitterTree,
} from './types.ts';

/**
 * Universal Zed-plus Tree-sitter capture-to-TextMate scope stack map.
 * Covers standard Zed, Neovim, Helix, and upstream Tree-sitter highlights.scm captures
 * with longest-prefix dotted degradation (e.g. `keyword.control.async` -> `keyword.control`).
 */
export const ZED_PLUS_CAPTURE_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Comments
  comment: Object.freeze(['comment']),
  'comment.line': Object.freeze(['comment.line']),
  'comment.block': Object.freeze(['comment.block']),
  'comment.documentation': Object.freeze(['comment.block.documentation']),
  'comment.doc': Object.freeze(['comment.block.documentation']),

  // Keywords & storage
  keyword: Object.freeze(['keyword.control']),
  'keyword.control': Object.freeze(['keyword.control']),
  'keyword.control.conditional': Object.freeze(['keyword.control.conditional']),
  'keyword.control.repeat': Object.freeze(['keyword.control.loop']),
  'keyword.control.return': Object.freeze(['keyword.control.flow']),
  'keyword.control.flow': Object.freeze(['keyword.control.flow']),
  'keyword.control.import': Object.freeze(['keyword.control.import']),
  'keyword.control.exception': Object.freeze(['keyword.control.trycatch']),
  'keyword.import': Object.freeze(['keyword.control.import']),
  'keyword.declaration': Object.freeze(['storage.type']),
  'keyword.function': Object.freeze(['storage.type.function']),
  'keyword.type': Object.freeze(['storage.type']),
  'keyword.storage': Object.freeze(['storage.type']),
  'keyword.storage.type': Object.freeze(['storage.type']),
  'keyword.storage.modifier': Object.freeze(['storage.modifier']),
  'keyword.modifier': Object.freeze(['storage.modifier']),
  'keyword.operator': Object.freeze(['keyword.operator']),
  'keyword.directive': Object.freeze(['meta.preprocessor', 'keyword.control.directive']),
  'keyword.coroutine': Object.freeze(['keyword.control.flow']),
  conditional: Object.freeze(['keyword.control.conditional']),
  repeat: Object.freeze(['keyword.control.loop']),
  include: Object.freeze(['keyword.control.import']),
  exception: Object.freeze(['keyword.control.trycatch']),
  preproc: Object.freeze(['meta.preprocessor', 'keyword.control.directive']),
  'storage.type': Object.freeze(['storage.type']),
  'storage.modifier': Object.freeze(['storage.modifier']),

  // Functions & methods
  function: Object.freeze(['entity.name.function']),
  'function.builtin': Object.freeze(['support.function']),
  'function.call': Object.freeze(['entity.name.function']),
  'function.method': Object.freeze(['entity.name.function.method']),
  'function.method.call': Object.freeze(['entity.name.function.method']),
  'function.macro': Object.freeze(['entity.name.function.macro']),
  'function.special': Object.freeze(['entity.name.function.macro']),
  method: Object.freeze(['entity.name.function.method']),
  'method.call': Object.freeze(['entity.name.function.method']),
  constructor: Object.freeze(['entity.name.type']),

  // Variables, parameters, properties & attributes
  variable: Object.freeze(['variable.other.readwrite']),
  'variable.builtin': Object.freeze(['variable.language']),
  'variable.parameter': Object.freeze(['variable.parameter']),
  'variable.constant': Object.freeze(['variable.other.constant']),
  'variable.member': Object.freeze(['variable.other.property']),
  'variable.special': Object.freeze(['variable.language']),
  parameter: Object.freeze(['variable.parameter']),
  property: Object.freeze(['variable.other.property']),
  field: Object.freeze(['variable.other.property']),
  attribute: Object.freeze(['entity.other.attribute-name']),
  'attribute.builtin': Object.freeze(['entity.other.attribute-name']),

  // Types, namespaces, labels & lifetimes
  type: Object.freeze(['entity.name.type']),
  'type.builtin': Object.freeze(['support.type.primitive', 'support.type']),
  'type.definition': Object.freeze(['entity.name.type']),
  'type.parameter': Object.freeze(['entity.name.type.parameter']),
  'type.interface': Object.freeze(['entity.name.type.interface']),
  'type.enum': Object.freeze(['entity.name.type.enum']),
  'type.struct': Object.freeze(['entity.name.type.struct']),
  'type.class': Object.freeze(['entity.name.type.class']),
  'type.super': Object.freeze(['entity.other.inherited-class']),
  namespace: Object.freeze(['entity.name.namespace']),
  module: Object.freeze(['entity.name.namespace']),
  label: Object.freeze(['entity.name.label']),
  lifetime: Object.freeze(['storage.modifier.lifetime', 'entity.name.type.lifetime']),

  // Constants, numbers, booleans & strings
  constant: Object.freeze(['constant']),
  'constant.builtin': Object.freeze(['constant.language']),
  'constant.character': Object.freeze(['constant.character']),
  'constant.numeric': Object.freeze(['constant.numeric.decimal']),
  'constant.numeric.integer': Object.freeze(['constant.numeric.integer']),
  'constant.numeric.float': Object.freeze(['constant.numeric.float']),
  number: Object.freeze(['constant.numeric.decimal']),
  'number.float': Object.freeze(['constant.numeric.float']),
  float: Object.freeze(['constant.numeric.float']),
  boolean: Object.freeze(['constant.language.boolean']),
  character: Object.freeze(['constant.character']),
  string: Object.freeze(['string.quoted']),
  'string.documentation': Object.freeze(['string.quoted.docstring']),
  'string.escape': Object.freeze(['constant.character.escape']),
  'string.regex': Object.freeze(['string.regexp']),
  'string.regexp': Object.freeze(['string.regexp']),
  'string.special': Object.freeze(['string.regexp']),
  'string.special.key': Object.freeze(['support.type.property-name']),
  'string.special.symbol': Object.freeze(['constant.other.symbol']),
  'string.special.url': Object.freeze(['markup.underline.link']),
  'string.special.uri': Object.freeze(['markup.underline.link']),
  'string.special.path': Object.freeze(['string.other.path']),
  escape: Object.freeze(['constant.character.escape']),

  // Operators & punctuation
  operator: Object.freeze(['keyword.operator']),
  punctuation: Object.freeze(['punctuation']),
  'punctuation.bracket': Object.freeze(['punctuation.section']),
  'punctuation.delimiter': Object.freeze(['punctuation.separator']),
  'punctuation.special': Object.freeze(['punctuation']),
  'punctuation.list_marker': Object.freeze(['punctuation.definition.list.begin']),

  // Tags (HTML / JSX / XML)
  tag: Object.freeze(['entity.name.tag']),
  'tag.builtin': Object.freeze(['entity.name.tag']),
  'tag.component': Object.freeze(['support.class.component']),
  'tag.attribute': Object.freeze(['entity.other.attribute-name']),
  'tag.delimiter': Object.freeze(['punctuation.definition.tag']),
  'tag.error': Object.freeze(['invalid.illegal.tag']),

  // Markup & Diff
  'markup.heading': Object.freeze(['markup.heading', 'entity.name.section']),
  'markup.heading.1': Object.freeze(['markup.heading', 'heading.1', 'entity.name.section']),
  'markup.heading.2': Object.freeze(['markup.heading', 'heading.2', 'entity.name.section']),
  'markup.heading.3': Object.freeze(['markup.heading', 'heading.3', 'entity.name.section']),
  'markup.heading.4': Object.freeze(['markup.heading', 'heading.4', 'entity.name.section']),
  'markup.heading.5': Object.freeze(['markup.heading', 'heading.5', 'entity.name.section']),
  'markup.heading.6': Object.freeze(['markup.heading', 'heading.6', 'entity.name.section']),
  title: Object.freeze(['markup.heading', 'entity.name.section']),
  'markup.bold': Object.freeze(['markup.bold']),
  'emphasis.strong': Object.freeze(['markup.bold']),
  'markup.italic': Object.freeze(['markup.italic']),
  emphasis: Object.freeze(['markup.italic']),
  'markup.strikethrough': Object.freeze(['markup.strikethrough']),
  'markup.raw': Object.freeze(['markup.fenced_code.block']),
  'markup.raw.block': Object.freeze(['markup.fenced_code.block']),
  'markup.raw.inline': Object.freeze(['markup.inline.raw.string']),
  'markup.inline.raw': Object.freeze(['markup.inline.raw.string']),
  'markup.link': Object.freeze(['meta.link']),
  'markup.link.label': Object.freeze(['string.other.link.title']),
  link_text: Object.freeze(['string.other.link.title']),
  'markup.link.url': Object.freeze(['markup.underline.link']),
  'markup.link.uri': Object.freeze(['markup.underline.link']),
  link_uri: Object.freeze(['markup.underline.link']),
  'markup.list': Object.freeze(['markup.list']),
  'markup.quote': Object.freeze(['markup.quote']),
  'diff.plus': Object.freeze(['markup.inserted']),
  'diff.minus': Object.freeze(['markup.deleted']),
  'diff.delta': Object.freeze(['markup.changed']),

  // Neutral / ignored captures
  embedded: Object.freeze([]),
  none: Object.freeze([]),
  spell: Object.freeze([]),
  nospell: Object.freeze([]),
});

export function resolveZedPlusScopes(captureName: string, scopeSuffix = ''): readonly string[] {
  const clean = captureName.startsWith('@') ? captureName.slice(1) : captureName;
  if (!clean || clean.startsWith('_')) return [];
  let key = clean;
  while (key.length > 0) {
    if (Object.hasOwn(ZED_PLUS_CAPTURE_MAP, key)) {
      const scopes = ZED_PLUS_CAPTURE_MAP[key];
      if (!scopeSuffix || scopes.length === 0) return scopes;
      return scopes.map(scope => `${scope}${scopeSuffix}`);
    }
    const dot = key.lastIndexOf('.');
    if (dot < 0) break;
    key = key.slice(0, dot);
  }
  return [];
}

interface CaptureSpan {
  readonly from: number;
  readonly to: number;
  readonly pattern: number;
  readonly ordinal: number;
  readonly scopeIds: readonly number[];
}

function compareCapture(a: CaptureSpan, b: CaptureSpan): number {
  return a.from - b.from || b.to - a.to || a.pattern - b.pattern || a.ordinal - b.ordinal;
}

function collectLineSeparators(source: string, window: ScopeWindow, boundaries: Set<number>): Map<number, number> {
  const separators = new Map<number, number>();
  let cursor = window.start;
  while (cursor < window.end) {
    const code = source.charCodeAt(cursor);
    if (code === 10) {
      separators.set(cursor, cursor + 1);
      boundaries.add(cursor);
      boundaries.add(cursor + 1);
      cursor++;
      continue;
    }
    if (code === 13) {
      const end = cursor + 1 < window.end && source.charCodeAt(cursor + 1) === 10 ? cursor + 2 : cursor + 1;
      separators.set(cursor, end);
      boundaries.add(cursor);
      boundaries.add(end);
      cursor = end;
      continue;
    }
    cursor++;
  }
  return separators;
}

function readRawRanges(
  query: TreeSitterQuery,
  tree: TreeSitterTree,
  window: ScopeWindow,
  matchLimit: number | undefined,
): readonly (TreeSitterCaptureRange | TreeSitterCapture)[] {
  const options = matchLimit !== undefined
    ? { startIndex: window.start, endIndex: window.end, matchLimit }
    : { startIndex: window.start, endIndex: window.end };
  if (typeof query.captureRanges === 'function') {
    return query.captureRanges(tree.rootNode, options);
  }
  return query.captures(tree.rootNode, options);
}

function captureBounds(entry: TreeSitterCaptureRange | TreeSitterCapture): { readonly startIndex: number; readonly endIndex: number } {
  return 'node' in entry ? entry.node : entry;
}

function buildCaptureSpans(
  rawCaptures: readonly (TreeSitterCaptureRange | TreeSitterCapture)[],
  captureNames: readonly string[],
  window: ScopeWindow,
  scopeSuffix: string,
  scopes: string[],
  scopeIds: Map<string, number>,
  boundaries: Set<number>,
): CaptureSpan[] {
  const nameToOrdinal = new Map<string, number>();
  const nameToScopeIds = new Map<string, readonly number[]>();
  for (let i = 0; i < captureNames.length; i++) {
    const name = captureNames[i];
    if (!nameToOrdinal.has(name)) nameToOrdinal.set(name, i);
    const resolved = resolveZedPlusScopes(name, scopeSuffix);
    const ids = resolved.map(scope => {
      let id = scopeIds.get(scope);
      if (id === undefined) {
        id = scopes.length;
        scopes.push(scope);
        scopeIds.set(scope, id);
      }
      return id;
    });
    nameToScopeIds.set(name, ids);
  }
  const spans: CaptureSpan[] = [];
  for (const capture of rawCaptures) {
    const ids = nameToScopeIds.get(capture.name);
    if (!ids || ids.length === 0) continue;
    const bounds = captureBounds(capture);
    const from = Math.max(window.start, bounds.startIndex);
    const to = Math.min(window.end, bounds.endIndex);
    if (from >= to) continue;
    spans.push({
      from,
      to,
      pattern: capture.patternIndex,
      ordinal: nameToOrdinal.get(capture.name) ?? 0,
      scopeIds: ids,
    });
    boundaries.add(from);
    boundaries.add(to);
  }
  spans.sort(compareCapture);
  return spans;
}

function pruneExpired(active: CaptureSpan[], from: number): void {
  let write = 0;
  for (let read = 0; read < active.length; read++) {
    if (active[read].to > from) active[write++] = active[read];
  }
  active.length = write;
}

function advanceCaptures(active: CaptureSpan[], spans: readonly CaptureSpan[], index: number, from: number): number {
  let cursor = index;
  while (cursor < spans.length && spans[cursor].from <= from) {
    if (spans[cursor].to > from) active.push(spans[cursor]);
    cursor++;
  }
  return cursor;
}

function buildActivePath(
  active: readonly CaptureSpan[],
  paths: (readonly number[])[],
  pathIndex: Map<string, number>,
): number {
  if (active.length === 0) return 1;
  const stack: number[] = [0];
  for (const span of active) {
    for (const id of span.scopeIds) {
      if (stack[stack.length - 1] !== id) stack.push(id);
    }
  }
  const key = stack.join(',');
  const existing = pathIndex.get(key);
  if (existing !== undefined) return existing;
  const id = paths.length;
  paths.push(Object.freeze(stack));
  pathIndex.set(key, id);
  return id;
}

export function highlightTreeWithFallback(
  query: TreeSitterQuery,
  tree: TreeSitterTree,
  source: string,
  options: FallbackHighlightOptions,
): ScopeResult {
  const sourceLength = source.length;
  const window: ScopeWindow = options.window
    ? Object.freeze({ start: options.window.start, end: options.window.end })
    : Object.freeze({ start: 0, end: sourceLength });
  if (window.start < 0 || window.start > window.end || window.end > sourceLength) {
    throw new RangeError(`Invalid fallback window [${window.start}, ${window.end}) for length ${sourceLength}`);
  }
  if (!options.rootScope || /\s/.test(options.rootScope)) {
    throw new ScopeCompatError('Fallback rootScope must be a non-empty scope name without whitespace', 3, 6);
  }
  if (window.start === window.end) {
    return Object.freeze({
      sourceLength,
      window,
      segments: new Uint32Array(0),
      paths: Object.freeze([Object.freeze([])]),
      scopes: Object.freeze([options.rootScope]),
    });
  }
  const rawCaptures = readRawRanges(query, tree, window, options.matchLimit);
  if (query.didExceedMatchLimit()) {
    throw new ScopeCompatError('Fallback query exceeded match limit', 2, 22, options.matchLimit ?? 0);
  }
  const scopes: string[] = [options.rootScope];
  const scopeIds = new Map<string, number>([[options.rootScope, 0]]);
  const boundaries = new Set<number>([window.start, window.end]);
  const spans = buildCaptureSpans(
    rawCaptures,
    query.captureNames,
    window,
    options.scopeSuffix ?? '',
    scopes,
    scopeIds,
    boundaries,
  );
  const separators = collectLineSeparators(source, window, boundaries);
  const points = Array.from(boundaries);
  points.sort((a, b) => a - b);
  const paths: (readonly number[])[] = [Object.freeze([]), Object.freeze([0])];
  const pathIndex = new Map<string, number>([['', 0], ['0', 1]]);
  const active: CaptureSpan[] = [];
  const rawSegments: number[] = [];
  let spanIndex = 0;
  let separatorEnd = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    pruneExpired(active, from);
    spanIndex = advanceCaptures(active, spans, spanIndex, from);
    const sep = separators.get(from);
    if (sep !== undefined) separatorEnd = sep;
    const pathId = from < separatorEnd ? 0 : buildActivePath(active, paths, pathIndex);
    const len = rawSegments.length;
    if (len > 0 && rawSegments[len - 2] === from && rawSegments[len - 1] === pathId) {
      rawSegments[len - 2] = to;
    } else {
      rawSegments.push(from, to, pathId);
    }
  }
  return Object.freeze({
    sourceLength,
    window,
    segments: Uint32Array.from(rawSegments),
    paths: Object.freeze(paths),
    scopes: Object.freeze(scopes),
  });
}
