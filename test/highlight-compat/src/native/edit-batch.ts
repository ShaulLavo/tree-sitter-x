export interface Edit { readonly from: number; readonly to: number; readonly insert: string }
export interface NumericLimits { readonly index: number; readonly column: number; readonly row: number }
export const BINDING_LIMITS: NumericLimits = Object.freeze({ index: 0x7fffffff, column: 0x7fffffff, row: 0xffffffff });
export interface Point { readonly row: number; readonly column: number }
export interface TextSpan { readonly from: number; readonly to: number }
export interface PreparedEdit {
  readonly edit: Edit;
  readonly binding: Readonly<{ startIndex: number; oldEndIndex: number; newEndIndex: number; startPosition: Point; oldEndPosition: Point; newEndPosition: Point }>;
}
export function integer(value: number, ceiling = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > ceiling) throw new RangeError('Numeric limit exceeded');
  return value;
}
export function pointAt(source: string, offset: number, limits: NumericLimits = BINDING_LIMITS): Point {
  integer(offset, Math.min(source.length, limits.index));
  let row = 0, column = 0;
  for (let i = 0; i < offset; i++) {
    if (source.charCodeAt(i) === 10) { row++; column = 0; } else column++;
    integer(row, limits.row); integer(column, limits.column);
  }
  return Object.freeze({ row, column });
}
function validateSource(source: string, limits: NumericLimits): void {
  integer(source.length, limits.index); pointAt(source, source.length, limits);
}
export function prepareEdits(source: string, input: readonly Edit[], limits: NumericLimits = BINDING_LIMITS) {
  integer(limits.index, BINDING_LIMITS.index); integer(limits.column, BINDING_LIMITS.column); integer(limits.row, BINDING_LIMITS.row);
  validateSource(source, limits);
  const edits = input.map(edit => Object.freeze({ from: edit.from, to: edit.to, insert: edit.insert }));
  edits.sort((a, b) => a.from - b.from || a.to - b.to);
  let previous: Edit | undefined, displacement = 0;
  const oldTextSpans: TextSpan[] = [], newTextSpans: TextSpan[] = [];
  for (const edit of edits) {
    integer(edit.from, source.length); integer(edit.to, source.length);
    if (typeof edit.insert !== 'string' || edit.to < edit.from) throw new RangeError('Invalid edit');
    if (previous && (edit.from < previous.to || edit.from === previous.from)) throw new RangeError('Overlapping or coincident edits');
    const from = integer(edit.from + displacement, limits.index), to = integer(from + edit.insert.length, limits.index);
    oldTextSpans.push(Object.freeze({ from: edit.from, to: edit.to })); newTextSpans.push(Object.freeze({ from, to }));
    displacement += edit.insert.length - (edit.to - edit.from); previous = edit;
  }
  const schedule: PreparedEdit[] = [];
  for (const edit of edits.reverse()) {
    integer(edit.insert.length, limits.index); integer(edit.from + edit.insert.length, limits.index);
    integer(source.length - (edit.to - edit.from) + edit.insert.length, limits.index);
    const startPosition = pointAt(source, edit.from, limits), oldEndPosition = pointAt(source, edit.to, limits);
    const next = source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
    validateSource(next, limits);
    schedule.push(Object.freeze({ edit, binding: Object.freeze({ startIndex: edit.from, oldEndIndex: edit.to,
      newEndIndex: edit.from + edit.insert.length, startPosition, oldEndPosition, newEndPosition: pointAt(next, edit.from + edit.insert.length, limits) }) }));
    source = next;
  }
  return Object.freeze({ source, schedule: Object.freeze(schedule), oldTextSpans: Object.freeze(oldTextSpans), newTextSpans: Object.freeze(newTextSpans) });
}
