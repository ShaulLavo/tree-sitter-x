import { parentPort, workerData } from 'node:worker_threads'
import { ResultBuilder } from '../../src/build.ts'
import type { DocumentRequest } from '../../src/oracles/request.ts'

const request = workerData as DocumentRequest
const source = request.source === 'source' ? 'wrong source' : request.source
const builder = new ResultBuilder({
  profileId: request.source === 'profile' ? 'product' : request.profileId,
  languageId: request.source === 'language' ? 'jsx' : request.languageId,
  engine: { referenceMetadata: 'required-language-v1', metadataSemantics: 'whole-source-root',
    metadataCodebook: JSON.stringify([{ nativeId: request.source === 'wrong-codebook' ? 0 : 1, languageId: 'json', scopeName: 'source.json' }]),
    metadataConfiguration: 'configured initialLanguage=1 (default was unset 0)' },
}, source)
builder.scope(0, source.length, [])
const result = ['timeout', 'error', 'canceled', 'unsupported'].includes(source)
  ? builder.incomplete(source === 'timeout' ? 'timeout' : source === 'canceled' ? 'canceled' : source === 'unsupported' ? 'unsupported' : 'error', 'original outcome')
  : builder.complete()
function reply() {
  if (request.source === 'partial') return { ...result, metadata: { languageIds: ['json'], spans: [0, 1, 0] } }
  if (request.source === 'wrong-codebook' || request.source === 'wrong-ids')
    return { ...result, metadata: { languageIds: [request.source === 'wrong-ids' ? 'jsx' : 'json'], spans: [0, source.length, 0] } }
  return result
}
const value = reply()
parentPort?.postMessage({ ok: true, value })
