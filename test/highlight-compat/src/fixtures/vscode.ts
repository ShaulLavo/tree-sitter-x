import type { Expectation } from '../expectations.ts'
import { offsetPosition, physicalLines } from './source-map.ts'

interface ColorizeToken {
  readonly c: string
  readonly t: string
}

function parseTokens(json: string): readonly ColorizeToken[] {
  const value: unknown = JSON.parse(json)
  if (!Array.isArray(value)) throw new Error('colorize result must be a token array')
  return value.map((item: unknown, index) => {
    if (typeof item !== 'object' || item === null || !('c' in item) || !('t' in item) ||
      typeof item.c !== 'string' || typeof item.t !== 'string' || item.c.length === 0 ||
      !/^\S+(?: \S+)*$/.test(item.t)) {
      throw new Error(`invalid colorize token ${index}`)
    }
    return { c: item.c, t: item.t }
  })
}

/** VS Code captures each line's content and discards terminators, including blank lines. */
export function adaptVscode(source: string, json: string, fixtureId: string, file: string): readonly Expectation[] {
  const lines = physicalLines(source)
  const tokens = parseTokens(json)
  const locations = [...json.matchAll(/"c"\s*:/g)]
  if (locations.length !== tokens.length) throw new Error('colorize content keys must occur once per token')
  const expectations: Expectation[] = []
  let row = 0, column = 0
  for (const [index, token] of tokens.entries()) {
    while (row < lines.length && column === lines[row].text.length) {
      row++
      column = 0
    }
    const line = lines[row]
    if (!line || line.text.slice(column, column + token.c.length) !== token.c) {
      throw new Error(`colorize token ${index} does not match exact source at line ${row + 1}, column ${column + 1}`)
    }
    const from = line.from + column
    expectations.push({
      fixtureId, from, to: from + token.c.length, scopes: token.t.split(' '),
      origin: { family: 'vscode-colorize', file, ...offsetPosition(json, locations[index].index) },
    })
    column += token.c.length
  }
  while (row < lines.length && column === lines[row].text.length) {
    row++
    column = 0
  }
  if (row < lines.length) throw new Error('colorize result is truncated before source end')
  return expectations
}
