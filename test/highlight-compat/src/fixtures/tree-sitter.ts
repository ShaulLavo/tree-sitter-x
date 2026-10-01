import type { ExpectationOrigin } from '../expectations.ts'
import { physicalLines } from './source-map.ts'
import type { PhysicalLine } from './source-map.ts'

export interface CaptureExpectation {
  readonly fixtureId: string
  readonly from: number
  readonly to: number
  readonly capture: string
  readonly negative: boolean
  readonly origin: ExpectationOrigin
}

/** Exact UTF-16 ranges of comment nodes supplied by the language parser. */
export interface CommentRange {
  readonly from: number
  readonly to: number
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })

function boundaries(text: string): readonly number[] {
  return [...graphemes.segment(text)].map(segment => segment.index).concat(text.length)
}

interface CaptureAnnotation {
  readonly row: number
  readonly column: number
  readonly length: number
  readonly arrow: number
  readonly capture: string
  readonly negative: boolean
}

function annotation(source: string, lines: readonly PhysicalLine[], node: CommentRange, comment: string): CaptureAnnotation | undefined {
  if (!Number.isSafeInteger(node.from) || !Number.isSafeInteger(node.to) || node.from < 0 || node.to > source.length || node.from >= node.to) {
    throw new RangeError('comment node must have nonempty UTF-16 source offsets')
  }
  const text = source.slice(node.from, node.to)
  if (!/\^|<-/.test(text)) return undefined
  const row = lines.findIndex(line => node.from >= line.from && node.from <= line.to)
  const line = lines[row]
  if (!line || node.to > line.to || !text.startsWith(comment)) throw new Error('unsupported capture assertion comment shape')
  const body = text.slice(comment.length)
  const match = /(\^+|<-)(?:\s*(!))?\s*([\w.-]+)\s*$/.exec(body)
  if (!match) throw new Error(`invalid capture assertion ${JSON.stringify(text)}`)
  if (/\^|<-/.test(body.slice(0, match.index))) throw new Error('multiple capture arrows in one comment are unsupported')
  const start = node.from - line.from
  const arrow = start + comment.length + match.index
  const columnOffset = match[1] === '<-' ? start : arrow
  return {
    row, column: boundaries(line.text.slice(0, columnOffset)).length - 1,
    length: match[1] === '<-' ? 1 : match[1].length,
    arrow, capture: match[3], negative: match[2] === '!',
  }
}

/** Tree-sitter test columns count grapheme clusters; output ranges count UTF-16 units. */
export function adaptTreeSitter(source: string, fixtureId: string, file: string, comments: readonly CommentRange[], comment = '//'): readonly CaptureExpectation[] {
  const lines = physicalLines(source)
  const annotations = comments.map(node => annotation(source, lines, node, comment)).filter(item => item !== undefined)
  const assertionRows = new Set(annotations.map(item => item.row))
  const expectations: CaptureExpectation[] = []
  for (const item of annotations) {
    let target = item.row - 1
    while (target >= 0 && (assertionRows.has(target) || boundaries(lines[target].text).length - 1 <= item.column)) target--
    if (target < 0) throw new Error(`capture assertion has no preceding source at line ${item.row + 1}`)
    const line = lines[target]
    const offsets = boundaries(line.text)
    if (item.column + item.length >= offsets.length) throw new Error(`capture assertion outside source at line ${item.row + 1}`)
    expectations.push({
      fixtureId, from: line.from + offsets[item.column], to: line.from + offsets[item.column + item.length],
      capture: item.capture, negative: item.negative,
      origin: { family: 'tree-sitter-highlight', file, line: item.row + 1, column: item.arrow + 1 },
    })
  }
  return expectations
}
