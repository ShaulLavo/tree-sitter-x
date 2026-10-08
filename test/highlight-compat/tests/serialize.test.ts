import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { parseResultText, serializeResult } from '../src/serialize.ts'

const source = 'let x\n'

function layoutResult() {
  return new ResultBuilder({ profileId: 'product', languageId: 'typescript', engine: { shiki: '4.4.3', grammar: 'typescript@1' } }, source)
    .scope(0, 3, ['source.ts', 'storage.type.ts'])
    .scope(3, 6, ['source.ts'])
    .language(0, 6, 'typescript')
    .style('light', 0, 6, { foreground: '#000000' })
    .style('dark', 0, 3, { fontStyle: { italic: true, bold: true }, foreground: '#569cd6' })
    .style('dark', 3, 6, { fontStyle: 'reset' })
    .diagnostic('shiki: tokenized')
    .complete()
}

describe('serializeResult', () => {
  it('writes the exact diff-friendly layout', () => {
    const expected = readFileSync(new URL('./fixtures/layout.json', import.meta.url), 'utf8')
    expect(serializeResult(layoutResult())).toBe(expected)
  })

  it('round-trips through parseResultText to an equal result', () => {
    const result = layoutResult()
    expect(parseResultText(serializeResult(result), source)).toEqual(result)
  })

  it('is a fixed point of serialize after parse', () => {
    const text = serializeResult(layoutResult())
    expect(serializeResult(parseResultText(text))).toBe(text)
  })

  it('round-trips an incomplete result with empty arrays', () => {
    const result = new ResultBuilder({ profileId: 'raw', languageId: 'css' }, 'a{}').incomplete('timeout', 'deadline 5000ms exceeded')
    const text = serializeResult(result)
    expect(text).toContain('"spans": []')
    expect(parseResultText(text, 'a{}')).toEqual(result)
  })

  it('ends with exactly one trailing newline', () => {
    const text = serializeResult(layoutResult())
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
  })

  it('reports JSON syntax errors as invalid JSON', () => {
    expect(() => parseResultText('{"schema": 1,')).toThrow(/invalid JSON/)
  })
})
