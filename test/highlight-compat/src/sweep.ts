import type { SpanTriples } from './schema.ts'

/**
 * `aStarts`/`bStarts` say whether a span of that track begins at `from`, which makes `from` a raw
 * token boundary of that track when `from > 0`.
 */
export type IntervalVisitor = (
  from: number,
  to: number,
  aValue: number,
  bValue: number,
  aStarts: boolean,
  bStarts: boolean,
) => void

/**
 * Visits every interval of the union of both tracks' span endpoints, in order. Both tracks must
 * tile the same `[0, length)`; memory is constant and time is linear in the span counts.
 */
export function sweep(a: SpanTriples, b: SpanTriples, visit: IntervalVisitor): void {
  let i = 0
  let j = 0
  let from = 0
  let aStarts = true
  let bStarts = true
  while (i < a.length && j < b.length) {
    const aTo = a[i + 1]
    const bTo = b[j + 1]
    const to = aTo < bTo ? aTo : bTo
    visit(from, to, a[i + 2], b[j + 2], aStarts, bStarts)
    aStarts = aTo === to
    bStarts = bTo === to
    if (aStarts) i += 3
    if (bStarts) j += 3
    from = to
  }
}
