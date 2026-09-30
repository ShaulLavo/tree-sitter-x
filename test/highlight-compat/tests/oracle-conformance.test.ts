import { isDeepStrictEqual } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'
import { caseLabel, type CaseRef, expectedTokens, loadCase, selectedCases } from '../src/oracles/conformance.ts'
import { CONFORMANCE_DIFFERENCES, conformanceDifference } from '../src/oracles/conformance-expectations.ts'
import { CONFORMANCE_PROFILES, type ConformanceProfileId } from '../src/oracles/request.ts'
import { type ConformanceOutcome, runAll, runConformance } from '../src/oracles/run.ts'

const cases = selectedCases()
const outcomes = new Map<ConformanceProfileId, ConformanceOutcome[]>()

// 94 cases per engine, each in its own worker; the bound is the work, not a retry margin.
beforeAll(async () => {
  for (const profileId of CONFORMANCE_PROFILES) {
    outcomes.set(profileId, await runAll(cases, (ref) => runConformance({ kind: 'conformance', profileId, ...ref })))
  }
}, 180_000)

function mismatchedLines(ref: CaseRef, outcome: ConformanceOutcome): number[] {
  if (outcome.status !== 'complete') return []
  const conformance = loadCase(ref)
  return conformance.lines.flatMap((line, index) =>
    isDeepStrictEqual(outcome.answer.lines[index], expectedTokens(line.line, line.tokens)) ? [] : [index],
  )
}

describe('vendored vscode-textmate suites', () => {
  it('select the 94 cases fixture-sources.json selects, without the SQL case', () => {
    expect(cases).toHaveLength(94)
    expect(cases.filter((ref) => ref.suite === 'first-mate')).toHaveLength(63)
    expect(cases.some((ref) => ref.suite === 'first-mate' && ref.index === 26)).toBe(false)
  })

  it('names only differences that exist among the selected cases', () => {
    const labels = cases.map((ref) => `${ref.suite} ${loadCase(ref).desc}`)
    for (const difference of CONFORMANCE_DIFFERENCES) expect(labels).toContain(`${difference.suite} ${difference.desc}`)
  })

  it('drops empty expected tokens only on non-empty lines, as the upstream runner does', () => {
    const tokens = [{ value: '', scopes: ['a'] }, { value: 'x', scopes: ['a'] }]
    expect(expectedTokens('x', tokens)).toEqual([{ value: 'x', scopes: ['a'] }])
    expect(expectedTokens('', tokens)).toEqual(tokens)
  })
})

describe.each(CONFORMANCE_PROFILES)('%s on the conformance suites', (profileId) => {
  it.each(cases.map((ref) => [caseLabel(ref, loadCase(ref)), ref] as const))('%s', (_label, ref) => {
    const outcome = outcomes.get(profileId)?.[cases.indexOf(ref)]
    expect(outcome?.status).toBe('complete')
    if (outcome === undefined) return
    const difference = conformanceDifference(ref.suite, loadCase(ref).desc, profileId)
    const mismatches = mismatchedLines(ref, outcome)
    if (difference === undefined) expect(mismatches).toEqual([])
    else expect(mismatches.length, difference.because).toBeGreaterThan(0)
  })
})
