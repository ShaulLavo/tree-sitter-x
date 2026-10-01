import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { goldenPath, updateGoldens } from '../src/golden.ts'
import type { OriginalFixture } from '../src/original-fixtures.ts'
import { sparseCases } from '../src/reference-results.ts'
import type { DocumentResult, ReferenceProfileId } from '../src/schema.ts'

const fixture: OriginalFixture = { languageId: 'typescript', fixtureId: 'a', path: 'a.ts', source: 'let x' }
const header = (profileId: ReferenceProfileId) => ({ profileId, languageId: 'typescript' })
const scoped = (profileId: ReferenceProfileId, scope: string): DocumentResult =>
  new ResultBuilder(header(profileId), fixture.source).scope(0, 5, ['source.ts', scope]).complete()
const timedOut = (profileId: ReferenceProfileId): DocumentResult =>
  new ResultBuilder(header(profileId), fixture.source).incomplete('timeout', 'no answer within the 1 ms process deadline')

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hc-sparse-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const update = (variants: DocumentResult[], bases: DocumentResult[]) =>
  updateGoldens(root, 'raw:shiki-fork', () => sparseCases([fixture], variants, bases))

describe('sparse goldens', () => {
  it('records a variant case only where its complete content differs from the base', async () => {
    expect((await update([scoped('raw:shiki-fork', 'a')], [scoped('raw', 'a')])).written).toEqual([])
    expect((await update([scoped('raw:shiki-fork', 'b')], [scoped('raw', 'a')])).written).toHaveLength(1)
  })

  describe.each([
    ['identical timeouts on both sides', () => [timedOut('raw:shiki-fork')], () => [timedOut('raw')]],
    ['a failed base with a complete variant', () => [scoped('raw:shiki-fork', 'b')], () => [timedOut('raw')]],
    ['a failed variant with a complete base', () => [timedOut('raw:shiki-fork')], () => [scoped('raw', 'a')]],
  ])('given %s', (_name, variants, bases) => {
    it('fails the update and leaves the prior golden tree intact', async () => {
      await update([scoped('raw:shiki-fork', 'b')], [scoped('raw', 'a')])
      const path = goldenPath(root, 'raw:shiki-fork', 'typescript', 'original/a')
      const before = readFileSync(path, 'utf8')
      await expect(update(variants(), bases())).rejects.toThrow('sparse goldens need complete results on both sides')
      expect(readFileSync(path, 'utf8')).toBe(before)
      expect(readdirSync(root)).toEqual(['raw+shiki-fork'])
    })
  })
})
