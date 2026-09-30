import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ReferenceExpectation } from '../src/oracles/reference-expectations.ts'
import type { OracleProfileId } from '../src/oracles/request.ts'
import type { Observation, Track } from '../src/reference-observations.ts'
import { attribute, buildReferenceReport, REPORT_PATH, type ReferenceReport } from '../src/reference-report.ts'

const observation = (input: string, track: Track, units = 1): Observation => ({ input, pair: ['raw', 'product'], track, units })

const expectation = (patch: Partial<ReferenceExpectation>): ReferenceExpectation => ({
  id: 'x',
  cause: 'empty-line',
  minimalFixture: 'ts/a',
  inputs: ['ts/a'],
  pairs: [['product', 'raw']],
  tracks: ['scopes'],
  why: '',
  ...patch,
})

describe('attribute', () => {
  it('claims an observed difference for the expectation naming its input, unordered pair and track', () => {
    const result = attribute([observation('ts/a', 'scopes')], [expectation({})])
    expect([result.unexplained, result.ambiguous, result.unobserved]).toEqual([[], [], []])
  })

  it('reports a difference no expectation names as unexplained', () => {
    expect(attribute([observation('ts/b', 'scopes')], [expectation({ inputs: ['ts/b'], tracks: ['styles'] })]).unexplained).toHaveLength(1)
  })

  it('reports a difference two expectations name as ambiguous', () => {
    expect(attribute([observation('ts/a', 'scopes')], [expectation({}), expectation({ id: 'y' })]).ambiguous).toHaveLength(1)
  })

  it('reports an expectation whose claim is not observed', () => {
    expect(attribute([], [expectation({})]).unobserved).toEqual(['x: ts/a raw ~ product scopes'])
  })

  it('lets an every-fixture expectation claim any fixture but no conformance input, and requires its minimal fixture', () => {
    const every = expectation({ inputs: 'every-fixture', tracks: ['style-boundaries'] })
    const result = attribute([observation('ts/z', 'style-boundaries'), observation('conformance/c', 'style-boundaries')], [every])
    expect(result.unexplained.map((item) => item.input)).toEqual(['conformance/c'])
    expect(result.unobserved).toEqual(['x: ts/a raw ~ product style-boundaries'])
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
