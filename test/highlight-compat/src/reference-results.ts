import type { GoldenCase } from './golden.ts'
import { ORACLE_THEMES } from './oracles/pins.ts'
import type { OracleProfileId } from './oracles/request.ts'
import { runAll, runDocument } from './oracles/run.ts'
import { type OriginalFixture, originalFixtures } from './original-fixtures.ts'
import type { DocumentResult } from './schema.ts'
import { serializeResult } from './serialize.ts'

/** One profile's results over the original fixtures, in fixture order, each from its own worker. */
export function originalResults(profileId: OracleProfileId, fixtures: readonly OriginalFixture[] = originalFixtures()): Promise<DocumentResult[]> {
  return runAll(fixtures, (fixture) =>
    runDocument({ kind: 'document', profileId, languageId: fixture.languageId, source: fixture.source, themeIds: ORACLE_THEMES }),
  )
}

const goldenCase = (fixture: OriginalFixture, result: DocumentResult): GoldenCase => ({
  languageId: fixture.languageId,
  fixtureId: `original/${fixture.fixtureId}`,
  source: fixture.source,
  result,
})

export async function* originalCases(profileId: OracleProfileId): AsyncIterable<GoldenCase> {
  const fixtures = originalFixtures()
  const results = await originalResults(profileId, fixtures)
  for (const [index, fixture] of fixtures.entries()) yield goldenCase(fixture, results[index] as DocumentResult)
}

/** Equal apart from the profile and engine identities, which always differ between two profiles. */
export function sameContent(a: DocumentResult, b: DocumentResult): boolean {
  return serializeResult({ ...a, profileId: b.profileId, engine: b.engine }) === serializeResult(b)
}

/**
 * `variant` cases only where its result differs from `base`'s on the same fixture. Both sides must
 * be complete on every fixture: equal failures are not equal content, and a failed base proves no
 * difference. Throwing before the first case makes golden:update write and delete nothing.
 */
export function* sparseCases(
  fixtures: readonly OriginalFixture[],
  variants: readonly DocumentResult[],
  bases: readonly DocumentResult[],
): Iterable<GoldenCase> {
  const failed = fixtures.flatMap((fixture, index) =>
    [variants[index], bases[index]].flatMap((result) =>
      result === undefined || result.status !== 'complete'
        ? [`${fixture.languageId}/${fixture.fixtureId}: ${result?.profileId ?? 'missing'} ${result?.status ?? 'result'} ${result?.diagnostics.join('; ') ?? ''}`.trim()]
        : [],
    ),
  )
  if (failed.length > 0) throw new Error(`sparse goldens need complete results on both sides:\n  ${failed.join('\n  ')}`)
  for (const [index, fixture] of fixtures.entries()) {
    const result = variants[index] as DocumentResult
    if (!sameContent(result, bases[index] as DocumentResult)) yield goldenCase(fixture, result)
  }
}

export async function* differingCases(variant: OracleProfileId, base: OracleProfileId): AsyncIterable<GoldenCase> {
  const fixtures = originalFixtures()
  const [variants, bases] = await Promise.all([originalResults(variant, fixtures), originalResults(base, fixtures)])
  yield* sparseCases(fixtures, variants, bases)
}
