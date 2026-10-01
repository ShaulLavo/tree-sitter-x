import { expect, inject, it } from 'vitest'
import { compareResults } from '../src/compare.ts'
import { corpusInputs, readReference } from '../src/corpus.ts'
import { paintScopes } from '../src/baselines/theme.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    referenceRoot: string | undefined
  }
}

const referenceRoot = inject('referenceRoot')

for (const reference of ['raw', 'product'] as const) {
  it(`${reference} scopes reproduce direct reference styles with the pinned matcher`, async () => {
    for (const input of corpusInputs()) {
      const result = readReference(input, reference, referenceRoot)
      expect(result.status).toBe('complete')
      if (result.status !== 'complete') continue
      const intervals = []
      for (let index = 0; index < result.spans.length; index += 3) {
        intervals.push({ from: result.spans[index] as number, to: result.spans[index + 1] as number, scopes: result.paths[result.spans[index + 2] as number]?.map(name => result.scopeNames[name] as string) ?? [] })
      }
      const repainted = await paintScopes('baseline:reference-scopes', input.languageId, input.source, intervals, reference, {})
      const comparison = compareResults(result, repainted, { source: input.source })
      expect(comparison.comparable).toBe(true)
      if (!comparison.comparable) continue
      const finalCr = reference === 'product' && input.source.endsWith('\r') ? 1 : 0
      for (const [theme, outcome] of Object.entries(comparison.styles)) {
        expect(outcome.compared).toBe(true)
        if (!outcome.compared) continue
        // The product strips a final lone CR. Its reference adapter paints that unit as a separator.
        expect(outcome.report.mismatches.units, `${input.fixtureId} ${theme}`).toBe(finalCr)
        expect(outcome.report.mismatches.runs.map(run => [run.from, run.to])).toEqual(
          finalCr === 0 ? [] : [[input.source.length - 1, input.source.length]],
        )
      }
    }
  })
}
