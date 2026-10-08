import { describe, expect, it } from 'vitest'
import { sweep } from '../src/sweep.ts'

function collect(a: readonly number[], b: readonly number[]) {
  const intervals: [number, number, number, number, boolean, boolean][] = []
  sweep(a, b, (from, to, aValue, bValue, aStarts, bStarts) => {
    intervals.push([from, to, aValue, bValue, aStarts, bStarts])
  })
  return intervals
}

describe('sweep', () => {
  it('visits the union of both tracks endpoints with the value of each side', () => {
    expect(collect([0, 4, 0, 4, 10, 1], [0, 2, 5, 2, 6, 6, 6, 10, 7])).toEqual([
      [0, 2, 0, 5, true, true],
      [2, 4, 0, 6, false, true],
      [4, 6, 1, 6, true, false],
      [6, 10, 1, 7, false, true],
    ])
  })

  it('visits once per shared endpoint, independent of span length', () => {
    const a = [0, 1_000_000, 0, 1_000_000, 5_000_000, 1]
    expect(collect(a, a)).toEqual([
      [0, 1_000_000, 0, 0, true, true],
      [1_000_000, 5_000_000, 1, 1, true, true],
    ])
  })

  it('visits nothing for empty tracks', () => {
    expect(collect([], [])).toEqual([])
  })
})
