import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// The worker heap limit in memory.test.ts cannot see off-heap typed arrays. This is a source
// convention for these two modules, not a proof: helpers they import are outside its reach.
const STREAMING_MODULES = ['../src/compare.ts', '../src/sweep.ts']
const PER_UNIT_STORAGE = [
  /\bArray\s*\(/,
  /\bArray\.from\b/,
  /\.fill\s*\(/,
  /\b(?:Uint8|Uint8Clamped|Int8|Uint16|Int16|Uint32|Int32|Float32|Float64|BigInt64|BigUint64)Array\b/,
  /\b(?:ArrayBuffer|SharedArrayBuffer|Buffer)\b/,
  /\.(?:split|repeat|slice|substring|substr)\s*\(/,
  /\[\.\.\.\s*source\b/,
]

describe('streaming comparison modules', () => {
  it.each(STREAMING_MODULES)('%s allocates nothing proportional to source length', (path) => {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8')
    const found = PER_UNIT_STORAGE.filter((pattern) => pattern.test(text)).map(String)
    expect(found).toEqual([])
  })
})
