import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { checkExpectations } from '../src/expectations.ts'
import type { Expectation } from '../src/expectations.ts'

const origin = { family: 'synthetic', file: 'case', line: 1, column: 1 }
const expectation: Expectation = { fixtureId: 'case', from: 0, to: 3, scopes: ['source.ts', 'variable'], origin }

function result() {
  return new ResultBuilder({ profileId: 'native', languageId: 'typescript' }, 'abc')
    .scope(0, 1, ['source.ts', 'meta', 'variable'])
    .scope(1, 3, ['source.ts', 'variable']).complete()
}

describe('expectation checker', () => {
  it('requires an ordered subsequence over every intersecting result span', () => {
    const checks = checkExpectations(result(), [expectation])
    expect(checks[0].pass).toBe(true)
    expect(checks[0].expectedPath).toEqual(['source.ts', 'variable'])
    expect(checks[0].actualPaths).toEqual([
      { from: 0, to: 1, path: ['source.ts', 'meta', 'variable'] },
      { from: 1, to: 3, path: ['source.ts', 'variable'] },
    ])
    expect(checkExpectations(result(), [{ ...expectation, scopes: ['variable', 'source.ts'] }])[0].pass).toBe(false)
    expect(checkExpectations(result(), [{ ...expectation, scopes: ['variable', 'variable'] }])[0].pass).toBe(false)
  })

  it('checks missing scopes, negatives, and the whole range', () => {
    expect(checkExpectations(result(), [{ ...expectation, scopes: ['meta'] }])[0].pass).toBe(false)
    expect(checkExpectations(result(), [{ ...expectation, not: ['meta'] }])[0].pass).toBe(false)
    expect(checkExpectations(result(), [{ ...expectation, scopes: [], not: ['comment'] }])[0].pass).toBe(true)
  })

  it('rejects incomplete documents and invalid expectation ranges', () => {
    const incomplete = new ResultBuilder({ profileId: 'native', languageId: 'typescript' }, 'abc').incomplete('timeout', 'budget')
    expect(checkExpectations(incomplete, [expectation])[0].pass).toBe(false)
    expect(() => checkExpectations(incomplete, [])).toThrow(/complete/)
    for (const range of [{ from: -1, to: 1 }, { from: 0, to: 4 }, { from: 1, to: 1 }, { from: 0.5, to: 1 }]) {
      expect(() => checkExpectations(result(), [{ ...expectation, ...range }])).toThrow(/range/)
    }
  })
})
