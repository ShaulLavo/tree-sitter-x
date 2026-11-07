import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readJsJsxSplit, materializeJsJsxRows } from '../src/fixtures/js-jsx-wave.ts'
import { harnessRoot } from '../src/fixtures/manifest.ts'

const read = (path: string): Uint8Array => {
  if (path.includes('/evaluation/') || /evidence\/(commits|histories)\//.test(path) || /evidence\/(tc39|preactjs|acornjs)--/.test(path)) throw new Error('Evaluator payload read')
  return readFileSync(new URL(path, harnessRoot))
}
describe('split-first wave intake', () => {
  it('validates controls and 105/6825 DEV declarations without any evaluator payload read', () => {
    const intake = readJsJsxSplit('development', read)
    expect(intake.inputs).toHaveLength(21)
    expect(intake.validation).toEqual({ selected: 'development', deferred: 'evaluation' })
    const rows = materializeJsJsxRows(intake)
    expect(rows.scopeRows).toHaveLength(105)
    expect(rows.themeRows).toHaveLength(6825)
    expect(new Set(rows.themeRows.map(row => row.key)).size).toBe(6825)
  })
  it('rejects changed selected source bytes', () => {
    expect(() => readJsJsxSplit('development', path => path.endsWith('/ordinary.js') ? new TextEncoder().encode('bad') : read(path))).toThrow(/Changed/)
  })
  it('rejects a corrupt selection before any source access', () => {
    expect(() => readJsJsxSplit('development', path => path.endsWith('selection-lock.json') ? new Uint8Array() : read(path))).toThrow(/selection/)
  })
})
it('preserves all fixed scope declarations without reading any evaluator payload', () => {
  const data = JSON.parse(new TextDecoder().decode(read('manifest/waves/010-js-jsx-root.json')))
  const inputs = data.existingDevelopment.concat(data.fixtures).map((row: { id: string; languageId: 'javascript' | 'jsx'; split: 'development' | 'evaluation'; path: string; sha256: string; utf16Units: number }) => ({ ...row, storage: 'wave-packet' as const, derivationFamilies: [] }))
  const dev = readJsJsxSplit('development', read)
  const rows = materializeJsJsxRows({ ...dev, inputs })
  expect(rows.scopeRows.filter(row => row.split === 'evaluation')).toHaveLength(20)
  expect(rows.themeRows.filter(row => row.split === 'evaluation')).toHaveLength(1300)
  expect(rows.scopeRows.reduce((sum, row) => sum + row.utf16Units, 0)).toBe(667550)
  expect(rows.themeRows.reduce((sum, row) => sum + row.utf16Units, 0)).toBe(43390750)
})
it('rejects changed global declaration counts before selected source reads', () => {
  expect(() => readJsJsxSplit('development', path => {
    if (path !== 'manifest/waves/010-js-jsx-root.json') return read(path)
    const wave = JSON.parse(new TextDecoder().decode(read(path)))
    wave.rowsContract.count--
    return new TextEncoder().encode(JSON.stringify(wave))
  })).toThrow(/denominator/)
})
