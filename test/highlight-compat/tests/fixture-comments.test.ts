import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { commentMetadata } from '../src/fixtures/comment-nodes.ts'
import { commentMetadataSource, fixtureComments } from '../src/fixtures/comments.ts'
import { fixtures } from '../src/fixtures/registry.ts'
import { harnessRoot } from '../src/fixtures/manifest.ts'

it('regenerates comment metadata from parser nodes without a CLI or network', () => {
  expect(commentMetadataSource(commentMetadata)).toBe(readFileSync(new URL('src/fixtures/comment-nodes.ts', harnessRoot), 'utf8'))
  expect(commentMetadata.grammarRevision).toBe('44c892e0be055ac465d5eeddae6d3e194424e7de')
  expect(commentMetadata.parserSourceSha256).toBe('67209ca7ef6e1a4f74e29e48b5928455f892fe1821a3960fbcd62f4e972f7384')
  expect(commentMetadata.cliVersion).toBe('tree-sitter 0.26.9')
  expect(commentMetadata.entries.flatMap(entry => entry.comments)).toHaveLength(55)
})

it('fails when any selected source no longer matches its parser-node entry', () => {
  for (const fixture of fixtures.filter(fixture => fixture.family === 'tree-sitter-highlight')) {
    const source = readFileSync(new URL(fixture.path, harnessRoot), 'utf8')
    expect(fixtureComments(fixture, source).length).toBeGreaterThan(0)
    expect(() => fixtureComments(fixture, source + ' ')).toThrow(/hash/)
    expect(() => fixtureComments({ ...fixture, sha256: '0'.repeat(64) }, source)).toThrow(/hash/)
    const entries = commentMetadata.entries.map(entry => entry.sourceSha256 === fixture.sha256 ? { ...entry, sourceSha256: '0'.repeat(64) } : entry)
    expect(() => fixtureComments(fixture, source, { ...commentMetadata, entries })).toThrow(/hash/)
  }
})

it('rejects wrong parser identity, missing/extra sources, and malformed parser ranges', () => {
  expect(() => commentMetadataSource({ ...commentMetadata, grammarRevision: '0'.repeat(40) })).toThrow(/identity/)
  expect(() => commentMetadataSource({ ...commentMetadata, parserSourceSha256: '0'.repeat(64) })).toThrow(/identity/)
  expect(() => commentMetadataSource({ ...commentMetadata, entries: commentMetadata.entries.slice(1) })).toThrow(/every/)
  expect(() => commentMetadataSource({ ...commentMetadata, entries: [...commentMetadata.entries, commentMetadata.entries[0]] })).toThrow(/every/)
  const entries = commentMetadata.entries.map((entry, i) => i === 0 ? { ...entry, comments: [{ from: entry.comments[0].from, to: 1e6 }] } : entry)
  expect(() => commentMetadataSource({ ...commentMetadata, entries })).toThrow(/offsets/)
})
