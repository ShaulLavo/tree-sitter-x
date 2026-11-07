import { parentPort, workerData } from 'node:worker_threads'
import { collectNativeWaveDocument, boundedAnswer } from './wave-document.ts'
import { parseWorkerRequest } from '../wave-collection.ts'
const request = parseWorkerRequest(workerData)
const answer = await collectNativeWaveDocument(request, new AbortController().signal)
boundedAnswer(answer)
parentPort?.postMessage(answer)
parentPort?.close()
