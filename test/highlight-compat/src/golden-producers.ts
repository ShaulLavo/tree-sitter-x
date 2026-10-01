import type { GoldenCase, GoldenProducers } from './golden.ts'
import { realCases } from './corpus.ts'
import type { OracleProfileId } from './oracles/request.ts'
import { differingCases, originalCases } from './reference-results.ts'

async function* cases(profileId: OracleProfileId): AsyncIterable<GoldenCase> {
  yield* originalCases(profileId)
  yield* realCases(profileId)
}

export const goldenProducers: GoldenProducers = {
  raw: () => cases('raw'),
  'raw:shiki-fork': () => differingCases('raw:shiki-fork', 'raw'),
  'shiki-api': () => cases('shiki-api'),
  product: () => cases('product'),
  'product:warm': () => cases('product:warm'),
}
