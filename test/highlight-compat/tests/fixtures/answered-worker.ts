import { parentPort, workerData } from 'node:worker_threads'
import { ResultBuilder } from '../../src/build.ts'
import type { DocumentRequest } from '../../src/oracles/request.ts'

const request = workerData as DocumentRequest
const builder = new ResultBuilder({ profileId: request.profileId, languageId: request.languageId }, request.source)
builder.scope(0, request.source.length, [])
parentPort?.postMessage({ ok: true, value: builder.complete() })
if (request.source === 'throw-after-answer') {
  parentPort?.once('message', () => { throw new Error('failure after answer') })
} else if (request.source === 'exit-after-answer') {
  parentPort?.once('message', () => process.exit(3))
} else {
  setInterval(() => undefined, 1000)
}
