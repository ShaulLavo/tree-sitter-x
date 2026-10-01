import { EncodedTokenMetadata } from '@shikijs/vscode-textmate'
import { describe, expect, it } from 'vitest'
import { compareResults } from '../src/compare.ts'
import { SEPARATOR_SCOPES, sourceLines, writeTrack } from '../src/oracles/lines.ts'
import { decodeFontStyle, decodeForeground } from '../src/oracles/raw.ts'
import type { DocumentRequest } from '../src/oracles/request.ts'
import { normalizeColor, resolvedStyle } from '../src/oracles/resolved-style.ts'
import { runDocument } from '../src/oracles/run.ts'
import { serializeResult } from '../src/serialize.ts'

describe('sourceLines', () => {
  it.each([
    ['', [['', 0, 0]]],
    ['a', [['a', 0, 1]]],
    ['a\n', [['a', 0, 2], ['', 2, 2]]],
    ['a\r\nb', [['a', 0, 3], ['b', 3, 4]]],
    ['a\rb\n', [['a\rb', 0, 4], ['', 4, 4]]],
    ['\r\n\n', [['', 0, 2], ['', 2, 3], ['', 3, 3]]],
  ])('splits %j on LF and CRLF only', (source, expected) => {
    expect(sourceLines(source).map((line) => [line.text, line.start, line.next])).toEqual(expected)
  })
})

describe('writeTrack', () => {
  const written = (source: string, spans: Record<number, [number, number, string][]>) => {
    const out: [number, number, string][] = []
    const spansOfLine = (line: number) => (spans[line] ?? []).map(([from, to, value]) => ({ from, to, value }))
    writeTrack(sourceLines(source), spansOfLine, (from, to, value) => out.push([from, to, value]), 'eol')
    return out
  }

  it('clips the synthetic end-of-line unit and gives each terminator the separator value', () => {
    expect(written('ab\r\nc', { 0: [[0, 1, 'x'], [1, 3, 'y']], 1: [[0, 2, 'z']] })).toEqual([
      [0, 1, 'x'],
      [1, 2, 'y'],
      [2, 4, 'eol'],
      [4, 5, 'z'],
    ])
  })

  it('drops a token that starts at the line end and writes nothing for an empty source', () => {
    expect(written('a\n', { 0: [[0, 1, 'x'], [1, 2, 'nl']] })).toEqual([[0, 1, 'x'], [1, 2, 'eol']])
    expect(written('', { 0: [[0, 1, 'nl']] })).toEqual([])
  })

  it('uses an empty scope path for terminators', () => {
    expect(SEPARATOR_SCOPES).toEqual([])
  })
})

describe('resolved styles', () => {
  it.each([
    ['#ABC', '#aabbcc'],
    ['#abcd', '#aabbccdd'],
    ['#E1E4E8', '#e1e4e8'],
    ['#dbd7caEE', '#dbd7caee'],
  ])('normalizes %s to %s', (color, expected) => {
    expect(normalizeColor(color)).toBe(expected)
  })

  it('rejects colours that are not hex', () => {
    expect(() => normalizeColor('red')).toThrow('is not a hex colour')
  })

  it('treats an empty colour as absent and font style 0 or -1 as the none default', () => {
    expect(resolvedStyle('', 0)).toEqual({})
    expect(resolvedStyle('#FFF', -1)).toEqual({ foreground: '#ffffff' })
    expect(resolvedStyle('#000000', 1 | 2 | 4 | 8)).toEqual({
      foreground: '#000000',
      fontStyle: { italic: true, bold: true, underline: true, strikethrough: true },
    })
  })

  it("decodes upstream's layout: font style in bits 11-14, foreground in bits 15-23", () => {
    const metadata = ((200 << 24) | (17 << 15) | (0b1010 << 11) | 0x7ff) >>> 0
    expect([decodeForeground(metadata), decodeFontStyle(metadata)]).toEqual([17, 0b1010])
  })

  it('decodes metadata with the layout the fork exports too', () => {
    for (const metadata of [0, 0x7fff_ffff, 0x00ff_8000, 0x0000_7800, 0x1234_5678, 0xdead_beef >>> 0]) {
      expect([decodeForeground(metadata), decodeFontStyle(metadata)]).toEqual([
        EncodedTokenMetadata.getForeground(metadata),
        EncodedTokenMetadata.getFontStyle(metadata),
      ])
    }
  })
})

describe('runDocument', () => {
  const request = (patch: Partial<DocumentRequest> = {}): DocumentRequest => ({
    kind: 'document',
    profileId: 'raw',
    languageId: 'json',
    source: '{"a": [1, true]}\n',
    themeIds: ['github-dark'],
    ...patch,
  })

  it('returns timeout with no spans when the worker misses its deadline', async () => {
    const result = await runDocument(request(), 1)
    expect(result.status).toBe('timeout')
    expect(result.spans).toEqual([])
    expect(result.diagnostics).toEqual(['no answer within the 1 ms process deadline'])
  })

  it('returns error with the reason when the oracle throws', async () => {
    const unknown = await runDocument(request({ languageId: 'no-such-language' }))
    expect(unknown.status).toBe('error')
    expect(unknown.diagnostics.join('')).toContain('no-such-language')
    const themeless = await runDocument(request({ themeIds: [] }))
    expect(themeless.diagnostics).toEqual(['an oracle request needs at least one theme'])
  })

  it('gives identical results for concurrent runs with other themes, so no state is shared', async () => {
    const [alone, first] = await Promise.all([runDocument(request()), runDocument(request({ themeIds: ['vesper', 'github-dark'] }))])
    if (alone?.status !== 'complete' || first?.status !== 'complete') throw new Error('incomplete')
    const scopes = compareResults(alone, first)
    expect(scopes.comparable && scopes.scopes.mismatches.count).toBe(0)
    expect(JSON.stringify(alone.styles?.['github-dark'])).toBe(JSON.stringify(first.styles?.['github-dark']))
    expect(serializeResult(alone)).toBe(serializeResult((await runDocument(request())) as typeof alone))
  })
})
