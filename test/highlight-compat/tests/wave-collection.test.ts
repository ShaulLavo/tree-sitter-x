import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { parseResult } from '../src/validate.ts'
import { comparisonView, planWave, summarizeTrack, reconcileRequest, nativeResolvedStyle } from '../src/wave-collection.ts'
import { readJsJsxSplit } from '../src/fixtures/js-jsx-wave.ts'

const document = (profileId: 'native' | 'raw' = 'native') => new ResultBuilder({ profileId, languageId: 'javascript' }, 'x')
  .scope(0, 1, ['source.js']).style('constructor', 0, 1, { foreground: '#112233ff' }).complete()
describe('wave accounting and projection', () => {
  it('plans fixed DEV rows and no selectors', () => {
    const plan = planWave(readJsJsxSplit('development'))
    expect(plan.scopeRows.length).toBe(105)
    expect(plan.themeRows.length).toBe(6825)
  })
  it('re-interns symmetric opaque colors without changing original documents', () => {
    const original = document(), before = JSON.stringify(original)
    const projected = comparisonView(original, 'x')
    expect(projected.status === 'complete' && projected.styles?.['constructor']?.styles).toEqual([{ foreground: '#112233' }])
    expect(JSON.stringify(original)).toBe(before)
    expect(parseResult(projected, 'x')).toEqual(projected)
  })
  it('keeps alpha zero and maps every font bit, no background or reset', () => {
    for (let mask = 0; mask < 16; mask++) {
      const style = nativeResolvedStyle({ foreground: '#11223300', background: '#000000ff', fontMask: mask, fontStyle: 'reset' })
      expect(style.foreground).toBe('#11223300')
      expect(style.background).toBeUndefined()
      expect(style.fontStyle === 'reset').toBe(false)
      expect(Object.keys(style.fontStyle ?? {}).length).toBe(mask.toString(2).replaceAll('0', '').length)
    }
    expect(nativeResolvedStyle({})).toEqual({})
  })
  it('counts unobserved rows as zero fixed credit, never as observed mismatches', () => {
    const summary = summarizeTrack([{ kind: 'compared', units: 10, nonWhitespace: 8, matching: 10, matchingNonWhitespace: 8 }, { kind: 'not-compared', units: 10, nonWhitespace: 4, reason: 'timeout' }, { kind: 'n/a-empty', units: 0, nonWhitespace: 0 }])
    expect(summary.all).toEqual({ declared: 20, comparable: 10, matching: 10, unobserved: 10, coverage: 0.5, conditionalMicro: 1, fixedMicro: 0.5, conditionalMacro: 1, fixedMacro: 0.5 })
    expect(summarizeTrack([]).all.fixedMicro).toBeNull()
  })
  it('does not accept missing metadata or a theme absent on both sides', () => {
    const row = { key: 'key', fixture: 'tiny', language: 'javascript', split: 'development', profile: 'raw', state: 'fresh-full', utf16Units: 1 } as const
    const result = reconcileRequest(row, 'x', ['constructor', '__proto__'], { kind: 'valid', result: document('raw') }, { kind: 'valid', result: document() })
    expect(result.scopes.kind).toBe('compared')
    expect(result.themes[1]?.styles.kind).toBe('not-compared')
    expect(result.metadata.kind).toBe('not-compared')
    expect(result.accepted).toBe(false)
  })
})
it('re-interns style values collapsed by comparison-only opaque alpha without changing native reset semantics', () => {
  const original = new ResultBuilder({ profileId: 'raw', languageId: 'javascript' }, 'xx').scope(0, 2, ['source.js'])
    .style('__proto__', 0, 1, { foreground: '#123456ff', fontStyle: 'reset' }).style('__proto__', 1, 2, { foreground: '#123456', fontStyle: 'reset' }).complete()
  const bytes = JSON.stringify(original), view = comparisonView(original, 'xx')
  expect(view.status === 'complete' && view.styles?.['__proto__']?.styles).toEqual([{ foreground: '#123456', fontStyle: 'reset' }])
  expect(JSON.stringify(original)).toBe(bytes)
})
it('keeps nonempty all-whitespace and zero-unit lifecycle ratios N/A rather than perfect', () => {
  const summary = summarizeTrack([{ kind: 'compared', units: 2, nonWhitespace: 0, matching: 2, matchingNonWhitespace: 0 }])
  expect(summary.all.conditionalMicro).toBe(1)
  expect(summary.nonWhitespace.conditionalMicro).toBeNull()
  expect(summarizeTrack([{ kind: 'n/a-empty', units: 0, nonWhitespace: 0 }]).all.fixedMacro).toBeNull()
})
