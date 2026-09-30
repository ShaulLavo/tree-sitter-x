import { Worker } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

// The real comparison peaks near 20 MB of old space. A per-unit array over 5,000,000 units adds
// about 40 MB, so the worker trips this limit; Node grants a 16 MB allowance to terminate cleanly.
const HEAP_LIMITS = { maxOldGenerationSizeMb: 48, maxYoungGenerationSizeMb: 8 }

interface WorkerOutcome {
  readonly messages: readonly unknown[]
  readonly exitCode: number
}

function runWorker(): Promise<WorkerOutcome> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./support/memory-worker.ts', import.meta.url), { resourceLimits: HEAP_LIMITS })
    const messages: unknown[] = []
    worker.on('message', (message: unknown) => messages.push(message))
    worker.on('error', reject)
    worker.on('exit', (exitCode) => resolve({ messages, exitCode }))
  })
}

describe('compareResults memory', () => {
  it('compares a 5,000,000-unit document within a heap far smaller than per-unit storage', { timeout: 60_000 }, async () => {
    const outcome = await runWorker()
    expect(outcome).toEqual({
      exitCode: 0,
      messages: [
        {
          sourceLength: 5_000_000,
          spans: [40_000, 25_000],
          scopes: {
            all: { matching: 4_998_800, comparable: 5_000_000, ratio: 4_998_800 / 5_000_000 },
            nonWhitespace: { matching: 2_749_340, comparable: 2_750_000, ratio: 2_749_340 / 2_750_000 },
            mismatches: [5, 1200, 400],
          },
          dark: {
            all: { matching: 4_999_600, comparable: 5_000_000, ratio: 4_999_600 / 5_000_000 },
            mismatches: [1, 400, 400],
            foreground: { units: 400, nonWhitespaceUnits: 220 },
          },
        },
      ],
    })
  })
})
