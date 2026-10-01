import { beforeAll, describe, expect, it } from 'vitest'
import { caseLabel, expectedTokens, loadCase, selectedCases } from '../src/oracles/conformance.ts'
import { CONFORMANCE_DIFFERENCES, conformanceDifference, conformanceProblems } from '../src/oracles/conformance-expectations.ts'
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

describe('conformanceProblems', () => {
  const ref = cases.find((candidate) => loadCase(candidate).desc === 'Issue #66')
  const difference = CONFORMANCE_DIFFERENCES.find((entry) => entry.desc === 'Issue #66')
  if (ref === undefined || difference === undefined) throw new Error('Issue #66 is not selected')
  const conformance = loadCase(ref)
  const pinned = conformance.lines.map((line, index) => difference.lines[index] ?? expectedTokens(line.line, line.tokens))

  it('accepts exactly the pinned tokens of a named difference', () => {
    expect(conformanceProblems(conformance, pinned, difference)).toEqual([])
  })

  it('rejects an unrelated corruption inside a named difference', () => {
    const [first, ...rest] = pinned
    const corrupted = [[{ value: 'J', scopes: ['text.test', 'string'] }, ...(first ?? []).slice(1)], ...rest]
    expect(conformanceProblems(conformance, corrupted, difference)).toEqual([expect.stringMatching(/^line 0: expected pinned tokens/)])
  })

  it('rejects a difference the case does not name', () => {
    expect(conformanceProblems(conformance, pinned, undefined)).toHaveLength(Object.keys(difference.lines).length)
  })
})

describe.each(CONFORMANCE_PROFILES)('%s on the conformance suites', (profileId) => {
  it.each(cases.map((ref) => [caseLabel(ref, loadCase(ref)), ref] as const))('%s', (_label, ref) => {
    const outcome = outcomes.get(profileId)?.[cases.indexOf(ref)]
    if (outcome?.status !== 'complete') throw new Error(`${profileId}: ${outcome?.status ?? 'missing'}`)
    const conformance = loadCase(ref)
    expect(conformanceProblems(conformance, outcome.answer.lines, conformanceDifference(ref.suite, conformance.desc, profileId))).toEqual([])
  })
})
