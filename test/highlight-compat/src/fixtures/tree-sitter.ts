import type { ExpectationOrigin } from '../expectations.ts'
import { physicalLines } from './source-map.ts'

export interface CaptureExpectation {
  readonly fixtureId: string
  readonly from: number
  readonly to: number
  readonly capture: string
  readonly negative: boolean
  readonly origin: ExpectationOrigin
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })

function boundaries(text: string): readonly number[] {
  return [...graphemes.segment(text)].map(segment => segment.index).concat(text.length)
}

interface CaptureAnnotation {
  readonly column: number
  readonly length: number
  readonly arrow: number
  readonly capture: string
  readonly negative: boolean
}

function annotation(text: string, comment: string): CaptureAnnotation | undefined {
  const start = text.search(/\S/)
  if (start < 0 || !text.slice(start).startsWith(comment)) return undefined
  const body = text.slice(start + comment.length)
  const match = /^\s*(\^+|<-)(?:\s*(!))?\s*([\w.-]+)\s*$/.exec(body)
  if (!match) {
    if (/^\s*(?:\^|<-)/.test(body)) throw new Error(`invalid capture assertion ${JSON.stringify(text)}`)
    return undefined
  }
  const arrow = start + comment.length + body.indexOf(match[1])
  const columnOffset = match[1] === '<-' ? start : arrow
  return {
    column: boundaries(text.slice(0, columnOffset)).length - 1,
    length: match[1] === '<-' ? 1 : match[1].length,
    arrow, capture: match[3], negative: match[2] === '!',
  }
}

/** Tree-sitter test columns count grapheme clusters; output ranges count UTF-16 units. */
export function adaptTreeSitter(source: string, fixtureId: string, file: string, comment = '//'): readonly CaptureExpectation[] {
  const lines = physicalLines(source)
  const annotations = lines.map(line => annotation(line.text, comment))
  const expectations: CaptureExpectation[] = []
  for (const [row, item] of annotations.entries()) {
    if (!item) continue
    let target = row - 1
    while (target >= 0 && (annotations[target] || boundaries(lines[target].text).length - 1 <= item.column)) target--
    if (target < 0) throw new Error(`capture assertion has no preceding source at line ${row + 1}`)
    const line = lines[target]
    const offsets = boundaries(line.text)
    if (item.column + item.length >= offsets.length) throw new Error(`capture assertion outside source at line ${row + 1}`)
    expectations.push({
      fixtureId, from: line.from + offsets[item.column], to: line.from + offsets[item.column + item.length],
      capture: item.capture, negative: item.negative,
      origin: { family: 'tree-sitter-highlight', file, line: row + 1, column: item.arrow + 1 },
    })
  }
  return expectations
}
