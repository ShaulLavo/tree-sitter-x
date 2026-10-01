import type { Style } from '../schema.ts'

/** One physical line: `text` excludes its terminator, which runs from `start + text.length` to `next`. */
export interface SourceLine {
  readonly text: string
  readonly start: number
  readonly next: number
}

const TERMINATOR = /\r?\n/g

/**
 * Splits on LF and CRLF, the rule the product tokenizer and Shiki share. A lone CR stays inside its
 * line as ordinary text. An empty source is one empty line.
 */
export function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let start = 0
  for (const match of source.matchAll(TERMINATOR)) {
    const next = match.index + match[0].length
    lines.push({ text: source.slice(start, match.index), start, next })
    start = next
  }
  lines.push({ text: source.slice(start), start, next: source.length })
  return lines
}

/** A span in line-relative UTF-16 units, as a tokenizer reports it. */
export interface LineSpan<V> {
  readonly from: number
  readonly to: number
  readonly value: V
}

export type SpanSink<V> = (from: number, to: number, value: V) => void

/**
 * Writes one track in document offsets. Spans are clipped to the line text, which drops the
 * tokenizer's synthetic end-of-line unit, and each terminator gets `separator`.
 */
export function writeTrack<V>(
  lines: readonly SourceLine[],
  spansOfLine: (line: number) => readonly LineSpan<V>[],
  write: SpanSink<V>,
  separator: V,
): void {
  lines.forEach((line, index) => {
    const end = line.text.length
    for (const span of spansOfLine(index)) {
      const to = Math.min(span.to, end)
      if (to <= span.from) continue
      write(line.start + span.from, line.start + to, span.value)
    }
    if (line.next > line.start + end) write(line.start + end, line.next, separator)
  })
}

export const SEPARATOR_SCOPES: readonly string[] = []
export const SEPARATOR_STYLE: Style = {}
