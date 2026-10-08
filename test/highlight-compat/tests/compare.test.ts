import { assert, describe, expect, it } from 'vitest'

import { ResultBuilder } from '../src/build.ts'
import { compareResults, type Comparison, type Outcome, type ScopeReport, type StyleReport } from '../src/compare.ts'
import type { CompleteResult, ProfileId, Style } from '../src/schema.ts'

type ScopeSpan = readonly [number, number, readonly string[]]
type StyleSpan = readonly [number, number, Style]

function builder(source: string, profileId: ProfileId): ResultBuilder {
  return new ResultBuilder({ profileId, languageId: 'typescript' }, source)
}

function scoped(source: string, spans: readonly ScopeSpan[], profileId: ProfileId = 'vscode'): CompleteResult {
  const result = builder(source, profileId)
  for (const [from, to, path] of spans) result.scope(from, to, path)
  return result.complete()
}

function styled(source: string, themes: Readonly<Record<string, readonly StyleSpan[]>>, profileId: ProfileId): CompleteResult {
  const result = builder(source, profileId).scope(0, source.length, ['source.ts'])
  for (const [themeId, spans] of Object.entries(themes)) {
    for (const [from, to, style] of spans) result.style(themeId, from, to, style)
  }
  return result.complete()
}

function scopesOf(comparison: Comparison): ScopeReport {
  assert(comparison.comparable, 'comparable')
  return comparison.scopes
}

function reportOf<T>(outcome: Outcome<T> | undefined): T {
  assert(outcome !== undefined && outcome.compared, 'compared')
  return outcome.report
}

function themeOf(comparison: Comparison, themeId: string): StyleReport {
  assert(comparison.comparable, 'comparable')
  return reportOf(comparison.styles[themeId])
}

const P = ['source.ts', 'string.quoted']
const Q = ['source.ts', 'comment.line']

