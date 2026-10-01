import { isDeepStrictEqual } from 'node:util'
import { caseLabel, type CaseRef, expectedTokens, loadCase, selectedCases } from './oracles/conformance.ts'
import { conformanceDifference, conformanceProblems } from './oracles/conformance-expectations.ts'
import { CONFORMANCE_PROFILES, type ConformanceProfileId, ORACLE_PROFILES, type OracleProfileId } from './oracles/request.ts'
import { type ConformanceOutcome, runAll, runConformance } from './oracles/run.ts'
import { originalFixtures } from './original-fixtures.ts'
import { originalResults } from './reference-results.ts'
import type { DocumentResult } from './schema.ts'

/** One input with a result per profile that can run it. */
export interface ReferenceInput {
  readonly input: string
  readonly source: string
  readonly results: ReadonlyMap<OracleProfileId, DocumentResult>
}

export interface ConformanceInput extends ReferenceInput {
  readonly ref: CaseRef
  readonly desc: string
  /** Per profile: does its output equal the suite's expected tokens? */
  readonly matchesSuite: ReadonlyMap<ConformanceProfileId, boolean>
  /** Per profile: contract breaches, against the suite or a named difference's pinned tokens. */
  readonly problems: ReadonlyMap<ConformanceProfileId, readonly string[]>
  readonly failures: ReadonlyMap<ConformanceProfileId, string>
}

export async function fixtureInputs(): Promise<ReferenceInput[]> {
  const fixtures = originalFixtures()
  const byProfile = await Promise.all(ORACLE_PROFILES.map((profileId) => originalResults(profileId, fixtures)))
  return fixtures.map((fixture, index) => ({
    input: `${fixture.languageId}/${fixture.fixtureId}`,
    source: fixture.source,
    results: new Map(ORACLE_PROFILES.map((profileId, at) => [profileId, byProfile[at]?.[index] as DocumentResult])),
  }))
}

function matches(ref: CaseRef, outcome: ConformanceOutcome): boolean {
  if (outcome.status !== 'complete') return false
  return loadCase(ref).lines.every((line, index) => isDeepStrictEqual(outcome.answer.lines[index], expectedTokens(line.line, line.tokens)))
}

export async function conformanceInputs(): Promise<ConformanceInput[]> {
  const refs = selectedCases()
  const byProfile = await Promise.all(
    CONFORMANCE_PROFILES.map((profileId) => runAll(refs, (ref) => runConformance({ kind: 'conformance', profileId, ...ref }))),
  )
  return refs.map((ref, index) => {
    const conformance = loadCase(ref)
    const outcomes = CONFORMANCE_PROFILES.map((profileId, at) => [profileId, byProfile[at]?.[index] as ConformanceOutcome] as const)
    const results = new Map<OracleProfileId, DocumentResult>()
    const failures = new Map<ConformanceProfileId, string>()
    for (const [profileId, outcome] of outcomes) {
      if (outcome.status === 'complete') results.set(profileId, outcome.answer.result)
      else failures.set(profileId, `${outcome.status}: ${outcome.diagnostic}`)
    }
    return {
      input: `conformance/${caseLabel(ref, conformance)}`,
      source: conformance.lines.map((line) => line.line).join('\n'),
      ref,
      desc: conformance.desc,
      results,
      failures,
      matchesSuite: new Map(outcomes.map(([profileId, outcome]) => [profileId, matches(ref, outcome)])),
      problems: new Map(
        outcomes.map(([profileId, outcome]) => [
          profileId,
          outcome.status === 'complete'
            ? conformanceProblems(conformance, outcome.answer.lines, conformanceDifference(ref.suite, conformance.desc, profileId))
            : [`${outcome.status}: ${outcome.diagnostic}`],
        ]),
      ),
    }
  })
}
