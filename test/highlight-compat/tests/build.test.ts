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

  it('rejects a gap at the start or between spans', () => {
    expect(() => new ResultBuilder(header, 'abc').scope(1, 3, ['s'])).toThrow(/must start at 0/)
    expect(() => new ResultBuilder(header, 'abc').scope(0, 1, ['s']).scope(2, 3, ['s'])).toThrow(/must start at 1/)
    expect(() => new ResultBuilder(header, 'abc').scope(0, 3, ['s']).style('dark', 1, 3, {})).toThrow(/must start at 0/)
    expect(() => new ResultBuilder(header, 'abc').scope(0, 3, ['s']).language(0, 1, 'ts').language(2, 3, 'ts')).toThrow(
      /must start at 1/,
    )
  })

  it('refuses to publish a complete result whose tracks stop short of the source end', () => {
    expect(() => new ResultBuilder(header, 'abc').scope(0, 1, ['s']).complete()).toThrow(/scopes: clipped at 1 of 3/)
    expect(() => new ResultBuilder(header, 'abc').complete()).toThrow(/scopes: clipped at 0 of 3/)
    expect(() => new ResultBuilder(header, 'abc').scope(0, 3, ['s']).style('dark', 0, 2, {}).complete()).toThrow(
      /style dark: clipped at 2 of 3/,
    )
    expect(() => new ResultBuilder(header, 'abc').scope(0, 3, ['s']).language(0, 1, 'ts').complete()).toThrow(
      /metadata: clipped at 1 of 3/,
    )
  })

  it('leaves interning canonical after a rejected write is replaced by a valid one', () => {
    const builder = new ResultBuilder(header, 'abc').scope(0, 1, ['s'])
    expect(() => builder.scope(1, 1, ['bad'])).toThrow(RangeError)
    builder.scope(1, 3, ['good'])
    expect(() => builder.language(1, 1, 'bad')).toThrow(RangeError)
    expect(() => builder.language(0, 3, 'not a language')).toThrow(/language id/)
    builder.language(0, 3, 'ts')
    expect(() => builder.style('dark', 1, 3, { foreground: '#000000' })).toThrow(RangeError)
    expect(() => builder.style('light', 0, 3, { foreground: '#FFF' })).toThrow(/foreground/)
    expect(() => builder.style('light', 0, 3, { fontStyle: {} })).toThrow(/fontStyle/)
    expect(() => builder.style('not a theme', 0, 3, {})).toThrow(/theme id/)
    builder.style('light', 0, 3, { foreground: '#ffffff' })
    const result = builder.complete()
    expect(result.scopeNames).toEqual(['s', 'good'])
    expect(result.metadata?.languageIds).toEqual(['ts'])
    expect(Object.keys(result.styles ?? {})).toEqual(['light'])
    expect(result.styles?.['light']?.styles).toEqual([{ foreground: '#ffffff' }])
  })

  it('publishes an empty source as a complete result with no spans', () => {
    expect(new ResultBuilder(header, '').complete().spans).toEqual([])
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
