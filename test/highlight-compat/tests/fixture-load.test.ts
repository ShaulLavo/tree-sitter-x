import { expect, it } from 'vitest'
import { fixtures } from '../src/fixtures/registry.ts'
import { loadFixture } from '../src/fixtures/load.ts'

it('loads all local sources and preserves diagnostic family, grammar, and capture identity', () => {
  const loaded = fixtures.map(fixture => loadFixture(fixture))
  expect(loaded).toHaveLength(16)
  expect(loaded.every(fixture => fixture.source.length > 0)).toBe(true)
  expect(loaded.flatMap(fixture => fixture.textmate).reduce((count, set) => count + set.expectations.length, 0)).toBe(2148)
  expect(loaded.flatMap(fixture => fixture.captures)).toHaveLength(55)
  expect(loaded.flatMap(fixture => fixture.unconvertedArtifacts)).toHaveLength(2)
  for (const fixture of loaded) {
    if (fixture.fixture.family === 'tree-sitter-highlight') expect(fixture.textmate).toEqual([])
    for (const set of fixture.textmate) {
      expect(set.grammar.length).toBeGreaterThan(0)
      expect(set.artifact.provenance[0].grammar.generatedAgainstRevision).toBeNull()
      expect(set.expectations.every(expectation => expectation.fixtureId === fixture.fixture.id)).toBe(true)
    }
  }
})
