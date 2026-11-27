import type { ScopeCompat, ScopePack } from './runtime.ts';
import type { ScopeTheme } from './theme.ts';
import type {
  ResolveThemeOptions,
  ScopeLimits,
  ScopeResult,
  SessionChange,
  SessionInvalidation,
  StyledResult,
  TreeSitterNode,
  TreeSitterTextBuffer,
  TreeSitterTree,
} from './types.ts';

interface TextSpan {
  readonly from: number;
  readonly to: number;
}

const JS_TS_LANGUAGES = new Set(['javascript', 'jsx', 'typescript', 'tsx']);
const JS_TS_EXPANDABLE = new Set([
  'program', 'statement_block', 'class_body', 'interface_body', 'object_type', 'enum_body', 'switch_body',
]);
const JS_TS_TRANSPARENT = new Set([
  'export_statement', 'function_declaration', 'generator_function_declaration', 'method_definition',
  'class_declaration', 'abstract_class_declaration', 'interface_declaration', 'enum_declaration',
  'module', 'internal_module', 'if_statement', 'else_clause', 'for_statement', 'for_in_statement',
  'while_statement', 'do_statement', 'try_statement', 'catch_clause', 'finally_clause',
  'switch_statement', 'switch_case', 'switch_default',
]);
const JSON_EXPANDABLE = new Set(['document', 'object', 'array']);
const MAX_LOCAL_RATIO = 0.8;
const MAX_DESCENT_DEPTH = 32;

function isExpandable(isJson: boolean, type: string): boolean {
  return isJson ? JSON_EXPANDABLE.has(type) : JS_TS_EXPANDABLE.has(type);
}

function canDescend(isJson: boolean, parentType: string, childType: string): boolean {
  if (isJson) return parentType === 'document' && (childType === 'object' || childType === 'array');
  return JS_TS_EXPANDABLE.has(childType) || JS_TS_TRANSPARENT.has(childType);
}

