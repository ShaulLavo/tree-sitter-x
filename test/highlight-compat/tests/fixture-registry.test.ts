import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { fixtureArtifacts, fixtures } from '../src/fixtures/registry.ts'
import { buildRegistry, registrySource, selectedArtifacts } from '../src/fixtures/generate.ts'
import { harnessRoot, readManifest } from '../src/fixtures/manifest.ts'
import { fixtureReport } from '../src/fixtures/report.ts'

const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex')
const manifest = readManifest()

it('regenerates the committed registry byte-identically and rejects uncleared selections', () => {
  expect(registrySource(manifest)).toBe(readFileSync(new URL('src/fixtures/registry.ts', harnessRoot), 'utf8'))
  const selected = selectedArtifacts(manifest)
  const id = selected[0].file.id
  const unreviewed = { ...manifest, files: manifest.files.map(file => file.id === id ? { ...file, provenance: { category: 'own', licenseStatus: 'not-cleared', licenseRefs: ['catalog-mit'] } } : file) }
  expect(() => buildRegistry(unreviewed)).toThrow(/vendorable/)
  const unlicensed = { ...manifest, files: manifest.files.map(file => file.id === id ? { ...file, provenance: { ...file.provenance!, licenseRefs: [] } } : file) }
  expect(() => buildRegistry(unlicensed)).toThrow(/vendorable/)
  const unknownLicense = { ...manifest, files: manifest.files.map(file => file.id === id ? { ...file, provenance: { ...file.provenance!, licenseRefs: ['unknown'] } } : file) }
  expect(() => buildRegistry(unknownLicense)).toThrow(/license/)
})

it('rehashes every selected artifact and rejects every unregistered file', () => {
  const selected = selectedArtifacts(manifest)
  expect(selected).toHaveLength(27)
  expect(readFileSync(new URL('../../.gitattributes', harnessRoot), 'utf8')).toContain('/test/highlight-compat/fixtures/** -text')
  const allowed = new Set<string>()
  for (const artifact of fixtureArtifacts) {
    allowed.add(artifact.path)
    const bytes = readFileSync(new URL(artifact.path, harnessRoot))
    expect(hash(bytes), artifact.path).toBe(artifact.sha256)
    for (const origin of artifact.provenance) {
      const recorded = selected.find(({ file }) => file.id === origin.manifestFileId)!
      expect(recorded.file.sha256).toBe(hash(bytes))
      expect(recorded.file.bytes).toBe(bytes.byteLength)
      expect(origin.revision).toBe(recorded.file.revision)
      expect(origin.upstreamPath).toBe(recorded.file.path)
    }
  }
  for (const family of new Set(fixtureArtifacts.map(artifact => artifact.family))) {
    allowed.add(`fixtures/${family}/NOTICE`)
    const files = readdirSync(new URL(`fixtures/${family}/`, harnessRoot), { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name))
    const root = new URL('./', harnessRoot).pathname
    for (const file of files) expect(allowed.has(file.slice(root.length)), file).toBe(true)
  }
  const actualFamilies = readdirSync(new URL('fixtures/', harnessRoot))
  expect(actualFamilies.filter(family => family !== 'original').sort()).toEqual([...new Set(fixtureArtifacts.map(artifact => artifact.family))].sort())
  expect(new Set(fixtureArtifacts.flatMap(artifact => artifact.provenance.map(origin => origin.manifestFileId))).size).toBe(27)
})

it('includes complete, hash-verified license notices and per-file attribution', () => {
  for (const family of new Set(fixtureArtifacts.map(artifact => artifact.family))) {
    const notice = readFileSync(new URL(`fixtures/${family}/NOTICE`, harnessRoot), 'utf8')
    const selected = fixtureArtifacts.filter(artifact => artifact.family === family)
    for (const artifact of selected) {
      expect(notice).toContain(artifact.sha256)
      expect(notice).toContain(artifact.provenance[0].upstreamPath)
      expect(notice).toContain(artifact.provenance[0].revision)
    }
    const refs = new Set(selected.flatMap(artifact => artifact.provenance.flatMap(origin => origin.licenses)))
    for (const ref of refs) {
      const license = manifest.licenses.find(license => license.id === ref)!
      const file = manifest.files.find(file => file.id === license.fileId)!
      const marker = `===== ${ref} (${license.spdx}), ${file.repository}:${file.path}@${file.revision} =====\n`
      const contents = notice.slice(notice.indexOf(marker) + marker.length).split('\n===== ')[0]
      expect(hash(contents.slice(0, -1))).toBe(file.sha256)
    }
  }
})

