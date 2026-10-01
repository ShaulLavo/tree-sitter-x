import { GOLDEN_ROOT } from './golden.ts'
import { readReference } from './corpus.ts'
import { checkExpectations } from './expectations.ts'
import { loadFixture } from './fixtures/load.ts'
import { fixtures } from './fixtures/registry.ts'

export interface ExpectationScore {
  readonly profile: 'raw' | 'product'
  readonly family: string
  readonly fixture: string
  readonly grammar: string
  readonly passed: number
  readonly total: number
  readonly failures: readonly string[]
  readonly status: string
}

export function historicalScores(root = GOLDEN_ROOT): ExpectationScore[] {
  const scores: ExpectationScore[] = []
  for (const fixture of fixtures) {
    const loaded = loadFixture(fixture)
    if (loaded.textmate.length === 0) continue
    for (const profile of ['raw', 'product'] as const) {
      const result = readReference({ fixtureId: fixture.id, languageId: fixture.languageId, source: loaded.source, lane: 'real' }, profile, root)
      for (const set of loaded.textmate) {
        const checks = checkExpectations(result, set.expectations)
        scores.push({
          profile, family: fixture.family, fixture: fixture.id, grammar: set.grammar,
          passed: checks.filter(check => check.pass).length, total: checks.length,
          failures: checks.filter(check => !check.pass).map(check => check.expectation.scopes.join(' ') + (check.expectation.not?.length ? ` without ${check.expectation.not.join(' ')}` : '')),
          status: result.status,
        })
      }
    }
  }
  return scores
}

const percent = (passed: number, total: number): string => total === 0 ? 'N/A' : `${(100 * passed / total).toFixed(2)}%`
const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

function scoreTable(scores: readonly ExpectationScore[], label: string, key: (score: ExpectationScore) => string): string[] {
  const grouped = new Map<string, { profile: string; label: string; passed: number; total: number }>()
  for (const score of scores) {
    const name = key(score), id = `${score.profile}\0${name}`
    const row = grouped.get(id) ?? { profile: score.profile, label: name, passed: 0, total: 0 }
    row.passed += score.passed
    row.total += score.total
    grouped.set(id, row)
  }
  return [
    `| Reference | ${label} | Passed | Assertions | Pass rate |`, '| --- | --- | ---: | ---: | ---: |',
    ...[...grouped.values()].map(row => `| ${row.profile} | ${cell(row.label)} | ${row.passed} | ${row.total} | ${percent(row.passed, row.total)} |`),
  ]
}

export function buildHistoricalReport(root = GOLDEN_ROOT): string {
  const scores = historicalScores(root)
  const failing = new Map<string, { profile: string; pattern: string; count: number }>()
  for (const score of scores) {
    for (const pattern of score.failures) {
      const key = `${score.profile}\0${pattern}`
      const row = failing.get(key) ?? { profile: score.profile, pattern, count: 0 }
      row.count++
      failing.set(key, row)
    }
  }
  const incomplete = scores.filter(score => score.status !== 'complete')
  return [
    '# Historical expectation drift', '',
    'Diagnostic only. Historical snapshots have no stamped generation revision. The inspected maintainer grammars and the product @shikijs/langs 4.4.3 grammar identities remain distinct. These assertions gate no scope pack and never become reference goldens.', '',
    'Inputs are the byte-verified real fixture registry. Results are raw and product reference goldens generated from those exact sources. Ordered scope subsequences and negative scopes use checkExpectations unchanged. An assertion checks its selected UTF-16 interval, not unasserted text or full-file coverage.', '',
    'Coverage is 545 VS Code assertions and 1,603 TypeScript-TmLanguage assertions per reference. The two positionless VS Code Tree-sitter snapshots remain unconverted. Tree-sitter capture annotations have their own type and are outside this TextMate diagnostic.', '',
    '## By family', '', ...scoreTable(scores, 'Family', score => score.family), '',
    '## By fixture', '', ...scoreTable(scores, 'Fixture', score => score.fixture), '',
    '## By grammar section', '', ...scoreTable(scores, 'Fixture / grammar section', score => `${score.fixture} / ${score.grammar}`), '',
    '## Top failing scope patterns', '', '| Reference | Expected ordered scopes | Failing assertions |', '| --- | --- | ---: |',
    ...[...failing.values()].sort((a, b) => b.count - a.count || (a.profile < b.profile ? -1 : Number(a.profile > b.profile)) || (a.pattern < b.pattern ? -1 : Number(a.pattern > b.pattern))).slice(0, 30).map(row => `| ${row.profile} | ${cell(row.pattern)} | ${row.count} |`), '',
    '## Non-complete references', '',
    ...(incomplete.length === 0 ? ['None.'] : incomplete.map(score => `- ${score.profile} ${score.fixture}: ${score.status}, ${score.total} assertions failed.`)), '',
    'Regenerate with `npm run report:historical`. Goldens are updated separately by reference-only `golden:update`.', '',
  ].join('\n')
}