describe('compareResults', () => {
  it('treats a split token as full agreement and reports the split only as a raw boundary', () => {
    const source = 'abcdefghij'
    const reference = scoped(source, [[0, 10, P]])
    const candidate = scoped(source, [[0, 4, P], [4, 10, P]], 'native')
    const scopes = scopesOf(compareResults(reference, candidate, { source }))
    expect(scopes.agreement.all).toEqual({ matching: 10, comparable: 10, ratio: 1 })
    expect(scopes.mismatches).toEqual({ count: 0, units: 0, longest: 0, runs: [] })
    expect(scopes.boundaries.raw).toEqual({ matched: 0, referenceOnly: 0, candidateOnly: 1, precision: 0, recall: null })
    expect(scopes.boundaries.coalesced).toEqual({ matched: 0, referenceOnly: 0, candidateOnly: 0, precision: null, recall: null })
  })

  it('coalesces adjacent mismatching intervals with the same pair across token boundaries', () => {
    const source = 'abcdef'
    const reference = scoped(source, [[0, 3, P], [3, 6, P]])
    const candidate = scoped(source, [[0, 6, Q]], 'native')
    const scopes = scopesOf(compareResults(reference, candidate))
    expect(scopes.mismatches).toEqual({
      count: 1,
      units: 6,
      longest: 6,
      runs: [{ from: 0, to: 6, reference: P, candidate: Q, category: 'leaf' }],
    })
  })

  it('detects, categorizes and counts every mismatch category', () => {
    const source = 'x'.repeat(24)
    const reference = scoped(source, [
      [0, 1, ['s', 'a', 'b']],
      [1, 3, ['s']],
      [3, 6, ['s', 'a', 'b']],
      [6, 10, ['s', 'a']],
      [10, 15, ['s', 'm', 'a']],
      [15, 21, ['s', 'a']],
      [21, 24, ['s', 'd']],
    ])
    const candidate = scoped(
      source,
      [
        [0, 1, ['s', 'b']],
        [1, 3, ['s', 'x']],
        [3, 6, ['s', 'b', 'a']],
        [6, 10, ['s', 'c']],
        [10, 15, ['s', 'n', 'a']],
        [15, 21, ['t', 'u', 'v']],
        [21, 24, ['s', 'e']],
      ],
      'native',
    )
    const scopes = scopesOf(compareResults(reference, candidate))
    expect(scopes.categories).toEqual({
      'missing-scope': { count: 1, units: 1 },
      'extra-scope': { count: 1, units: 2 },
      reordered: { count: 1, units: 3 },
      leaf: { count: 2, units: 7 },
      ancestor: { count: 1, units: 5 },
      other: { count: 1, units: 6 },
    })
    expect(scopes.mismatches.runs.map((run) => [run.from, run.to, run.category])).toEqual([
      [0, 1, 'missing-scope'],
      [1, 3, 'extra-scope'],
      [3, 6, 'reordered'],
      [6, 10, 'leaf'],
      [10, 15, 'ancestor'],
      [15, 21, 'other'],
      [21, 24, 'leaf'],
    ])
    expect(scopes.agreement.all).toEqual({ matching: 0, comparable: 24, ratio: 0 })
  })

  it('counts a whitespace-only mismatch in all-text agreement only', () => {
    const source = 'ab  cd'
    const reference = scoped(source, [[0, 2, P], [2, 4, ['source.ts']], [4, 6, P]])
    const candidate = scoped(source, [[0, 2, P], [2, 4, Q], [4, 6, P]], 'native')
    const scopes = scopesOf(compareResults(reference, candidate, { source }))
    expect(scopes.agreement).toEqual({
      all: { matching: 4, comparable: 6, ratio: 4 / 6 },
      nonWhitespace: { matching: 4, comparable: 4, ratio: 1 },
    })
    expect(scopesOf(compareResults(reference, candidate)).agreement.nonWhitespace).toBeUndefined()
  })

  it('distinguishes an inherited font style from an explicit reset', () => {
    const source = 'abcd'
    const reference = styled(source, { dark: [[0, 4, {}]] }, 'vscode')
    const candidate = styled(source, { dark: [[0, 4, { fontStyle: 'reset' }]] }, 'native')
    const dark = themeOf(compareResults(reference, candidate), 'dark')
    expect(dark.agreement.all).toEqual({ matching: 0, comparable: 4, ratio: 0 })
    expect(dark.fields).toEqual({ foreground: { units: 0 }, background: { units: 0 }, fontStyle: { units: 4 } })
  })

  it('counts a foreground-only difference under foreground', () => {
    const source = 'ab cd'
    const reference = styled(source, { dark: [[0, 5, { foreground: '#111111', fontStyle: { bold: true } }]] }, 'vscode')
    const candidate = styled(source, { dark: [[0, 5, { foreground: '#222222', fontStyle: { bold: true } }]] }, 'native')
    const dark = themeOf(compareResults(reference, candidate, { source }), 'dark')
    expect(dark.fields).toEqual({
      foreground: { units: 5, nonWhitespaceUnits: 4 },
      background: { units: 0, nonWhitespaceUnits: 0 },
      fontStyle: { units: 0, nonWhitespaceUnits: 0 },
    })
  })

  it('reports empty input as N/A', () => {
    const scopes = scopesOf(compareResults(scoped('', []), scoped('', [], 'native'), { source: '' }))
    expect(scopes.agreement).toEqual({
      all: { matching: 0, comparable: 0, ratio: null },
      nonWhitespace: { matching: 0, comparable: 0, ratio: null },
    })
    expect(scopes.boundaries.raw.precision).toBeNull()
    expect(scopes.boundaries.raw.recall).toBeNull()
  })

  it.each(['timeout', 'error'] as const)('does not compare a %s result in either position', (status) => {
    const source = 'abcd'
    const complete = scoped(source, [[0, 4, P]])
    const incomplete = builder(source, 'native').incomplete(status, 'engine stopped')
    const asCandidate = compareResults(complete, incomplete)
    const asReference = compareResults(incomplete, complete)
    expect(asCandidate).toMatchObject({ comparable: false, reason: `candidate status is ${status}` })
    expect(asReference).toMatchObject({ comparable: false, reason: `reference status is ${status}` })
  })

  it('does not compare results for different sources', () => {
    const comparison = compareResults(scoped('abcd', [[0, 4, P]]), scoped('abce', [[0, 4, P]], 'native'))
    assert(!comparison.comparable, 'not comparable')
    expect(comparison.reason).toMatch(/^sources differ/)
  })

  it('scores raw and coalesced boundaries against the reference', () => {
    const source = 'x'.repeat(10)
    const reference = scoped(source, [[0, 2, ['a']], [2, 5, ['b']], [5, 7, ['b']], [7, 10, ['c']]])
    const candidate = scoped(source, [[0, 2, ['a']], [2, 4, ['b']], [4, 7, ['b']], [7, 8, ['c']], [8, 10, ['d']]], 'native')
    const { boundaries } = scopesOf(compareResults(reference, candidate))
    expect(boundaries.raw).toEqual({ matched: 2, referenceOnly: 1, candidateOnly: 2, precision: 0.5, recall: 2 / 3 })
    expect(boundaries.coalesced).toEqual({ matched: 2, referenceOnly: 0, candidateOnly: 1, precision: 2 / 3, recall: 1 })
  })

  it('caps kept runs while totals cover every run', () => {
    const source = 'x'.repeat(10)
    const reference = scoped(source, [[0, 10, P]])
    const candidate = scoped(
      source,
      [[0, 1, P], [1, 2, Q], [2, 3, P], [3, 4, Q], [4, 5, P], [5, 6, Q], [6, 7, P], [7, 10, Q]],
      'native',
    )
    const { mismatches } = scopesOf(compareResults(reference, candidate, { maxRuns: 2 }))
    expect(mismatches.count).toBe(4)
    expect(mismatches.units).toBe(6)
    expect(mismatches.longest).toBe(3)
    expect(mismatches.runs.map((run) => [run.from, run.to])).toEqual([[1, 2], [3, 4]])
  })

  it('compares the metadata track and refuses when a side lacks it', () => {
    const source = 'abcd'
    const reference = builder(source, 'vscode').scope(0, 4, P).language(0, 4, 'typescript').complete()
    const candidate = builder(source, 'native').scope(0, 4, P).language(0, 2, 'typescript').language(2, 4, 'css').complete()
    const comparison = compareResults(reference, candidate)
    assert(comparison.comparable, 'comparable')
    const metadata = reportOf(comparison.metadata)
    expect(metadata.agreement.all).toEqual({ matching: 2, comparable: 4, ratio: 0.5 })
    expect(metadata.mismatches.runs).toEqual([{ from: 2, to: 4, reference: 'typescript', candidate: 'css' }])

    const bare = compareResults(reference, scoped(source, [[0, 4, P]], 'native'))
    assert(bare.comparable, 'comparable')
    expect(bare.metadata).toEqual({ compared: false, reason: 'metadata track missing on candidate' })
  })

  it('compares every theme by default, one theme on request, and refuses a missing one', () => {
    const source = 'abcd'
    const plain: readonly StyleSpan[] = [[0, 4, { foreground: '#111111' }]]
    const reference = styled(source, { dark: plain, light: plain }, 'vscode')
    const candidate = styled(source, { dark: plain }, 'native')
    const all = compareResults(reference, candidate)
    assert(all.comparable, 'comparable')
    expect(Object.keys(all.styles).sort()).toEqual(['dark', 'light'])
    expect(reportOf(all.styles.dark).agreement.all.ratio).toBe(1)
    expect(all.styles.light).toEqual({ compared: false, reason: 'theme light missing on candidate' })

    const one = compareResults(reference, candidate, { themeId: 'dark' })
    assert(one.comparable, 'comparable')
    expect(Object.keys(one.styles)).toEqual(['dark'])
  })

  it('throws when the given source describes neither result', () => {
    const reference = scoped('abcd', [[0, 4, P]])
    const candidate = scoped('abcd', [[0, 4, P]], 'native')
    expect(() => compareResults(reference, candidate, { source: 'abce' })).toThrow(/matches neither result/)
  })
})