function lowerBoundChild(parent: TreeSitterNode, count: number, offset: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const child = parent.namedChild(mid);
    if (child && child.endIndex < offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function containingNamedChild(parent: TreeSitterNode, span: TextSpan): TreeSitterNode | undefined {
  const count = parent.namedChildCount;
  if (count <= 0) return undefined;
  const index = lowerBoundChild(parent, count, span.from);
  if (index >= count) return undefined;
  const child = parent.namedChild(index);
  return child && child.startIndex <= span.from && child.endIndex >= span.to ? child : undefined;
}

function deepestSafeContainer(root: TreeSitterNode, languageId: string, span: TextSpan): TreeSitterNode | undefined {
  const isJson = languageId === 'json';
  if (!isJson && !JS_TS_LANGUAGES.has(languageId)) return undefined;
  let node = root;
  let best: TreeSitterNode | undefined = isExpandable(isJson, node.type) ? node : undefined;
  for (let depth = 0; depth < MAX_DESCENT_DEPTH; depth++) {
    const next = containingNamedChild(node, span);
    if (!next || !canDescend(isJson, node.type, next.type)) break;
    node = next;
    if (isExpandable(isJson, node.type)) best = node;
  }
  return best;
}

function isLeadingAttachment(type: string): boolean {
  return type === 'decorator' || type === 'comment';
}

function widenSiblingBounds(container: TreeSitterNode, count: number, span: TextSpan): { lo: number; hi: number } {
  let lo = Math.min(lowerBoundChild(container, count, span.from), count - 1);
  while (lo > 0 && (container.namedChild(lo - 1)?.endIndex ?? -1) >= span.from) lo--;
  let hi = lo;
  while (hi + 1 < count && (container.namedChild(hi + 1)?.startIndex ?? Number.MAX_SAFE_INTEGER) <= span.to) hi++;
  lo = Math.max(0, lo - 1);
  while (lo > 0 && isLeadingAttachment(container.namedChild(lo)?.type ?? '')) lo--;
  hi = Math.min(count - 1, hi + 1);
  while (hi + 1 < count && isLeadingAttachment(container.namedChild(hi)?.type ?? '')) hi++;
  while (hi + 1 < count && container.namedChild(hi + 1)?.type === 'comment') hi++;
  return { lo, hi };
}

function isSplitUnit(source: string, offset: number): boolean {
  const prev = source.charCodeAt(offset - 1);
  const curr = source.charCodeAt(offset);
  if (prev === 13 && curr === 10) return true;
  return prev >= 0xd800 && prev <= 0xdbff && curr >= 0xdc00 && curr <= 0xdfff;
}

function editHull(
  edits: readonly SessionChange['edits'][number][],
  oldLength: number,
  newLength: number,
): { readonly from: number; readonly to: number; readonly delta: number } | undefined {
  const ordered = edits.toSorted((a, b) => a.from - b.from || a.to - b.to);
  let newFrom = newLength;
  let newTo = 0;
  let delta = 0;
  let prevTo = 0;
  for (const edit of ordered) {
    if (edit.from < prevTo || edit.to < edit.from || edit.to > oldLength || edit.insertLength < 0) return undefined;
    const start = edit.from + delta;
    const end = start + edit.insertLength;
    if (start < newFrom) newFrom = start;
    if (end > newTo) newTo = end;
    delta += edit.insertLength - (edit.to - edit.from);
    prevTo = edit.to;
  }
  if (oldLength + delta !== newLength) return undefined;
  return { from: newFrom, to: newTo, delta };
}

function computeLocalWindow(
  tree: TreeSitterTree,
  languageId: string,
  oldLength: number,
  newLength: number,
  change: SessionChange,
): { readonly oldRange: TextSpan; readonly newRange: TextSpan } | undefined {
  if (!change.edits.length || newLength === 0) return undefined;
  const edits = editHull(change.edits, oldLength, newLength);
  if (!edits) return undefined;
  let newFrom = edits.from;
  let newTo = edits.to;
  const delta = edits.delta;
  for (const range of change.changedRanges ?? []) {
    const start = Math.max(0, Math.min(newLength, range.startIndex));
    const end = Math.max(start, Math.min(newLength, range.endIndex));
    if (start < newFrom) newFrom = start;
    if (end > newTo) newTo = end;
  }
  const hull: TextSpan = { from: Math.max(0, newFrom - 1), to: Math.min(newLength, newTo + 1) };
  const root = tree.rootNode;
  const container = deepestSafeContainer(root, languageId, hull);
  if (!container || container.namedChildCount <= 0) return undefined;
  const count = container.namedChildCount;
  const { lo, hi } = widenSiblingBounds(container, count, hull);
  const isRoot = container === root;
  const leftChild = container.namedChild(lo);
  const rightChild = container.namedChild(hi);
  let from = lo > 0 && leftChild ? Math.min(hull.from, leftChild.startIndex) : (isRoot ? 0 : Math.min(hull.from, container.startIndex));
  let to = hi + 1 < count && rightChild ? Math.max(hull.to, rightChild.endIndex) : (isRoot ? newLength : Math.max(hull.to, container.endIndex));
  if (change.source && change.source.length === newLength) {
    if (from > 0 && isSplitUnit(change.source, from)) from--;
    if (to > 0 && to < newLength && isSplitUnit(change.source, to)) to++;
  }
  const oldFrom = from;
  const oldTo = to - delta;
  if (oldFrom < 0 || oldTo < oldFrom || oldTo > oldLength) return undefined;
  if (from === 0 && to === newLength) return undefined;
  if (to - from >= Math.floor(newLength * MAX_LOCAL_RATIO)) return undefined;
  return { oldRange: { from: oldFrom, to: oldTo }, newRange: { from, to } };
}

function internResultPath(
  path: readonly number[],
  paths: (readonly number[])[],
  byKey: Map<string, number>,
): number {
  const key = path.join(',');
  const known = byKey.get(key);
  if (known !== undefined) return known;
  const id = paths.length;
  paths.push(path);
  byKey.set(key, id);
  return id;
}

function appendSegment(out: number[], from: number, to: number, pathId: number): void {
  if (to <= from) return;
  const len = out.length;
  if (len > 0 && out[len - 2] === from && out[len - 1] === pathId) {
    out[len - 2] = to;
    return;
  }
  out.push(from, to, pathId);
}

function spliceScopeResult(
  previous: ScopeResult,
  local: ScopeResult,
  oldRange: TextSpan,
  newRange: TextSpan,
  newLength: number,
): ScopeResult {
  const paths: (readonly number[])[] = [];
  const byKey = new Map<string, number>();
  const oldMap = previous.paths.map(path => internResultPath(path, paths, byKey));
  const localMap = local.paths.map(path => internResultPath(path, paths, byKey));
  const out: number[] = [];
  const prevSeg = previous.segments;
  for (let i = 0; i < prevSeg.length; i += 3) {
    const from = prevSeg[i];
    if (from >= oldRange.from) break;
    appendSegment(out, from, Math.min(prevSeg[i + 1], oldRange.from), oldMap[prevSeg[i + 2]]);
  }
  const locSeg = local.segments;
  for (let i = 0; i < locSeg.length; i += 3) {
    appendSegment(out, locSeg[i], locSeg[i + 1], localMap[locSeg[i + 2]]);
  }
  const shift = newRange.to - oldRange.to;
  for (let i = 0; i < prevSeg.length; i += 3) {
    const to = prevSeg[i + 1];
    if (to <= oldRange.to) continue;
    const from = Math.max(prevSeg[i], oldRange.to);
    appendSegment(out, from + shift, to + shift, oldMap[prevSeg[i + 2]]);
  }
  return Object.freeze({
    sourceLength: newLength,
    window: Object.freeze({ start: 0, end: newLength }),
    segments: Uint32Array.from(out),
    paths: Object.freeze(paths),
    scopes: previous.scopes,
  });
}

export class ScopeHighlightSession {
  readonly #compat: ScopeCompat;
  readonly #pack: ScopePack;
  readonly #languageId: string;
  #current: ScopeResult | undefined;
  #hadError = false;
  #lastInvalidation: SessionInvalidation | undefined;

  constructor(compat: ScopeCompat, pack: ScopePack, languageId: string) {
    this.#compat = compat;
    this.#pack = pack;
    this.#languageId = languageId;
  }

  get current(): ScopeResult | undefined {
    return this.#current;
  }

  get lastInvalidation(): SessionInvalidation | undefined {
    return this.#lastInvalidation;
  }

  update(
    tree: TreeSitterTree,
    buffer: TreeSitterTextBuffer,
    change?: SessionChange,
    limits?: ScopeLimits,
  ): ScopeResult {
    const hasError = Boolean(tree.rootNode.hasError);
    const previous = this.#current;
    const newLength = buffer.length;
    const local = previous && change && !this.#hadError && !hasError
      ? computeLocalWindow(tree, this.#languageId, previous.sourceLength, newLength, change)
      : undefined;
    if (local && previous) {
      const partial = this.#compat.highlightTree(
        this.#pack,
        tree,
        buffer,
        limits ? { window: { start: local.newRange.from, end: local.newRange.to }, limits } : { window: { start: local.newRange.from, end: local.newRange.to } },
      );
      this.#current = spliceScopeResult(previous, partial, local.oldRange, local.newRange, newLength);
      this.#hadError = false;
      this.#lastInvalidation = Object.freeze({
        mode: 'local-range',
        oldRange: Object.freeze({ ...local.oldRange }),
        newRange: Object.freeze({ ...local.newRange }),
        sourceLength: newLength,
      });
      return this.#current;
    }
    const full = this.#compat.highlightTree(this.#pack, tree, buffer, limits ? { limits } : undefined);
    this.#current = full;
    this.#hadError = hasError;
    this.#lastInvalidation = Object.freeze({
      mode: 'full-document',
      oldRange: Object.freeze({ from: 0, to: previous?.sourceLength ?? 0 }),
      newRange: Object.freeze({ from: 0, to: newLength }),
      sourceLength: newLength,
    });
    return full;
  }

  resolveTheme(theme: ScopeTheme, options?: ResolveThemeOptions): StyledResult {
    if (!this.#current) throw new Error('Session has no highlighted snapshot; call update() first');
    return theme.resolve(this.#current, options);
  }

  reset(): void {
    this.#current = undefined;
    this.#hadError = false;
    this.#lastInvalidation = undefined;
  }
}
