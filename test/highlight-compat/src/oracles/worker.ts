import { parentPort, workerData } from 'node:worker_threads'
import { conformanceOracle, documentOracle } from './oracles.ts'
import type { OracleRequest, WorkerReply } from './request.ts'

const request = workerData as OracleRequest

async function answer(): Promise<WorkerReply> {
  try {
    const value = request.kind === 'document' ? await documentOracle(request) : await conformanceOracle(request)
    return { ok: true, value }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

parentPort?.postMessage(await answer())
