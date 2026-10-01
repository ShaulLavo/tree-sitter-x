import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import type { ReferenceExpectation } from '../src/oracles/reference-expectations.ts'
import type { OracleProfileId } from '../src/oracles/request.ts'
import type { ReferenceInput } from '../src/reference-inputs.ts'
import type { Observation, Track } from '../src/reference-observations.ts'
import { type Attribution, attribute, buildReferenceReport, observationsOf, pairRows, REPORT_PATH, type ReferenceReport } from '../src/reference-report.ts'
import type { CompleteResult, DocumentResult } from '../src/schema.ts'

const SOURCE = 'aaaa\nbb\n'
const THEME = 'dark'

/** A result over SOURCE: line 0 with `scope0` and `color0`, line 1 with `scope1`, and both LFs. */
function result(profileId: OracleProfileId, patch: { scope0?: string; color0?: string; scope1?: string; eol?: string } = {}): CompleteResult {
  const { scope0 = 'a', color0 = '#111111', scope1 = 'b', eol = '#111111' } = patch
  return new ResultBuilder({ profileId, languageId: 'typescript' }, SOURCE)
    .scope(0, 4, ['source.ts', scope0])
    .scope(4, 5, [])
    .scope(5, 7, ['source.ts', scope1])
    .scope(7, 8, [])
    .style(THEME, 0, 4, { foreground: color0 })
    .style(THEME, 4, 5, eol === '#111111' ? {} : { foreground: eol })
    .style(THEME, 5, 7, { foreground: '#111111' })
    .style(THEME, 7, 8, {})
    .complete()
}

const input = (product: DocumentResult | undefined, raw: DocumentResult | undefined = result('raw')): ReferenceInput => ({
  input: 'ts/a',
  source: SOURCE,
  results: new Map<OracleProfileId, DocumentResult>([
    ...(raw === undefined ? [] : [['raw', raw] as const]),
    ...(product === undefined ? [] : [['product', product] as const]),
  ]),
})

const observations = (product: DocumentResult | undefined, raw?: DocumentResult) =>
  observationsOf([input(product, raw)], ['raw', 'product'])

const expectation = (patch: Partial<ReferenceExpectation> = {}): ReferenceExpectation => ({
  id: 'x',
  cause: 'line-cap',
  minimalFixture: 'ts/a',
  lines: { 'ts/a': [0, 0] },
  pairs: [['product', 'raw']],
  tracks: ['scopes', 'styles'],
  accepts: () => true,
  why: '',
  ...patch,
})

const clean = { unexplained: [], ambiguous: [], unobserved: [] }
const loose = (attribution: Attribution) => ({ unexplained: attribution.unexplained, ambiguous: attribution.ambiguous, unobserved: attribution.unobserved })

describe('attribute', () => {
  const claimed = observations(result('product', { scope0: 'plain', color0: '#222222' }))

  it('claims a difference inside the claimed line with the values it accepts, on the unordered pair', () => {
    expect(loose(attribute(claimed, [expectation()]))).toEqual(clean)
  })

  it('leaves a difference unexplained when the expectation rejects its values', () => {
    const picky = expectation({ accepts: (run) => run.values.product === 'never' })
    expect(attribute(claimed, [picky]).unexplained.map((item) => item.track)).toEqual(['scopes', 'styles'])
  })

  it('leaves a change on an unclaimed suffix line unexplained', () => {
    const suffix = observations(result('product', { scope0: 'plain', color0: '#222222', scope1: 'other' }))
    expect(attribute(suffix, [expectation()]).unexplained.map((item) => item.track)).toEqual(['scopes'])
  })

  it('leaves a change on the claimed line terminator unexplained', () => {
    const terminator = observations(result('product', { scope0: 'plain', color0: '#222222', eol: '#ff0000' }))
    expect(attribute(terminator, [expectation()]).unexplained.map((item) => item.track)).toEqual(['styles'])
  })

  it('reports a difference two expectations claim as ambiguous', () => {
    expect(attribute(claimed, [expectation(), expectation({ id: 'y' })]).ambiguous).toHaveLength(2)
  })

  it('reports a claim nothing observes', () => {
    expect(attribute([], [expectation({ tracks: ['scopes'] })]).unobserved).toEqual(['x: ts/a raw ~ product scopes'])
  })

  it('lets an every-fixture expectation claim boundary-only differences on fixtures only', () => {
    const every = expectation({ lines: 'every-fixture', tracks: ['style-boundaries'], accepts: () => false })
    const boundary = (name: string): Observation => ({ input: name, pair: ['raw', 'product'], track: 'style-boundaries', units: 1, runs: [] })
    const result = attribute([boundary('ts/z'), boundary('conformance/c')], [every])
    expect(result.unexplained.map((item) => item.input)).toEqual(['conformance/c'])
    expect(result.unobserved).toEqual(['x: ts/a raw ~ product style-boundaries'])
  })
})

