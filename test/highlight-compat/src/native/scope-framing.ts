import { OutputBudgetError } from './scope-output.ts';
import type { FramedScopes, FramingReason, ScopeSnapshot, SourceFacts } from './scope-output.ts';
import type { TextSpan } from './edit-batch.ts';

interface Bounds { readonly ranges: number; readonly bytes: number }
export function collectSourceFacts(source: string, identity: Pick<SourceFacts, 'owner' | 'generation'>, bounds: Bounds): SourceFacts {
  const separators: TextSpan[] = [], oversized: TextSpan[] = [];
  let ranges = 0, bytes = 256, start = 0, previous = -1;
  const charge = (size: number): void => {
    if (++ranges > bounds.ranges || bytes + size > bounds.bytes) throw new OutputBudgetError('Source fact budget');
    bytes += size;
  };
  if (bytes > bounds.bytes) throw new OutputBudgetError('Source fact byte budget');
  for (let i = 0; i < source.length; i++) {
    const unit = source.charCodeAt(i), crlf = previous === 13; previous = unit;
    if (unit !== 10) continue;
    const end = crlf ? i - 1 : i;
    appendOversized(oversized, start, end, charge);
    charge(16); separators.push(Object.freeze({ from: end, to: i + 1 })); start = i + 1;
  }
  let finalCr: TextSpan | null = null;
  if (previous === 13) { charge(16); finalCr = Object.freeze({ from: source.length - 1, to: source.length }); }
  appendOversized(oversized, start, finalCr?.from ?? source.length, charge);
  return Object.freeze({ ...identity, sourceLength: source.length, separators: Object.freeze(separators), oversized: Object.freeze(oversized), finalCr });
}
function appendOversized(spans: TextSpan[], from: number, to: number, charge: (size: number) => void): void {
  if (to - from <= 20000) return;
  charge(24); spans.push(Object.freeze({ from, to }));
}
export function sourceFactBytes(facts: SourceFacts): number {
  return 256 + facts.oversized.length * 24 + (facts.finalCr ? 16 : 0);
}
type Product = Extract<FramedScopes, { kind: 'product-lines' }>;
interface ProjectionPlan { readonly count: number; readonly empty: number; readonly bytes: number }
export function planProduct(snapshot: ScopeSnapshot, bounds: Bounds): ProjectionPlan {
  const found = snapshot.dictionary.paths.findIndex(path => !path.length);
  const empty = found < 0 ? snapshot.dictionary.paths.length : found;
  const dictionary = found < 0 ? 384 + (snapshot.dictionary.paths.length + 1) * 8 : 0;
  const separators = snapshot.sourceFacts.finalCr ? 128 + (snapshot.separators.length + 1) * 8 : 0;
  const fixed = 512 + dictionary + separators;
  let count = 0, previousPath = -1, previousReason: FramingReason | undefined;
  if (fixed > bounds.bytes) throw new OutputBudgetError('Product projection byte budget');
  sweep(snapshot, empty, (_from, _to, path, reason) => {
    if (previousPath === path && previousReason === reason) return;
    if (++count > bounds.ranges || fixed + count * 32 > bounds.bytes) throw new OutputBudgetError('Product projection budget');
    previousPath = path; previousReason = reason;
  });
  return { count, empty, bytes: fixed + count * 32 };
}
export function buildProduct(snapshot: ScopeSnapshot, plan: ProjectionPlan): Product {
  const segments = new Array<number>(plan.count * 3), reasons = new Array<FramingReason>(plan.count);
  let count = 0;
  sweep(snapshot, plan.empty, (from, to, path, reason) => {
    if (count && segments[count * 3 - 1] === path && reasons[count - 1] === reason) { segments[count * 3 - 2] = to; return; }
    segments[count * 3] = from; segments[count * 3 + 1] = to; segments[count * 3 + 2] = path; reasons[count++] = reason;
  });
  const dictionary = plan.empty < snapshot.dictionary.paths.length ? snapshot.dictionary : Object.freeze({ names: snapshot.dictionary.names,
    paths: Object.freeze(snapshot.dictionary.paths.concat([Object.freeze([])])) });
  const finalCr = snapshot.sourceFacts.finalCr;
  const separators = finalCr ? Object.freeze(snapshot.separators.concat([finalCr])) : snapshot.separators;
  return Object.freeze({ kind: 'product-lines', policy: 'future010-product-lines-v1', reasons: Object.freeze(reasons),
    snapshot: Object.freeze({ ...snapshot, dictionary, separators, segments: Object.freeze(segments) }) });
}
function nextRange(spans: readonly TextSpan[], index: number, from: number): number {
  while (index < spans.length && spans[index].to <= from) index++;
  return index;
}
function sweep(snapshot: ScopeSnapshot, empty: number, emit: (from: number, to: number, path: number, reason: FramingReason) => void): void {
  const facts = snapshot.sourceFacts;
  let separator = 0, mask = 0;
  for (let i = 0; i < snapshot.segments.length; i += 3) {
    let from = snapshot.segments[i]; const end = snapshot.segments[i + 1], path = snapshot.segments[i + 2];
    while (from < end) {
      separator = nextRange(facts.separators, separator, from); mask = nextRange(facts.oversized, mask, from);
      const span = facts.separators[separator] ?? (facts.finalCr && facts.finalCr.to > from ? facts.finalCr : undefined), plain = facts.oversized[mask];
      const isSeparator = !!span && span.from <= from, isPlain = !!plain && plain.from <= from;
      const to = Math.min(end, span ? isSeparator ? span.to : span.from : end, plain ? isPlain ? plain.to : plain.from : end);
      emit(from, to, isSeparator || isPlain ? empty : path, isSeparator ? 'separator' : isPlain ? 'plain-line' : 'classified'); from = to;
    }
  }
}
