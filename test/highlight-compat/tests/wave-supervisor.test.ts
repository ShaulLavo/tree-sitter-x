import { expect, it } from 'vitest'
import { superviseWorker } from '../src/wave-collection.ts'
const url = new URL('./wave-supervisor-worker.ts', import.meta.url)
function validate(value: unknown): true {
  if (typeof value !== 'object' || value === null || !('ok' in value) || value.ok !== true) throw new Error('bad answer')
  return true
}
it.each(['success', 'throw', 'exit', 'never', 'duplicate', 'nonzero', 'hang', 'malformed'])('reaps bounded worker %s before returning', async mode => {
  const outcome = await superviseWorker({ url, data: mode, validate, deadlineMs: 500, exitGraceMs: 50 })
  expect(outcome.kind).toBe(mode === 'success' ? 'complete' : mode === 'never' ? 'timeout' : 'error')
  expect(outcome.reaped).toBe(true)
})
it('does not dispatch when already aborted', async () => {
  const signal = AbortSignal.abort()
  const result = await superviseWorker({ url, data: 'success', validate, signal })
  expect(result.kind).toBe('canceled')
  expect(result.dispatched).toBe(false)
})
it('terminates active workers on abort', async () => {
  const abort = new AbortController()
  const pending = superviseWorker({ url, data: 'never', validate, signal: abort.signal })
  abort.abort()
  expect((await pending).kind).toBe('canceled')
})
it('rejects a reply exceeding its transport budget and reaps it', async () => {
  const outcome = await superviseWorker({ url, data: 'success', validate, maxReplyBytes: 2 })
  expect(outcome.kind).toBe('error')
  expect(outcome.reaped).toBe(true)
})
