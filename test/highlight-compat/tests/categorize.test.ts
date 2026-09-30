import { describe, expect, it } from 'vitest'

import { categorize, type MismatchCategory } from '../src/categorize.ts'

const cases: readonly (readonly [string, readonly string[], readonly string[], MismatchCategory])[] = [
  ['candidate drops an ancestor', ['source.ts', 'meta.block', 'string'], ['source.ts', 'string'], 'missing-scope'],
  ['candidate drops the leaf', ['source.ts', 'string'], ['source.ts'], 'missing-scope'],
  ['candidate is empty', ['source.ts'], [], 'missing-scope'],
  ['candidate adds an ancestor', ['source.ts', 'string'], ['source.ts', 'meta.block', 'string'], 'extra-scope'],
  ['candidate adds a leaf', ['source.ts'], ['source.ts', 'string'], 'extra-scope'],
  ['reference is empty', [], ['source.ts'], 'extra-scope'],
  ['same scopes swapped', ['source.ts', 'a', 'b'], ['source.ts', 'b', 'a'], 'reordered'],
  ['swap that moves the leaf', ['a', 'b'], ['b', 'a'], 'reordered'],
  ['swap above an equal leaf', ['a', 'b', 'c'], ['b', 'a', 'c'], 'reordered'],
  ['innermost scope differs', ['source.ts', 'string'], ['source.ts', 'comment'], 'leaf'],
  ['single scope differs', ['source.ts'], ['source.js'], 'leaf'],
  ['ancestor renamed above an equal leaf', ['source.ts', 'meta.a', 'string'], ['source.ts', 'meta.b', 'string'], 'ancestor'],
  ['ancestors of different depth share the leaf', ['a', 'b', 'string'], ['c', 'string'], 'ancestor'],
  ['different leaf and length', ['a', 'b'], ['c', 'd', 'e'], 'other'],
  ['same length, two positions differ', ['a', 'b', 'c'], ['a', 'x', 'y'], 'other'],
  ['duplicates with different multiplicity', ['a', 'a', 'b'], ['a', 'b', 'b'], 'ancestor'],
  ['duplicates moved', ['a', 'a', 'b'], ['a', 'b', 'a'], 'reordered'],
]

describe('categorize', () => {
  it.each(cases)('%s', (_name, reference, candidate, expected) => {
    expect(categorize(reference, candidate)).toBe(expected)
  })
})
