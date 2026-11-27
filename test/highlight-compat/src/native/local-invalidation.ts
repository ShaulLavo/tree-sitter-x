import type { TextSpan } from './edit-batch.ts';
import type { OwnerKey } from './owner-state.ts';
import { foreign, invoke } from './runtime.ts';
import type { Foreign } from './runtime.ts';

export interface OwnerChange {
  readonly fromKey: OwnerKey;
  readonly toKey: OwnerKey;
  readonly oldLength: number;
  readonly newLength: number;
  readonly oldTextSpans: readonly TextSpan[];
  readonly newTextSpans: readonly TextSpan[];
  readonly changedRanges: readonly TextSpan[];
  readonly hadErrorBefore: boolean;
  readonly hasErrorAfter: boolean;
  readonly recovering: boolean;
}

export interface LocalWindow {
  readonly oldRange: TextSpan;
  readonly newRange: TextSpan;
}

export interface InvalidationRecord {
  readonly mode: 'local-range' | 'full-document';
  readonly oldRange: TextSpan;
  readonly newRange: TextSpan;
  readonly sourceLength: number;
  readonly reusedChildren: number;
  readonly rescopedChildren: number;
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

export function nodeHasError(tree: Foreign): boolean {
  return Boolean(foreign(tree.rootNode).hasError);
}

export function extractChangedRanges(raw: unknown, limit: number): readonly TextSpan[] {
  if (!Array.isArray(raw)) return [];
  const spans: TextSpan[] = [];
  for (const item of raw) {
    const range = foreign(item);
    const start = range.startIndex, end = range.endIndex;
    if (typeof start !== 'number' || typeof end !== 'number') continue;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue;
    const from = Math.max(0, Math.min(limit, start));
    const to = Math.max(from, Math.min(limit, end));
    spans.push(Object.freeze({ from, to }));
  }
  return Object.freeze(spans);
}

export function computeLocalWindow(
  tree: Foreign,
  languageId: string,
  source: string,
  change: OwnerChange,
): LocalWindow | undefined {
  const hull = baseHull(change);
  if (!hull) return undefined;
  const expanded = expandAstWindow(tree, languageId, source, hull.newRange);
  if (!expanded) return undefined;
  const delta = change.newLength - change.oldLength;
  const oldFrom = expanded.from, oldTo = expanded.to - delta;
  if (oldFrom < 0 || oldTo < oldFrom || oldTo > change.oldLength) return undefined;
  if (expanded.from === 0 && expanded.to === change.newLength) return undefined;
  if (change.newLength > 0 && expanded.to - expanded.from >= Math.floor(change.newLength * MAX_LOCAL_RATIO)) {
    return undefined;
  }
  return Object.freeze({
    oldRange: Object.freeze({ from: oldFrom, to: oldTo }),
    newRange: Object.freeze({ from: expanded.from, to: expanded.to }),
  });
}

function baseHull(change: OwnerChange): LocalWindow | undefined {
  if (change.recovering || change.hadErrorBefore || change.hasErrorAfter) return undefined;
  if (!change.oldTextSpans.length || !change.newTextSpans.length || !change.newLength) return undefined;
  let newFrom = change.newTextSpans[0].from;
  let newTo = change.newTextSpans[change.newTextSpans.length - 1].to;
  for (const span of change.changedRanges) {
    if (span.from < newFrom) newFrom = span.from;
    if (span.to > newTo) newTo = span.to;
  }
  newFrom = Math.max(0, newFrom - 1);
  newTo = Math.min(change.newLength, newTo + 1);
  const delta = change.newLength - change.oldLength;
  const oldFrom = newFrom, oldTo = newTo - delta;
  if (oldFrom < 0 || oldTo < oldFrom || oldTo > change.oldLength) return undefined;
  return { oldRange: { from: oldFrom, to: oldTo }, newRange: { from: newFrom, to: newTo } };
}

function expandAstWindow(tree: Foreign, languageId: string, source: string, span: TextSpan): TextSpan | undefined {
  const root = foreign(tree.rootNode);
  const container = deepestSafeContainer(root, languageId, span);
  if (!container) return undefined;
  const count = childCount(container);
  if (count <= 0) return undefined;
  const range = overlappingSiblingRange(container, count, span);
  const lo = widenLeft(container, range.lo);
  const hi = widenRight(container, count, range.hi);
  const isRoot = container === root;
  let from = lo > 0 ? Math.min(span.from, nodeStart(namedChild(container, lo))) : (isRoot ? 0 : Math.min(span.from, nodeStart(container)));
  let to = hi + 1 < count ? Math.max(span.to, nodeEnd(namedChild(container, hi))) : (isRoot ? source.length : Math.max(span.to, nodeEnd(container)));
  from = alignBoundaryLeft(source, Math.max(0, from));
  to = alignBoundaryRight(source, Math.min(source.length, to));
  return from <= to ? { from, to } : undefined;
}

function deepestSafeContainer(root: Foreign, languageId: string, span: TextSpan): Foreign | undefined {
  const isJson = languageId === 'json';
  if (!isJson && !JS_TS_LANGUAGES.has(languageId)) return undefined;
  const seenJsonKinds = new Set<string>();
  let node = root;
  let best: Foreign | undefined = isExpandable(isJson, nodeType(node)) ? node : undefined;
  for (let depth = 0; depth < MAX_DESCENT_DEPTH; depth++) {
    const next = containingNamedChild(node, span);
    if (!next) break;
    const type = nodeType(next);
    if (!canDescend(isJson, type, seenJsonKinds)) break;
    if (isJson && (type === 'object' || type === 'array')) seenJsonKinds.add(type);
    node = next;
    if (isExpandable(isJson, type)) best = node;
  }
  return best;
}

function isExpandable(isJson: boolean, type: string): boolean {
  return isJson ? JSON_EXPANDABLE.has(type) : JS_TS_EXPANDABLE.has(type);
}

function canDescend(isJson: boolean, type: string, seenJsonKinds: ReadonlySet<string>): boolean {
  if (isJson) {
    if (type === 'document' || type === 'pair') return true;
    return (type === 'object' || type === 'array') && !seenJsonKinds.has(type);
  }
  return JS_TS_EXPANDABLE.has(type) || JS_TS_TRANSPARENT.has(type);
}

function containingNamedChild(parent: Foreign, span: TextSpan): Foreign | undefined {
  const count = childCount(parent);
  if (count <= 0) return undefined;
  const index = lowerBoundChild(parent, count, span.from);
  if (index >= count) return undefined;
  const child = namedChild(parent, index);
  return nodeStart(child) <= span.from && nodeEnd(child) >= span.to ? child : undefined;
}

function overlappingSiblingRange(parent: Foreign, count: number, span: TextSpan): { lo: number; hi: number } {
  const first = lowerBoundChild(parent, count, span.from);
  let lo = Math.min(first, count - 1);
  while (lo > 0 && nodeEnd(namedChild(parent, lo - 1)) >= span.from) lo--;
  let hi = lo;
  while (hi + 1 < count && nodeStart(namedChild(parent, hi + 1)) <= span.to) hi++;
  return { lo, hi };
}

function lowerBoundChild(parent: Foreign, count: number, offset: number): number {
  let lo = 0, hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (nodeEnd(namedChild(parent, mid)) < offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function widenLeft(parent: Foreign, index: number): number {
  let lo = Math.max(0, index - 1);
  while (lo > 0 && isLeadingAttachment(nodeType(namedChild(parent, lo)))) lo--;
  return lo;
}

function widenRight(parent: Foreign, count: number, index: number): number {
  let hi = Math.min(count - 1, index + 1);
  while (hi + 1 < count && isLeadingAttachment(nodeType(namedChild(parent, hi)))) hi++;
  while (hi + 1 < count && isTrailingAttachment(nodeType(namedChild(parent, hi + 1)))) hi++;
  return hi;
}

function isLeadingAttachment(type: string): boolean {
  return type === 'decorator' || type === 'comment';
}

function isTrailingAttachment(type: string): boolean {
  return type === 'comment';
}

function alignBoundaryLeft(source: string, offset: number): number {
  return offset > 0 && isSplitUnit(source, offset) ? offset - 1 : offset;
}

function alignBoundaryRight(source: string, offset: number): number {
  return offset > 0 && offset < source.length && isSplitUnit(source, offset) ? offset + 1 : offset;
}

function isSplitUnit(source: string, offset: number): boolean {
  const prev = source.charCodeAt(offset - 1), curr = source.charCodeAt(offset);
  if (prev === 13 && curr === 10) return true;
  return prev >= 0xd800 && prev <= 0xdbff && curr >= 0xdc00 && curr <= 0xdfff;
}

function childCount(node: Foreign): number {
  const value = node.namedChildCount;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
}

function namedChild(node: Foreign, index: number): Foreign {
  return foreign(invoke(node, 'namedChild', [index]));
}

function nodeType(node: Foreign): string {
  return typeof node.type === 'string' ? node.type : '';
}

function nodeStart(node: Foreign): number {
  const value = node.startIndex;
  if (typeof value !== 'number') throw new Error('Invalid syntax node start');
  return value;
}

function nodeEnd(node: Foreign): number {
  const value = node.endIndex;
  if (typeof value !== 'number') throw new Error('Invalid syntax node end');
  return value;
}
