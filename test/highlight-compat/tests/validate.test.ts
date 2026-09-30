import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import type { CompleteResult } from '../src/schema.ts'
import { sourceSha256 } from '../src/source.ts'
import { parseResult, validateResult } from '../src/validate.ts'

const header = { profileId: 'product', languageId: 'typescript' } as const
const source = 'let x = 1'

function scoped(): CompleteResult {
  return new ResultBuilder(header, source).scope(0, 3, ['source.ts', 'storage.type.ts']).scope(3, 9, ['source.ts']).complete()
}

function styled(): CompleteResult {
  return new ResultBuilder(header, source)
    .scope(0, 9, ['source.ts'])
    .language(0, 3, 'typescript')
    .language(3, 9, 'css')
    .style('dark', 0, 3, { foreground: '#569cd6' })
    .style('dark', 3, 9, { fontStyle: 'reset' })
    .complete()
}

function incomplete() {
  return new ResultBuilder(header, source).incomplete('timeout', 'deadline exceeded')
}

function errorsOf(value: unknown, text?: string): string {
  const validation = validateResult(value, text)
  return validation.ok ? '' : validation.errors.join('\n')
}

function withoutEngine(result: CompleteResult): unknown {
  const { engine, ...rest } = result
  return rest
}

function withTheme(result: CompleteResult, patch: object): CompleteResult {
  const dark = result.styles?.['dark']
  return { ...result, styles: { dark: { styles: [], spans: [], ...dark, ...patch } } }
}

