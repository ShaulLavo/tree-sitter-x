import { isDeepStrictEqual } from 'node:util'
import { type ConformanceCase, type ExpectedToken, expectedTokens, type SuiteId } from './conformance.ts'
import type { ConformanceProfileId } from './request.ts'

/**
 * A selected upstream case a pinned engine does not reproduce. `lines` holds that engine's exact
 * tokens for each line that differs; every other line must still match the suite.
 */
export interface ConformanceDifference {
  readonly suite: SuiteId
  readonly desc: string
  readonly profiles: readonly ConformanceProfileId[]
  readonly cause: 'unreleased-engine-fix'
  readonly because: string
  readonly lines: Readonly<Record<number, readonly ExpectedToken[]>>
}

const RELEASE_GAP = 'The suites are pinned at vscode-textmate fbe49961, after the 9.3.2 release; neither vscode-textmate 9.3.2 nor @shikijs/vscode-textmate 10.0.2 contains'

const token = (value: string, ...scopes: string[]): ExpectedToken => ({ value, scopes })

export const CONFORMANCE_DIFFERENCES: readonly ConformanceDifference[] = [
  {
    suite: 'suite1',
    desc: 'Issue #66',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#252 (b29ed8d2), which lets an empty \`end\` match end a rule at once and rewrote this case's grammar and tokens.`,
    lines: {
      0: [token('J', 'text.test', 'comment'), token('ust some text', 'text.test', 'comment')],
      1: [token('which contains undefined and then', 'text.test', 'comment')],
      2: [token('more text', 'text.test', 'comment')],
    },
  },
  {
    suite: 'suite1',
    desc: 'Issue #251 empty `end` match immediately',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#252 (b29ed8d2), which added this case.`,
    lines: {
      0: [token('   ', 'source.empty.end'), token('comment', 'source.empty.end', 'comment'), token('   ', 'source.empty.end', 'comment')],
    },
  },
  {
    suite: 'suite1',
    desc: 'Issue #239 Wrong backreference escaping',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#276 (3a9bd78b), which escapes back-references as TextMate 2.0 does and added this case.`,
    lines: {
      0: [token('#a-z', 'source.backreference-escaping', 'string'), token(' comment', 'source.backreference-escaping', 'string')],
    },
  },
]

export function conformanceDifference(suite: SuiteId, desc: string, profileId: ConformanceProfileId): ConformanceDifference | undefined {
  return CONFORMANCE_DIFFERENCES.find(
    (difference) => difference.suite === suite && difference.desc === desc && difference.profiles.includes(profileId),
  )
}

/**
 * Lines where an engine's tokens break the contract: the suite's tokens, or the pinned tokens of
 * a named difference. A pinned line that matches the suite again is stale and also reported.
 */
export function conformanceProblems(
  conformance: ConformanceCase,
  actual: readonly (readonly ExpectedToken[])[],
  difference: ConformanceDifference | undefined,
): string[] {
  const outside = Object.keys(difference?.lines ?? {}).filter((index) => Number(index) >= conformance.lines.length)
  const stale = outside.map((index) => `line ${index}: pinned, but the case has ${conformance.lines.length} lines`)
  return stale.concat(conformance.lines.flatMap((line, index) => {
    const suite = expectedTokens(line.line, line.tokens)
    const pinned = difference?.lines[index]
    if (pinned !== undefined && isDeepStrictEqual(pinned, suite)) return [`line ${index}: pinned tokens equal the suite's; drop them`]
    const expected = pinned ?? suite
    if (isDeepStrictEqual(actual[index], expected)) return []
    return [`line ${index}: expected ${pinned === undefined ? 'suite' : 'pinned'} tokens ${JSON.stringify(expected)}, got ${JSON.stringify(actual[index])}`]
  }))
}
