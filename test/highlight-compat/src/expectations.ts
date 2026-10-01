import type { DocumentResult } from './schema.ts'

export interface ExpectationOrigin {
  readonly family: string
  readonly file: string
  /** One-based physical annotation coordinates. */
  readonly line: number
  readonly column: number
}

export interface Expectation {
  readonly fixtureId: string
  readonly from: number
  readonly to: number
  /** Ordered subsequence required in every intersecting scope path. */
  readonly scopes: readonly string[]
  readonly not?: readonly string[]
  readonly origin: ExpectationOrigin
}

export interface ExpectationCheck {
  readonly expectation: Expectation
  readonly pass: boolean
  readonly expectedPath: readonly string[]
  readonly actualPaths: readonly { readonly from: number; readonly to: number; readonly path: readonly string[] }[]
  readonly reason?: string
}

function orderedSubsequence(path: readonly string[], required: readonly string[]): boolean {
  let next = 0
  for (const scope of path) {
    if (scope === required[next]) next++
  }
  return next === required.length
}

export function checkExpectations(result: DocumentResult, expectations: readonly Expectation[]): readonly ExpectationCheck[] {
  if (result.status !== 'complete') {
    if (expectations.length === 0) throw new Error(`expectations require a complete result, received ${result.status}`)
    return expectations.map(expectation => ({
      expectation, pass: false, expectedPath: expectation.scopes, actualPaths: [],
      reason: `expectations require a complete result, received ${result.status}`,
    }))
  }
  return expectations.map(expectation => checkOne(result, expectation))
}

function checkOne(result: Extract<DocumentResult, { status: 'complete' }>, expectation: Expectation): ExpectationCheck {
  const { from, to } = expectation
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to > result.sourceLength || from >= to) {
    throw new RangeError(`expectation range [${from}, ${to}) is outside [0, ${result.sourceLength}) or empty`)
  }
  const actualPaths: { from: number; to: number; path: readonly string[] }[] = []
  for (let i = 0; i < result.spans.length; i += 3) {
    const start = result.spans[i], end = result.spans[i + 1]
    if (end <= from) continue
    if (start >= to) break
    actualPaths.push({
      from: Math.max(from, start), to: Math.min(to, end),
      path: result.paths[result.spans[i + 2]].map(index => result.scopeNames[index]),
    })
  }
  const pass = actualPaths.length > 0 && actualPaths.every(({ path }) =>
    orderedSubsequence(path, expectation.scopes) && !(expectation.not ?? []).some(scope => path.includes(scope)),
  )
  return { expectation, pass, expectedPath: expectation.scopes, actualPaths }
}
