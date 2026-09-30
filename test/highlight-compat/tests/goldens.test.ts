import { describe, expect, it } from 'vitest'
import type { GoldenCase } from '../src/golden.ts'
import { checkGolden, GOLDEN_ROOT, unregisteredGoldenDirs } from '../src/golden.ts'
import { goldenProducers } from '../src/golden-producers.ts'

const cases: { readonly profileId: string; readonly golden: GoldenCase }[] = []
for (const [profileId, producer] of Object.entries(goldenProducers)) {
  for await (const golden of producer()) cases.push({ profileId, golden })
}

describe('committed goldens', () => {
  it('has a registered reference producer for every profile directory', () => {
    expect(unregisteredGoldenDirs(GOLDEN_ROOT, goldenProducers)).toEqual([])
  })

  for (const { profileId, golden } of cases) {
    it(`${profileId}/${golden.languageId}/${golden.fixtureId}`, () => {
      const check = checkGolden(GOLDEN_ROOT, golden)
      expect(check.ok ? '' : check.message).toBe('')
    })
  }
})
