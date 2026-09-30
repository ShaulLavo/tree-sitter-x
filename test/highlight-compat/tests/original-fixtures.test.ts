import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sourceLines } from '../src/oracles/lines.ts'
import { originalFixtures } from '../src/original-fixtures.ts'

const fixtures = new Map(originalFixtures().map((fixture) => [`${fixture.languageId}/${fixture.fixtureId}`, fixture.source]))
const lineLengths = (source: string): number[] => sourceLines(source).map((line) => line.text.length)

/** What each fixture exists to exercise; an editor that rewrites a fixture breaks its row. */
const INVARIANTS: Readonly<Record<string, (source: string) => boolean>> = {
  'typescript/line-19999': (source) => lineLengths(source)[0] === 19_999,
  'typescript/line-20000': (source) => lineLengths(source)[0] === 20_000,
  'typescript/line-20001': (source) => lineLengths(source)[0] === 20_001,
  'typescript/line-20001-closes-open-comment': (source) => source.startsWith('/*\n') && lineLengths(source)[1] === 20_001,
  'tsx/line-20000': (source) => lineLengths(source)[0] === 20_000,
  'json/line-20000': (source) => lineLengths(source)[0] === 20_000,
  'typescript/empty-line-block-comment': (source) => source.startsWith('/*\n\n'),
  'typescript/empty-line-template': (source) => source.includes('`\n\n'),
  'typescript/empty-line-declaration': (source) => source === 'const x =\n\n  1\n',
  'tsx/empty-line-jsx': (source) => source.includes('<div>\n\n'),
  'json/empty-line-object': (source) => source.startsWith('{\n\n'),
  'typescript/crlf': (source) => source.split('\r\n').length === 4 && !/\r(?!\n)|(?<!\r)\n/.test(source),
  'tsx/crlf': (source) => source.split('\r\n').length === 4 && !/\r(?!\n)|(?<!\r)\n/.test(source),
  'json/crlf': (source) => source.split('\r\n').length === 4 && !/\r(?!\n)|(?<!\r)\n/.test(source),
  'typescript/lone-cr': (source) => /\r(?!\n)/.test(source),
  'typescript/mixed-eol': (source) => /\r\n/.test(source) && /\r(?!\n)/.test(source) && /(?<!\r)\n/.test(source),
  'typescript/bom': (source) => source.startsWith('﻿'),
  'json/bom': (source) => source.startsWith('﻿'),
  'typescript/no-trailing-newline': (source) => source.length > 0 && !source.endsWith('\n'),
  'json/no-trailing-newline': (source) => source.length > 0 && !source.endsWith('\n'),
  'typescript/empty': (source) => source === '',
  'json/empty': (source) => source === '',
  'typescript/unicode': (source) => /[\ud800-\udbff][\udc00-\udfff]/.test(source) && source.includes('é'),
  'tsx/unicode-jsx': (source) => /[\ud800-\udbff][\udc00-\udfff]/.test(source) && source.includes('x́'),
  'markdown/fences': (source) => source.includes('```ts\n') && source.includes('```json\n') && source.includes('\n\nlet'),
}

describe('fixtures/original', () => {
  it('has exactly one invariant per fixture', () => {
    expect([...fixtures.keys()].sort()).toEqual(Object.keys(INVARIANTS).sort())
  })

  it.each(Object.entries(INVARIANTS))('%s keeps the property it exists for', (id, holds) => {
    expect(holds(fixtures.get(id) ?? '\u0000')).toBe(true)
  })

  it('reads every fixture as UTF-8 that re-encodes to its exact bytes', () => {
    for (const fixture of originalFixtures()) {
      expect(Buffer.from(fixture.source, 'utf8').equals(readFileSync(fixture.path)), fixture.path).toBe(true)
    }
  })
})