const rejections: readonly (readonly [string, () => unknown, string])[] = [
  ['a non-object', () => [], 'result: expected an object'],
  ['an unknown key such as elapsedMs', () => ({ ...scoped(), elapsedMs: 12 }), 'unknown key "elapsedMs"'],
  ['a missing key', () => withoutEngine(scoped()), 'result: missing key "engine"'],
  ['schema other than 1', () => ({ ...scoped(), schema: 2 }), 'schema: expected 1'],
  ['an unknown profile id', () => ({ ...scoped(), profileId: 'Product' }), 'profileId: expected'],
  ['a baseline profile without a name', () => ({ ...scoped(), profileId: 'baseline:' }), 'profileId: expected'],
  ['a language id that is not a path segment', () => ({ ...scoped(), languageId: '../ts' }), 'languageId: expected'],
  ['an uppercase sha256', () => ({ ...scoped(), sourceSha256: scoped().sourceSha256.toUpperCase() }), 'sourceSha256: expected'],
  ['a fractional sourceLength', () => ({ ...scoped(), sourceLength: 8.5 }), 'sourceLength: expected a non-negative safe integer'],
  ['a negative documentRevision', () => ({ ...scoped(), documentRevision: -1 }), 'documentRevision: expected'],
  ['an unknown status', () => ({ ...scoped(), status: 'done' }), 'status: expected one of'],
  ['a non-string diagnostic', () => ({ ...scoped(), diagnostics: [3] }), 'diagnostics[0]: expected a string'],
  ['a non-string engine value', () => ({ ...scoped(), engine: { shiki: 4 } }), 'engine.shiki: expected a string'],
  ['unsorted spans', () => ({ ...scoped(), spans: [3, 9, 0, 0, 3, 1] }), 'overlap or unsorted'],
  ['overlapping spans', () => ({ ...scoped(), spans: [0, 4, 0, 3, 9, 1] }), 'spans[1]: from 3 overlaps previous span ending at 4'],
  ['a gap at the start', () => ({ ...scoped(), spans: [1, 3, 0, 3, 9, 1] }), 'spans[0]: gap at start'],
  ['a gap in the middle', () => ({ ...scoped(), spans: [0, 3, 0, 4, 9, 1] }), 'spans[1]: gap from 3 to 4'],
  ['a clipped end', () => ({ ...scoped(), spans: [0, 3, 0, 3, 8, 1] }), 'spans: clipped: ends at 8 of 9'],
  ['a span past the source', () => ({ ...scoped(), spans: [0, 3, 0, 3, 10, 1] }), 'spans[1]: [3, 10) out of range [0, 9)'],
  ['an empty span', () => ({ ...scoped(), spans: [0, 3, 0, 3, 3, 1, 3, 9, 1] }), 'spans[1]: empty or inverted span [3, 3)'],
  ['an inverted span', () => ({ ...scoped(), spans: [0, 3, 0, 3, 2, 1, 2, 9, 1] }), 'empty or inverted span [3, 2)'],
  ['a span length that is not triples', () => ({ ...scoped(), spans: [0, 3, 0, 3, 9] }), 'not a multiple of 3'],
  ['a non-integer span element', () => ({ ...scoped(), spans: [0, 3, 0, 3, 9, 0.5] }), 'element 5 is 0.5'],
  ['a path index out of range', () => ({ ...scoped(), spans: [0, 3, 0, 3, 9, 2] }), 'spans[1]: path index 2 out of range (2 paths)'],
  ['a scope name index out of range', () => ({ ...scoped(), paths: [[0, 5], [0]] }), 'paths[0]: scope name index 5 out of range'],
  ['a duplicate scope name', () => ({ ...scoped(), scopeNames: ['source.ts', 'source.ts'] }), 'scopeNames[1]: duplicate of scopeNames[0]'],
  ['whitespace in a scope name', () => ({ ...scoped(), scopeNames: ['source.ts', 'storage type'] }), 'scopeNames[1]: "storage type" does not match'],
  ['an empty scope name', () => ({ ...scoped(), scopeNames: ['source.ts', ''] }), 'scopeNames[1]: "" does not match'],
  ['a duplicate path', () => ({ ...scoped(), paths: [[0, 1], [0, 1]] }), 'paths[1]: duplicate of paths[0]'],
  [
    'paths interned out of first-use order',
    () => ({ ...scoped(), paths: [[0], [0, 1]], spans: [0, 3, 1, 3, 9, 0] }),
    'spans[0]: path 1 is used before path 0; values must be interned in first-use order (build results with ResultBuilder)',
  ],
  [
    'scope names interned out of first-use order',
    () => ({ ...scoped(), scopeNames: ['storage.type.ts', 'source.ts'], paths: [[1, 0], [1]] }),
    'paths[0]: scope name 1 is used before scope name 0; values must be interned in first-use order',
  ],
  ['an unused path', () => ({ ...scoped(), paths: [[0, 1], [0], [1]] }), 'paths[2]: never used by spans; values must be interned in first-use order'],
  ['an unused scope name', () => ({ ...scoped(), scopeNames: ['source.ts', 'storage.type.ts', 'extra.ts'] }), 'scopeNames[2]: never used by paths'],
  ['a non-empty source with no spans', () => ({ ...scoped(), scopeNames: [], paths: [], spans: [] }), 'spans: clipped: ends at 0 of 9'],
  [
    'an empty source with a span',
    () => ({ ...new ResultBuilder(header, '').complete(), scopeNames: ['source.ts'], paths: [[0]], spans: [0, 1, 0] }),
    'spans[0]: [0, 1) out of range [0, 0)',
  ],
  ['a non-complete result carrying spans', () => ({ ...incomplete(), scopeNames: ['source.ts'], paths: [[0]], spans: [0, 9, 0] }), 'spans: status timeout carries 3 entries; partial output cannot be recorded as a result'],
  ['a non-complete result carrying styles', () => ({ ...incomplete(), styles: {} }), 'styles: not allowed when status is timeout'],
  ['a non-complete result without diagnostics', () => ({ ...incomplete(), diagnostics: [] }), 'diagnostics: status timeout needs at least one diagnostic'],
  ['an uppercase style colour', () => withTheme(styled(), { styles: [{ foreground: '#569CD6' }, { fontStyle: 'reset' }] }), 'styles.dark.styles[0].foreground: expected lowercase'],
  ['a short style colour', () => withTheme(styled(), { styles: [{ background: '#fff' }, { fontStyle: 'reset' }] }), 'styles.dark.styles[0].background: expected lowercase'],
  ['an empty fontStyle object', () => withTheme(styled(), { styles: [{ fontStyle: {} }, { fontStyle: 'reset' }] }), 'styles.dark.styles[0].fontStyle: expected "reset" or a non-empty object'],
  ['a false font flag', () => withTheme(styled(), { styles: [{ fontStyle: { bold: false } }, { fontStyle: 'reset' }] }), 'styles.dark.styles[0].fontStyle.bold: expected true'],
  ['an unknown font flag', () => withTheme(styled(), { styles: [{ fontStyle: { oblique: true } }, { fontStyle: 'reset' }] }), 'unknown flag "oblique"'],
  ['an unknown style key', () => withTheme(styled(), { styles: [{ color: '#000000' }, { fontStyle: 'reset' }] }), 'styles.dark.styles[0]: unknown key "color"'],
  ['a duplicate style', () => withTheme(styled(), { styles: [{ fontStyle: 'reset' }, { fontStyle: 'reset' }] }), 'styles.dark.styles[1]: duplicate of styles.dark.styles[0]'],
  ['a clipped style track', () => withTheme(styled(), { spans: [0, 3, 0, 3, 8, 1] }), 'styles.dark.spans: clipped: ends at 8 of 9'],
  ['a theme id with whitespace', () => ({ ...styled(), styles: { 'dark plus': styled().styles?.['dark'] } }), 'styles: theme id "dark plus" does not match'],
  ['a theme with an extra key', () => withTheme(styled(), { elapsedMs: 3 }), 'styles.dark: unknown key "elapsedMs"'],
  ['a gapped metadata track', () => ({ ...styled(), metadata: { languageIds: ['typescript', 'css'], spans: [0, 3, 0, 4, 9, 1] } }), 'metadata.spans[1]: gap from 3 to 4'],
  ['an unused metadata language', () => ({ ...styled(), metadata: { languageIds: ['typescript', 'css', 'html'], spans: [0, 3, 0, 3, 9, 1] } }), 'metadata.languageIds[2]: never used'],
  ['a metadata language id with a slash', () => ({ ...styled(), metadata: { languageIds: ['type/script', 'css'], spans: [0, 3, 0, 3, 9, 1] } }), 'metadata.languageIds[0]: "type/script" does not match'],
  ['a metadata track with an extra key', () => ({ ...styled(), metadata: { ...styled().metadata, tokenTypes: [] } }), 'metadata: unknown key "tokenTypes"'],
]