describe('pairRows', () => {
  const split = new ResultBuilder({ profileId: 'product', languageId: 'typescript' }, SOURCE)
    .scope(0, 2, ['source.ts', 'a']).scope(2, 4, ['source.ts', 'a']).scope(4, 5, []).scope(5, 7, ['source.ts', 'b']).scope(7, 8, [])
    .style(THEME, 0, 4, { foreground: '#111111' }).style(THEME, 4, 5, {}).style(THEME, 5, 7, { foreground: '#111111' }).style(THEME, 7, 8, {})
    .complete()
  const timedOut = new ResultBuilder({ profileId: 'raw', languageId: 'typescript' }, SOURCE).incomplete('timeout', 'no answer')
  const themeless = new ResultBuilder({ profileId: 'product', languageId: 'typescript' }, SOURCE)
    .scope(0, 2, ['source.ts', 'a']).scope(2, 4, ['source.ts', 'a']).scope(4, 5, []).scope(5, 7, ['source.ts', 'b']).scope(7, 8, [])
    .complete()
  const cases: [string, ReferenceInput][] = [
    ['ts/split', { ...input(split), input: 'ts/split' }],
    ['ts/timeout', { ...input(result('product'), timedOut), input: 'ts/timeout' }],
    ['ts/missing', { ...input(undefined), input: 'ts/missing' }],
    ['ts/themeless', { ...input(themeless), input: 'ts/themeless' }],
  ]
  const inputs = cases.map(([, item]) => item)

  it('counts only complete comparisons as compared, and boundary-only only among them', () => {
    const [row] = pairRows(inputs, observationsOf(inputs, ['raw', 'product']), ['raw', 'product'])
    expect(row).toEqual({ pair: 'raw ~ product', compared: 1, incomplete: 3, differing: 0, scopeUnits: 0, styleUnits: 0, boundaryOnly: 1 })
  })
})

describe('reports/reference-differences.md', () => {
  let report: ReferenceReport

  // Every reference profile over every original fixture and conformance case, each in its own worker.
  beforeAll(async () => {
    report = await buildReferenceReport()
  }, 300_000)

  it('is current', () => {
    expect(report.markdown === readFileSync(REPORT_PATH, 'utf8'), 'run `npm run report:references`').toBe(true)
  })

  it('finds every conformance case within its contract', () => {
    expect(report.conformance.flatMap((input) => [...input.problems].flatMap(([profileId, problems]) => problems.map((problem) => `${input.input} ${profileId}: ${problem}`)))).toEqual([])
  })

  it('attributes every difference to exactly one named expectation, and observes each one', () => {
    const { unexplained, ambiguous, unobserved } = report.attribution
    expect({ unexplained, ambiguous, unobserved }).toEqual({ unexplained: [], ambiguous: [], unobserved: [] })
  })

  const tracks = (input: string, a: OracleProfileId, b: OracleProfileId): Track[] =>
    report.observations
      .filter((item) => item.input === input && item.pair.includes(a) && item.pair.includes(b))
      .map((item) => item.track)
      .sort()

  it('shows the > and >= cap difference between product and shiki-api at exactly 20000 units', () => {
    expect(tracks('typescript/line-19999', 'product', 'shiki-api')).toEqual(['style-boundaries'])
    expect(tracks('typescript/line-20000', 'product', 'shiki-api')).toEqual(['scopes', 'styles'])
    expect(tracks('typescript/line-20001', 'product', 'shiki-api')).toEqual(['styles'])
  })

  it('shows the fence languages Markdown gains when its lazy embeddings are registered', () => {
    expect(tracks('markdown/fences', 'product', 'product:warm')).toEqual(['scopes', 'styles'])
  })

  it('finds no difference between upstream vscode-textmate and the Shiki fork', () => {
    expect(report.observations.filter((item) => item.pair.includes('raw') && item.pair.includes('raw:shiki-fork'))).toEqual([])
  })
})
