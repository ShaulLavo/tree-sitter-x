import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'

const header = { profileId: 'product', languageId: 'typescript' } as const

describe('ResultBuilder', () => {
  it('interns names and paths in first-use order and keeps raw token splits', () => {
    const result = new ResultBuilder(header, 'let x')
      .scope(0, 3, ['source.ts', 'storage.type.ts'])
      .scope(3, 4, ['source.ts'])
      .scope(4, 5, ['source.ts'])
      .complete()
    expect(result.scopeNames).toEqual(['source.ts', 'storage.type.ts'])
    expect(result.paths).toEqual([[0, 1], [0]])
    expect(result.spans).toEqual([0, 3, 0, 3, 4, 1, 4, 5, 1])
  })

  it('rejects spans that overlap, run backwards, are empty or pass the end', () => {
    const builder = new ResultBuilder(header, 'abcdef').scope(0, 3, ['source.ts'])
    expect(() => builder.scope(2, 4, ['source.ts'])).toThrow(RangeError)
    expect(() => builder.scope(3, 3, ['source.ts'])).toThrow(RangeError)
    expect(() => builder.scope(3, 7, ['source.ts'])).toThrow(RangeError)
  })

  it('rejects scope names that would collide once joined into a path key', () => {
    const builder = new ResultBuilder(header, 'ab')
    expect(() => builder.scope(0, 1, ['source.ts meta.a'])).toThrow(/whitespace/)
    expect(() => builder.scope(0, 1, [''])).toThrow(/non-empty/)
  })

  it('keeps default and explicit reset styles as distinct interned styles', () => {
    const result = new ResultBuilder(header, 'ab')
      .scope(0, 2, ['source.ts'])
      .style('dark', 0, 1, {})
      .style('dark', 1, 2, { fontStyle: 'reset' })
      .complete()
    expect(result.styles?.['dark']).toEqual({ styles: [{}, { fontStyle: 'reset' }], spans: [0, 1, 0, 1, 2, 1] })
  })

  it('records the source identity and an incomplete result without spans', () => {
    const result = new ResultBuilder(header, 'a\u{1F600}').scope(0, 3, ['source.ts']).incomplete('timeout', 'deadline 5s')
    expect(result.sourceLength).toBe(3)
    expect(result.spans).toEqual([])
    expect(result.diagnostics).toEqual(['deadline 5s'])
  })
})
