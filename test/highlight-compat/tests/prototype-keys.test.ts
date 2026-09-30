import { describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { compareResults } from '../src/compare.ts'
import { describeDifference } from '../src/golden.ts'
import { parseResultText, serializeResult } from '../src/serialize.ts'

const PROTOTYPE_NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty']

function themed(themeIds: readonly string[]) {
  const builder = new ResultBuilder(
    { profileId: 'product', languageId: 'typescript', engine: Object.fromEntries([['__proto__', 'engine value']]) },
    'abc',
  ).scope(0, 3, ['source.ts'])
  for (const themeId of themeIds) builder.style(themeId, 0, 3, { foreground: '#000000' })
  return builder.complete()
}

describe('theme and engine keys named like Object.prototype members', () => {
  it('survive building, serialization and parsing as own entries', () => {
    const result = themed(PROTOTYPE_NAMES)
    expect(Object.keys(result.styles ?? {}).sort()).toEqual([...PROTOTYPE_NAMES].sort())
    expect(Object.keys(result.engine)).toEqual(['__proto__'])
    expect(parseResultText(serializeResult(result))).toEqual(result)
  })

  it('are compared as tracks when present and reported missing when absent', () => {
    const result = themed(PROTOTYPE_NAMES)
    const comparison = compareResults(result, result)
    if (!comparison.comparable) throw new Error(comparison.reason)
    for (const themeId of PROTOTYPE_NAMES) {
      const outcome = Object.hasOwn(comparison.styles, themeId) ? comparison.styles[themeId] : undefined
      expect(outcome?.compared).toBe(true)
    }
    const plain = themed(['dark'])
    for (const themeId of PROTOTYPE_NAMES) {
      const missing = compareResults(plain, plain, { themeId })
      if (!missing.comparable) throw new Error(missing.reason)
      expect(Object.hasOwn(missing.styles, themeId)).toBe(true)
      expect(missing.styles[themeId]).toEqual({ compared: false, reason: `theme ${themeId} missing on reference and candidate` })
    }
  })

  it('are named when one golden side lacks them', () => {
    for (const themeId of PROTOTYPE_NAMES) {
      expect(describeDifference(themed(['dark', themeId]), themed(['dark']))).toEqual([`styles: theme ${JSON.stringify(themeId)} in expected only`])
      expect(describeDifference(themed(['dark']), themed(['dark', themeId]))).toEqual([`styles: theme ${JSON.stringify(themeId)} in actual only`])
    }
  })
})
