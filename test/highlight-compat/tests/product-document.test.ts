import { describe, expect, it } from 'vitest'
import { ORACLE_THEMES } from '../src/oracles/pins.ts'
import { runDocument } from '../src/oracles/run.ts'
import type { CompleteResult } from '../src/schema.ts'
import { themeTrack } from '../src/style.ts'

/** The scope path and every theme's style covering `offset`. */
function at(result: CompleteResult, offset: number) {
  const valueAt = (spans: readonly number[]): number => {
    for (let index = 0; index < spans.length; index += 3) {
      if ((spans[index] ?? 0) <= offset && offset < (spans[index + 1] ?? 0)) return spans[index + 2] ?? -1
    }
    return -1
  }
  const path = result.paths[valueAt(result.spans)]?.map((name) => result.scopeNames[name])
  const styles = ORACLE_THEMES.map((themeId) => {
    const track = themeTrack(result.styles, themeId)
    return track?.styles[valueAt(track.spans)]
  })
  return { path, styles }
}

describe.each(['product', 'product:warm'] as const)('%s with a final lone CR', (profileId) => {
  it.each([['\r'], ['let x = 1\r'], ['let a = 1\r\nlet b = 2\r']])('tiles %j and gives the dropped CR a terminator span', async (source) => {
    const result = await runDocument({ kind: 'document', profileId, languageId: 'typescript', source, themeIds: ORACLE_THEMES })
    expect(result.diagnostics).toEqual([])
    if (result.status !== 'complete') throw new Error(result.status)
    expect(at(result, source.length - 1)).toEqual({ path: [], styles: ORACLE_THEMES.map(() => ({})) })
    if (source.length > 1) expect(at(result, source.length - 2).path).toContain('constant.numeric.decimal.ts')
  })
})
