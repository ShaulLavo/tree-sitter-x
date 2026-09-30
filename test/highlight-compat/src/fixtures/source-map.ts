export interface PhysicalLine {
  readonly text: string
  readonly from: number
  readonly to: number
  readonly end: number
  readonly number: number
}

export interface SourceMapSegment {
  readonly from: number
  readonly to: number
  readonly originalFrom: number
}

export function physicalLines(source: string): readonly PhysicalLine[] {
  const lines: PhysicalLine[] = []
  const terminators = /\r\n|\r|\n/g
  let from = 0
  for (const match of source.matchAll(terminators)) {
    const to = match.index
    lines.push({ text: source.slice(from, to), from, to, end: to + match[0].length, number: lines.length + 1 })
    from = to + match[0].length
  }
  lines.push({ text: source.slice(from), from, to: source.length, end: source.length, number: lines.length + 1 })
  return lines
}

export function originalRange(segments: readonly SourceMapSegment[], from: number, to: number): { from: number; to: number } {
  const segment = segments.find(segment => from >= segment.from && from < segment.to && to <= segment.to)
  if (!segment || to <= from) throw new RangeError(`range [${from}, ${to}) crosses removed source or is empty`)
  return { from: segment.originalFrom + from - segment.from, to: segment.originalFrom + to - segment.from }
}

export function offsetPosition(source: string, offset: number): { line: number; column: number } {
  const line = physicalLines(source).find(line => offset < line.end || line.end === source.length && offset <= line.end)
  if (!line) throw new RangeError(`offset ${offset} is outside the source`)
  return { line: line.number, column: offset - line.from + 1 }
}
