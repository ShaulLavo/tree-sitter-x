import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { fixtureArtifacts, fixtures } from '../src/fixtures/registry.ts'
import { buildRegistry, registrySource, selectedArtifacts } from '../src/fixtures/generate.ts'
import { harnessRoot, readManifest } from '../src/fixtures/manifest.ts'
import { loadFixture } from '../src/fixtures/load.ts'
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
  expect(crossRegistry.artifacts.find(artifact => artifact.provenance[0].manifestFileId === linked.id)!.associations[0].sourceFixtureId).toBe(canonical.id)
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

it('preserves identical snapshot associations for distinct exact source hashes', () => {
  const sourceSet = manifest.sources.find(source => source.id === 'vscode-colorize-fixtures')!
  const resultSet = manifest.sources.find(source => source.id === 'vscode-colorize-results')!
  const sourceTemplate = selectedArtifacts(manifest).find(({ source }) => source.id === sourceSet.id)!.file
  const resultTemplate = selectedArtifacts(manifest).find(({ source }) => source.id === resultSet.id)!.file
  const first = { ...sourceTemplate, id: 'review:x', path: 'review-x.js', sha256: hash('x') }
  const second = { ...sourceTemplate, id: 'review:newline-x', path: 'review-newline-x.js', sha256: hash('\nx') }
  const json = JSON.stringify([{ c: 'x', t: 'source.js' }])
  const one = { ...resultTemplate, id: 'review:one', path: 'review-one.json', sha256: hash(json), sourceFileId: first.id }
  const two = { ...one, id: 'review:two', path: 'review-two.json', sourceFileId: second.id }
  const augmented = {
    ...manifest, files: [...manifest.files, first, second, one, two],
    sources: manifest.sources.map(source => {
      if (source.id === sourceSet.id) return { ...source, fileIds: [...source.fileIds, first.id, second.id] }
      if (source.id === resultSet.id) return { ...source, fileIds: [...source.fileIds, one.id, two.id] }
      return source
    }),
  }
  const registry = buildRegistry(augmented)
  const snapshot = registry.artifacts.find(artifact => artifact.sha256 === hash(json))!
  expect(snapshot.provenance).toHaveLength(2)
  expect(snapshot.associations.map(association => association.sourceFixtureId).sort()).toEqual([
    `vscode-colorize/${first.path}`, `vscode-colorize/${second.path}`,
  ].sort())
  const extra = new Map([
    [`fixtures/vscode-colorize/${first.path}`, 'x'], [`fixtures/vscode-colorize/${second.path}`, '\nx'],
    [`fixtures/vscode-colorize/${one.path}`, json], [`fixtures/vscode-colorize/${two.path}`, json],
  ])
  const report = fixtureReport(augmented, path => extra.get(path) ?? readFileSync(new URL(path, harnessRoot), 'utf8'))
  expect(report).toContain('| vscode-colorize | 547 | 0 |')
  expect(report).toContain('The manifest selects 34 primary artifacts.')
})

it('loads deduplicated diagnostics for every distinct source association', () => {
  const directory = mkdtempSync(new URL('../../.fixture-test-', harnessRoot).pathname)
  try {
    const json = JSON.stringify([{ c: 'x', t: 'source.js' }])
    const selected = fixtureArtifacts.find(artifact => artifact.format === 'vscode-colorize')!
    const makeFixture = (source: string, name: string) => ({
      ...fixtures.find(fixture => fixture.family === 'vscode-colorize')!,
      id: name, path: join(directory, name + '.js'), sha256: hash(source),
    })
    const first = makeFixture('x', 'first'), second = makeFixture('\nx', 'second')
    writeFileSync(first.path, 'x')
    writeFileSync(second.path, '\nx')
    const path = join(directory, 'snapshot.json')
    writeFileSync(path, json)
    const associations = [first, second].map(fixture => ({
      sourceFixtureId: fixture.id, format: 'vscode-colorize' as const, provenance: selected.provenance[0],
    }))
    const artifact = { ...selected, path, sha256: hash(json), associations }
    const loaded = [first, second].map(fixture => loadFixture(fixture, [artifact]))
    expect(loaded.map(fixture => fixture.textmate[0].expectations.map(({ from, to }) => [from, to]))).toEqual([[[0, 1]], [[1, 2]]])
    expect(loaded.map(fixture => fixture.textmate[0].association.sourceFixtureId)).toEqual(['first', 'second'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('derives report accounting when a source/baseline selection is removed', () => {
  const pair = ['typescript-tmlanguage:tests/cases/autoAccessor.ts', 'typescript-tmlanguage:tests/baselines/autoAccessor.baseline.txt']
  const changed = { ...manifest, sources: manifest.sources.map(source => ({ ...source, fileIds: source.fileIds.filter(id => !pair.includes(id)) })) }
  const report = fixtureReport(changed)
  expect(report).toContain('15 runnable source fixtures; 25 vendored primary artifacts')
  expect(report).toContain('The 25 artifacts comprise 15 source inputs and 10 stored expectations.')
})