it('uses stable path-safe IDs, deduplicates hashes, and keeps evaluation disjoint', () => {
  expect(fixtures).toHaveLength(16)
  expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(fixtures.length)
  expect(new Set(fixtures.map(fixture => fixture.sha256)).size).toBe(fixtures.length)
  for (const fixture of fixtures) {
    expect(fixture.id).toMatch(/^[A-Za-z0-9._/-]+$/)
    expect(fixture.id.split('/')).not.toContain('..')
    expect(fixture.provenance.length).toBeGreaterThan(0)
  }
  const development = new Set(fixtures.filter(fixture => fixture.split === 'development').map(fixture => fixture.sha256))
  for (const fixture of fixtures.filter(fixture => fixture.split === 'evaluation')) expect(development.has(fixture.sha256)).toBe(false)
  const selected = selectedArtifacts(manifest)[0]
  const duplicate = { ...selected.file, id: selected.file.id + '-duplicate', path: 'samples/duplicate.sample' }
  const augmented = {
    ...manifest, files: [...manifest.files, duplicate],
    sources: manifest.sources.map(source => source.id === selected.source.id ? { ...source, fileIds: [...source.fileIds, duplicate.id] } : source),
  }
  const deduplicated = buildRegistry(augmented)
  expect(deduplicated.fixtures).toHaveLength(16)
  expect(deduplicated.fixtures.find(fixture => fixture.sha256 === duplicate.sha256)!.provenance).toHaveLength(2)

  const otherSource = manifest.sources.find(source => source.id === 'vscode-colorize-fixtures')!
  const expectationSource = manifest.sources.find(source => source.id === 'vscode-colorize-results')!
  const crossDuplicate = { ...duplicate, id: 'vscode:duplicate', path: 'duplicate.js' }
  const template = selectedArtifacts(manifest).find(({ source }) => source.id === expectationSource.id)!.file
  const linked = { ...template, id: 'vscode:linked-expectation', path: 'linked.json', sha256: '0'.repeat(64), sourceFileId: crossDuplicate.id }
  const crossFamily = {
    ...manifest, files: [...manifest.files, crossDuplicate, linked],
    sources: manifest.sources.map(source => {
      if (source.id === otherSource.id) return { ...source, fileIds: [...source.fileIds, crossDuplicate.id] }
      if (source.id === expectationSource.id) return { ...source, fileIds: [...source.fileIds, linked.id] }
      return source
    }),
  }
  const crossRegistry = buildRegistry(crossFamily)
  const canonical = crossRegistry.fixtures.find(fixture => fixture.sha256 === duplicate.sha256)!
  expect(crossRegistry.fixtures).toHaveLength(16)
  expect(canonical.provenance).toHaveLength(2)
  expect(crossRegistry.artifacts.find(artifact => artifact.provenance[0].manifestFileId === linked.id)!.sourceFixtureId).toBe(canonical.id)
})

it('keeps historical generations unstamped and inspected/product grammar identities separate', () => {
  for (const artifact of fixtureArtifacts.filter(artifact => artifact.format === 'vscode-colorize' || artifact.format === 'typescript-baseline')) {
    const grammar = artifact.provenance[0].grammar
    expect(grammar.generatedAgainstRevision).toBeNull()
    expect(grammar.inspectedCheckoutRevision).toMatch(/^[0-9a-f]{40}$/)
    expect(grammar.inspectedGrammarSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(grammar.productRevision).toBe(manifest.product.revision)
    expect(grammar.productGrammarSha256).toMatch(/^[0-9a-f]{64}$/)
  }
})

it('regenerates the committed deterministic coverage report with all excluded rows', () => {
  const report = fixtureReport(manifest)
  expect(report).toBe(readFileSync(new URL('reports/fixtures.md', harnessRoot), 'utf8'))
  expect(report).toContain('242 catalog languages; 16 runnable source fixtures; 27 vendored primary artifacts')
  expect(report).toContain('1475 skipped primary artifacts')
})
