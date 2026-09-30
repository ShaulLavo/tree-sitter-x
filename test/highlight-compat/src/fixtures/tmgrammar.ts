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

function scopeList(text: string): { scopes: readonly string[]; not: readonly string[] } {
  const words = text.trim().split(/\s+/)
  const minus = words.indexOf('-')
  const scopes = minus < 0 ? words : words.slice(0, minus)
  const not = minus < 0 ? [] : words.slice(minus + 1)
  if (scopes.length + not.length === 0 || [...scopes, ...not].some(scope => !/^[\w][\w.-]*$/.test(scope))) {
    throw new Error(`invalid tmgrammar scope assertion ${JSON.stringify(text)}`)
  }
  return { scopes, not }
}

function assertionRanges(text: string, comment: string): readonly { from: number; to: number; scopes: readonly string[]; not: readonly string[] }[] | undefined {
  if (!text.startsWith(comment)) return undefined
  const body = text.slice(comment.length)
  if (!/^\s*(?:\^|<~*-)/.test(body)) return undefined
  const left = /^\s*<(~*)(-+)\s+(.+?)\s*$/.exec(body)
  if (left) return [{ from: left[1].length, to: left[1].length + left[2].length, ...scopeList(left[3]) }]
  const up = /^\s*(\^+(?:\s+\^+)*)\s+(.+?)\s*$/.exec(body)
  if (!up) throw new Error(`invalid tmgrammar caret assertion ${JSON.stringify(text)}`)
  const start = text.indexOf('^')
  return [...up[1].matchAll(/\^+/g)].map(match => ({
    from: start + match.index, to: start + match.index + match[0].length, ...scopeList(up[2]),
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
        origin: { family: 'tmgrammar', file, line: line.number, column: line.text.search(/\^|</) + 1 },
      })
    }
  }
  return {
    source: chunks.join(''), sourceMap: segments, strippedExpectations,
    expectations: strippedExpectations.map(expectation => ({ ...expectation, ...originalRange(segments, expectation.from, expectation.to) })),
  }
}
