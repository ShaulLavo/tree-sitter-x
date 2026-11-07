import { parentPort, workerData } from 'node:worker_threads'
const mode: unknown = workerData
if (mode === 'throw') throw new Error('test worker')
if (mode === 'exit') process.exit(0)
if (mode === 'never') setInterval(() => {}, 1000)
else {
  parentPort?.postMessage(mode === 'malformed' ? {} : { ok: true })
  if (mode === 'duplicate') parentPort?.postMessage({ ok: true })
  if (mode === 'nonzero') process.exitCode = 9
  if (mode === 'hang') setInterval(() => {}, 1000)
  parentPort?.close()
}
