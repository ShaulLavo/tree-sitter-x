import type { Expectation } from '../expectations.ts'
import { originalRange, physicalLines } from './source-map.ts'
import type { SourceMapSegment } from './source-map.ts'

export interface TmgrammarFixture {
  readonly source: string
  readonly sourceMap: readonly SourceMapSegment[]
  /** Ranges into the exact annotated input. */
  readonly expectations: readonly Expectation[]
  /** Ranges for checking a result produced from `source`. */
  readonly strippedExpectations: readonly Expectation[]
}

interface AssertionRange {
  readonly from: number
  readonly to: number
  readonly column: number
  readonly scopes: readonly string[]
  readonly not: readonly string[]
}

function scopeList(positive: string, negative: string): { scopes: readonly string[]; not: readonly string[] } {
  const scopes = positive.split(/\s+/).filter(Boolean)
  const not = negative.split(/\s+/).filter(Boolean)
  if (scopes.length + not.length === 0) throw new Error('tmgrammar assertion requires a scope or exclusion')
  return { scopes, not }
}

const leftArrow = /^(\s*)<([~]*)([-]+)((?:\s*\w[-\w.]*)*)(?:\s*-)?((?:\s*\w[-\w.]*)*)\s*$/
const upArrow = /^\s*((?:(?:\^+)\s*)+)((?:\s*\w[-\w.]*)*)(?:\s*-)?((?:\s*\w[-\w.]*)*)\s*$/

function assertionRanges(text: string, comment: string): readonly AssertionRange[] | undefined {
  if (!text.startsWith(comment)) return undefined
  const body = text.slice(comment.length)
  if (!/^\s*(?:\^|<~*-)/.test(body)) return undefined
  const left = leftArrow.exec(body)
  if (left) return [{
    from: left[2].length, to: left[2].length + left[3].length,
    column: text.indexOf('<') + 1, ...scopeList(left[4], left[5]),
  }]
  const up = upArrow.exec(body)
  if (!up) throw new Error(`invalid tmgrammar caret assertion ${JSON.stringify(text)}`)
  const start = text.indexOf('^')
  return [...up[1].matchAll(/\^+/g)].map(match => ({
    from: start + match.index, to: start + match.index + match[0].length,
    column: start + match.index + 1, ...scopeList(up[2], up[3]),
  }))
}

export function adaptTmgrammar(original: string, fixtureId: string, file: string): TmgrammarFixture {
  const lines = physicalLines(original)
  const header = /^([^\s]+)\s+SYNTAX\s+TEST\s+"[^\"]+"(?:\s+"[^\"]*")?\s*$/.exec(lines[0].text)
  if (!header) throw new Error('tmgrammar fixture needs a SYNTAX TEST header')
  const segments: SourceMapSegment[] = []
  const chunks: string[] = []
  const strippedExpectations: Expectation[] = []
  let length = 0
  let previous: { from: number; text: string } | undefined
  for (const line of lines.slice(1)) {
    const ranges = assertionRanges(line.text, header[1])
    if (!ranges) {
      const text = original.slice(line.from, line.end)
      chunks.push(text)
      if (text.length > 0) segments.push({ from: length, to: length + text.length, originalFrom: line.from })
      previous = { from: length, text: line.text }
      length += text.length
      continue
    }
    if (!previous) throw new Error(`tmgrammar assertion has no preceding source at line ${line.number}`)
    for (const range of ranges) {
      if (range.to > previous.text.length) throw new Error(`tmgrammar assertion outside source at line ${line.number}`)
      strippedExpectations.push({
        fixtureId, from: previous.from + range.from, to: previous.from + range.to, scopes: range.scopes,
        ...(range.not.length > 0 ? { not: range.not } : {}),
        origin: { family: 'tmgrammar', file, line: line.number, column: range.column },
      })
    }
  }
  return {
    source: chunks.join(''), sourceMap: segments, strippedExpectations,
    expectations: strippedExpectations.map(expectation => ({ ...expectation, ...originalRange(segments, expectation.from, expectation.to) })),
  }
}
