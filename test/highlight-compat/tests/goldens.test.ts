import { describe, expect, it } from 'vitest'
import { auditGoldens, GOLDEN_ROOT, unregisteredGoldenDirs } from '../src/golden.ts'
import { goldenProducers } from '../src/golden-producers.ts'
import { isReferenceProfile } from '../src/schema.ts'

describe('committed goldens', () => {
  it('has a registered reference producer for every profile directory', () => {
    expect(unregisteredGoldenDirs(GOLDEN_ROOT, goldenProducers)).toEqual([])
  })

  for (const [profileId, producer] of Object.entries(goldenProducers)) {
    if (producer === undefined || !isReferenceProfile(profileId)) continue
    // Each producer runs every original fixture in its own oracle worker; the bound is that work.
    it(`${profileId} goldens equal the producer's cases, one to one`, async () => {
      expect((await auditGoldens(GOLDEN_ROOT, profileId, producer)).join('\n')).toBe('')
    }, 120_000)
  }
})
