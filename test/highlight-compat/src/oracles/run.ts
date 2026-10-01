import { Worker } from 'node:worker_threads'
import { ResultBuilder } from '../build.ts'
import type { DocumentResult, IncompleteStatus } from '../schema.ts'
import { parseResult } from '../validate.ts'
import { loadCase } from './conformance.ts'
import type { ConformanceAnswer, ConformanceRequest, DocumentRequest, OracleRequest, WorkerReply } from './request.ts'

const WORKER_URL = new URL('./worker.ts', import.meta.url)

/** Generous next to the few seconds the slowest fixture takes; only a runaway grammar reaches it. */
export const DEFAULT_DEADLINE_MS = 60_000

/** Oracle workers alive at once in this process, across every caller; each holds its own engine and grammars. */
export const ORACLE_CONCURRENCY = 4

const waiting: (() => void)[] = []
let running = 0

// One gate for the whole process: a report runs seven profile batches at once, and per-batch pools
// would multiply the worker count.
async function acquire(): Promise<() => void> {
  if (running >= ORACLE_CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  return () => {
    running--
    waiting.shift()?.()
  }
}

type Failure = { readonly status: Exclude<IncompleteStatus, 'unsupported' | 'canceled'>; readonly diagnostic: string }
type Settled = { readonly status: 'complete'; readonly value: unknown } | Failure

/** One request in a fresh worker; the worker is terminated at the deadline, so no answer arrives late. */
async function inWorker(request: OracleRequest, deadlineMs: number): Promise<Settled> {
  const release = await acquire()
  try {
    return await oneWorker(request, deadlineMs)
  } finally {
    release()
  }
}

function oneWorker(request: OracleRequest, deadlineMs: number): Promise<Settled> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL, { workerData: request })
    let settled = false
    const settle = (outcome: Settled): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(outcome)
    }
    const timer = setTimeout(() => settle({ status: 'timeout', diagnostic: `no answer within the ${deadlineMs} ms process deadline` }), deadlineMs)
    worker.once('message', (reply: WorkerReply) => {
      settle(reply.ok ? { status: 'complete', value: reply.value } : { status: 'error', diagnostic: reply.message })
    })
    worker.once('error', (error: unknown) => settle({ status: 'error', diagnostic: `oracle worker failed: ${messageOf(error)}` }))
    worker.once('exit', (code) => settle({ status: 'error', diagnostic: `oracle worker exited with code ${code} before answering` }))
  })
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** A validated result, or an incomplete one with the reason; never a partial result. */
export async function runDocument(request: DocumentRequest, deadlineMs = DEFAULT_DEADLINE_MS): Promise<DocumentResult> {
  const failed = (status: Failure['status'], diagnostic: string) =>
    new ResultBuilder({ profileId: request.profileId, languageId: request.languageId }, request.source).incomplete(status, diagnostic)
  const settled = await inWorker(request, deadlineMs)
  if (settled.status !== 'complete') return failed(settled.status, settled.diagnostic)
  try {
    const result = parseResult(settled.value, request.source)
    if (result.profileId !== request.profileId) return failed('error', `the ${request.profileId} oracle answered as ${result.profileId}`)
    return result
  } catch (error) {
    return failed('error', `the ${request.profileId} oracle returned an invalid result: ${messageOf(error)}`)
  }
}

export type ConformanceOutcome = { readonly status: 'complete'; readonly answer: ConformanceAnswer } | Failure

export async function runConformance(request: ConformanceRequest, deadlineMs = DEFAULT_DEADLINE_MS): Promise<ConformanceOutcome> {
  const settled = await inWorker(request, deadlineMs)
  if (settled.status !== 'complete') return settled
  const answer = settled.value as ConformanceAnswer
  const source = loadCase(request).lines.map((line) => line.line).join('\n')
  const invalid = (reason: string): Failure => ({ status: 'error', diagnostic: `the ${request.profileId} conformance oracle returned ${reason}` })
  try {
    const result = parseResult(answer.result, source)
    if (result.status !== 'complete' || !Array.isArray(answer.lines)) return invalid('no complete result')
    return { status: 'complete', answer: { lines: answer.lines, result } }
  } catch (error) {
    return invalid(`an invalid result: ${messageOf(error)}`)
  }
}

/** Maps `items` through `run` in input order; the process-wide gate bounds how many workers run. */
export function runAll<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  return Promise.all(items.map(run))
}
