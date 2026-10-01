import { readFileSync } from 'node:fs'
import type { GoldenCase } from './golden.ts'
import { goldenPath, GOLDEN_ROOT } from './golden.ts'
import { loadFixture } from './fixtures/load.ts'
import { fixtures } from './fixtures/registry.ts'
import { ORACLE_THEMES } from './oracles/pins.ts'
import type { OracleProfileId } from './oracles/request.ts'
import { runAll, runDocument } from './oracles/run.ts'
import { originalFixtures } from './original-fixtures.ts'
import type { DocumentResult } from './schema.ts'
import { parseResultText } from './serialize.ts'

export interface CorpusInput {
  readonly fixtureId: string
  readonly languageId: string
  readonly source: string
  readonly lane: 'real' | 'original'
}

export function corpusInputs(): CorpusInput[] {
  return [
    ...fixtures.map(fixture => ({ fixtureId: fixture.id, languageId: fixture.languageId, source: loadFixture(fixture).source, lane: 'real' as const })),
    ...originalFixtures().map(fixture => ({ ...fixture, fixtureId: `original/${fixture.fixtureId}`, lane: 'original' as const })),
  ]
}

export async function* realCases(profileId: OracleProfileId): AsyncIterable<GoldenCase> {
  const inputs = corpusInputs().filter(input => input.lane === 'real' && (profileId !== 'product:warm' || input.languageId === 'markdown'))
  const results = await runAll(inputs, input => runDocument({ kind: 'document', profileId, languageId: input.languageId, source: input.source, themeIds: ORACLE_THEMES }))
  for (const [index, input] of inputs.entries()) yield { ...input, result: results[index] as DocumentResult }
}

export function readReference(input: CorpusInput, profileId: 'raw' | 'product', root = GOLDEN_ROOT): DocumentResult {
  return parseResultText(readFileSync(goldenPath(root, profileId, input.languageId, input.fixtureId), 'utf8'), input.source)
}
