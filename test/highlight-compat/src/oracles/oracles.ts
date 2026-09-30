import { ResultBuilder } from '../build.ts'
import type { CompleteResult } from '../schema.ts'
import { actualTokens, caseGrammarSet, loadCase } from './conformance.ts'
import { SEPARATOR_SCOPES, sourceLines, writeTrack } from './lines.ts'
import { productDocument } from './product/document.ts'
import { loadRootGrammar, rawDocument, tokenizeScopes } from './raw.ts'
import type { ConformanceAnswer, ConformanceProfileId, ConformanceRequest, DocumentRequest, OracleProfileId } from './request.ts'
import { shikiApiDocument } from './shiki-api.ts'
import { type EngineId, textmateEngine } from './textmate.ts'

/** Each call builds its own engine, registry or highlighter; nothing survives between calls. */
const DOCUMENT_ORACLES: Readonly<Record<OracleProfileId, (request: DocumentRequest) => Promise<CompleteResult>>> = {
  raw: async (request) => rawDocument(await textmateEngine('upstream'), request),
  'raw:shiki-fork': async (request) => rawDocument(await textmateEngine('shiki-fork'), request),
  'shiki-api': shikiApiDocument,
  product: (request) => productDocument(request, 'cold'),
  'product:warm': (request) => productDocument(request, 'warm'),
}

const CONFORMANCE_ENGINES: Readonly<Record<ConformanceProfileId, EngineId>> = {
  raw: 'upstream',
  'raw:shiki-fork': 'shiki-fork',
}

export function documentOracle(request: DocumentRequest): Promise<CompleteResult> {
  if (request.themeIds.length === 0) throw new Error('an oracle request needs at least one theme')
  return DOCUMENT_ORACLES[request.profileId](request)
}

/** The case's lines joined with LF form the result's source; no case line holds a terminator. */
export async function conformanceOracle(request: ConformanceRequest): Promise<ConformanceAnswer> {
  const conformance = loadCase(request)
  const engine = await textmateEngine(CONFORMANCE_ENGINES[request.profileId])
  const grammars = caseGrammarSet(request, conformance)
  const { grammar } = await loadRootGrammar(engine, grammars)
  const texts = conformance.lines.map((line) => line.line)
  const scopes = tokenizeScopes(grammar, texts)
  const source = texts.join('\n')
  const builder = new ResultBuilder({ profileId: request.profileId, languageId: grammars.rootScope, engine: engine.identity }, source)
  const spans = (line: number) => (scopes[line] ?? []).map((token) => ({ from: token.startIndex, to: token.endIndex, value: token.scopes }))
  writeTrack(sourceLines(source), spans, (from, to, value) => builder.scope(from, to, value), SEPARATOR_SCOPES)
  return { lines: scopes.map((tokens, line) => actualTokens(texts[line] ?? '', tokens)), result: builder.complete() }
}
