import type { SuiteId } from './conformance.ts'
import type { ConformanceProfileId } from './request.ts'

/** A selected upstream case whose expected tokens a pinned engine does not reproduce, and why. */
export interface ConformanceDifference {
  readonly suite: SuiteId
  readonly desc: string
  readonly profiles: readonly ConformanceProfileId[]
  readonly cause: 'unreleased-engine-fix'
  readonly because: string
}

const RELEASE_GAP = 'The suites are pinned at vscode-textmate fbe49961, after the 9.3.2 release; neither vscode-textmate 9.3.2 nor @shikijs/vscode-textmate 10.0.2 contains'

export const CONFORMANCE_DIFFERENCES: readonly ConformanceDifference[] = [
  {
    suite: 'suite1',
    desc: 'Issue #66',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#252 (b29ed8d2), which lets an empty \`end\` match end a rule at once and rewrote this case's grammar and tokens.`,
  },
  {
    suite: 'suite1',
    desc: 'Issue #251 empty `end` match immediately',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#252 (b29ed8d2), which added this case.`,
  },
  {
    suite: 'suite1',
    desc: 'Issue #239 Wrong backreference escaping',
    profiles: ['raw', 'raw:shiki-fork'],
    cause: 'unreleased-engine-fix',
    because: `${RELEASE_GAP} microsoft/vscode-textmate#276 (3a9bd784), which escapes back-references as TextMate 2.0 does and added this case.`,
  },
]

export function conformanceDifference(suite: SuiteId, desc: string, profileId: ConformanceProfileId): ConformanceDifference | undefined {
  return CONFORMANCE_DIFFERENCES.find(
    (difference) => difference.suite === suite && difference.desc === desc && difference.profiles.includes(profileId),
  )
}