describe('validateResult', () => {
  it('accepts results built by ResultBuilder', () => {
    expect(errorsOf(scoped(), source)).toBe('')
    expect(errorsOf(styled(), source)).toBe('')
    expect(errorsOf(incomplete(), source)).toBe('')
    expect(errorsOf({ ...scoped(), profileId: 'baseline:vscode-1.99' })).toBe('')
  })

  it.each(rejections)('rejects %s', (_name, make, message) => {
    expect(errorsOf(make())).toContain(message)
  })

  it('accepts a complete empty source with zero spans', () => {
    expect(errorsOf(new ResultBuilder(header, '').complete(), '')).toBe('')
  })

  it('checks the declared length and hash against a given source', () => {
    expect(errorsOf(scoped(), 'let x = 2')).toContain('sourceSha256: ')
    expect(errorsOf(scoped(), 'let x = 10')).toContain('sourceLength: 9 does not match the source length 10')
  })

  it('collects every error and caps the list at 100', () => {
    const spans = Array.from({ length: 150 }, (_, i) => [i * 2, i * 2 + 1, 0]).flat()
    const validation = validateResult({ ...new ResultBuilder(header, 'x'.repeat(300)).scope(0, 300, ['source.ts']).complete(), spans })
    expect(validation.ok).toBe(false)
    if (validation.ok) return
    expect(validation.errors).toHaveLength(101)
    expect(validation.errors.at(-1)).toMatch(/^\.\.\. \d+ more$/)
  })

  it('parseResult throws with every error listed', () => {
    expect(() => parseResult({ ...scoped(), schema: 2, elapsedMs: 1 })).toThrow(/unknown key "elapsedMs"[\s\S]*schema: expected 1/)
  })
})

describe('offsets are UTF-16 code units of the exact source', () => {
  const build = (text: string, cuts: readonly number[]) => {
    const builder = new ResultBuilder(header, text)
    let from = 0
    for (const to of [...cuts, text.length]) {
      builder.scope(from, to, ['source.ts', `part${from}.ts`])
      from = to
    }
    return builder.complete()
  }

  it('counts an astral character as two units', () => {
    const text = 'a\u{1F600}b'
    expect(text.length).toBe(4)
    const result = build(text, [1, 3])
    expect(result.spans).toEqual([0, 1, 0, 1, 3, 1, 3, 4, 2])
    expect(errorsOf(result, text)).toBe('')
  })

  it('keeps CRLF and a lone CR as source units', () => {
    expect(errorsOf(build('a\r\nb', [1, 3]), 'a\r\nb')).toBe('')
    expect(errorsOf(build('a\rb', [1, 2]), 'a\rb')).toBe('')
    expect(errorsOf(build('a\r\nb', [1, 3]), 'a\nb')).toContain('sourceLength: 4 does not match the source length 3')
  })

  it('keeps a leading BOM as one unit and fails against the stripped source', () => {
    const text = '﻿x'
    const result = build(text, [1])
    expect(result.sourceLength).toBe(2)
    expect(errorsOf(result, text)).toBe('')
    const stripped = errorsOf(result, 'x')
    expect(stripped).toContain('sourceLength: 2 does not match the source length 1')
    expect(stripped).toContain('sourceSha256: ')
  })

  it('distinguishes a trailing newline from none', () => {
    const withNewline = build('x\n', [1])
    const without = build('x', [])
    expect(withNewline.sourceLength).toBe(2)
    expect(without.sourceLength).toBe(1)
    expect(withNewline.sourceSha256).not.toBe(without.sourceSha256)
    expect(errorsOf(withNewline, 'x\n')).toBe('')
    expect(errorsOf(without, 'x')).toBe('')
    expect(errorsOf(withNewline, 'x')).toContain('sourceLength')
  })

  it('accepts a lone surrogate as one unit', () => {
    const text = 'a\uD800b'
    expect(errorsOf(build(text, [1, 2]), text)).toBe('')
  })
})

describe('sourceSha256', () => {
  it('equals sha256 of the UTF-8 bytes for well-formed text', () => {
    for (const text of ['', 'let x\n', 'a\u{1F600}b', '﻿x\r\n']) {
      expect(sourceSha256(text)).toBe(createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'))
    }
  })

  it('keeps a lone surrogate distinct from U+FFFD', () => {
    expect(sourceSha256('\uD800')).not.toBe(sourceSha256('�'))
  })
})
