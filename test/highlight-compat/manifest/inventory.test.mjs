import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, join } from 'node:path'
import { decodeGrammarModule } from './extract-product-profile.mjs'
import { test } from 'vitest'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'))
const profile = read('product-profile.json')
const assets = read('assets.json')
const structural = read('tree-sitter-languages.json')
const fixtures = read('fixture-sources.json')
const document = readFileSync(join(here, '../../../docs/plans/textmate-scope-compatibility-inventory.md'), 'utf8')
const section = (start, end) => document.slice(document.indexOf(start), document.indexOf(end))
const sha256 = /^[a-f0-9]{64}$/

function hasRow(text, id) {
  return text.split('\n').filter((line) => line.startsWith(`| \`${id}\` |`)).length === 1
}

test('all manifests name the same product commit', () => {
  const commit = profile.platform.commit
  assert.equal(assets.platformCommit, commit)
  assert.equal(structural.platformCommit, commit)
  assert.equal(fixtures.repositories.find((repository) => repository.id === 'platform').revision, commit)
  assert.ok(document.includes(commit))
})

test('every public language, dependency registration and selectable theme has one documented status', () => {
  const catalog = section('| Language | Catalog aliases', '### Dependency-only registrations')
  const dependencies = section('### Dependency-only registrations', '### Complete theme inventory')
  const themes = section('### Complete theme inventory', '## Structural parser inventory')
  for (const entry of profile.languages.catalog.entries) assert.ok(hasRow(catalog, entry.id), entry.id)
  for (const entry of profile.languages.registrations.filter((entry) => !entry.public)) {
    assert.ok(hasRow(dependencies, entry.name), entry.name)
  }
  for (const theme of [...profile.themes.vscode, ...profile.themes.native]) {
    assert.ok(hasRow(themes, theme.id), theme.id)
  }
  const statuses = catalog.split('\n').filter((line) => line.endsWith('| loadable; scope pack unimplemented |'))
  assert.equal(statuses.length, profile.languages.catalog.entries.length)
})

test('structural languages cross-reference real product ids and carry resolved parser/query identities', () => {
  const ids = new Set(profile.languages.catalog.entries.map((entry) => entry.id))
  assert.equal(structural.counts.catalogLanguages, structural.languages.length)
  for (const language of structural.languages) {
    assert.equal(language.textMate.sameLanguageId, ids.has(language.id), language.id)
    assert.equal(language.textMate.status, 'available-same-id')
    assert.equal(language.scopePackStatus, 'unimplemented')
    assert.ok(language.source.repository)
    assert.match(language.source.revision, /^[a-f0-9]{40}$/)
    assert.equal(language.wasm.status, 'resolved')
    assert.match(language.wasm.sha256, sha256)
    assert.equal(language.wasm.sha256, language.wasm.lockedSha256)
    for (const query of Object.values(language.queries)) {
      for (const file of query.files) {
        assert.equal(file.status, 'resolved')
        assert.match(file.sha256, sha256)
        assert.equal(file.sha256, file.lockedSha256)
      }
    }
  }
  assert.match(structural.markdown.resolver.sha256, sha256)
  assert.match(structural.runtime.wasm.sha256, sha256)
})

test('fixture sets pin repositories, licenses and all file references', () => {
  const repositories = new Map(fixtures.repositories.map((repository) => [repository.id, repository]))
  const licenses = new Set(fixtures.licenses.map((license) => license.id))
  const files = new Map(fixtures.files.map((file) => [file.id, file]))
  assert.equal(files.size, fixtures.files.length)
  for (const file of files.values()) {
    assert.equal(file.revision, repositories.get(file.repository)?.revision, file.id)
    assert.match(file.sha256, sha256, file.id)
  }
  for (const source of fixtures.sources) {
    assert.equal(source.revision, repositories.get(source.repository)?.revision, source.id)
    assert.match(source.revision, /^[a-f0-9]{40}$/)
    assert.ok(source.licenseRefs.length)
    for (const license of source.licenseRefs) assert.ok(licenses.has(license), license)
    for (const id of [...source.fileIds, ...(source.dependencyFileIds ?? [])]) assert.ok(files.has(id), id)
    assert.equal(source.counts.inventoryFiles, source.fileIds.length)
    assert.equal(source.counts.selectedCandidateFiles + source.counts.skippedFiles, source.fileIds.length)
  }
  assert.equal(fixtures.counts.sourceSets, fixtures.sources.length)
  assert.equal(fixtures.counts.hashedFilesIncludingMetadataAndGrammarComparisons, files.size)
})

function sortedJson(value) {
  if (Array.isArray(value)) return value.map(sortedJson)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]))
}

test('grammar comparison modules define the recorded scope and reproduce core hashes', () => {
  const files = new Map(fixtures.files.map((file) => [file.id, file]))
  const expectations = new Map(fixtures.grammarExpectations.map((entry) => [entry.id, entry]))
  const root = process.env.PLATFORM_ROOT ?? '/work/projects/platform'
  for (const expectation of expectations.values()) {
    if (!expectation.coreComparison?.productSha256) continue
    const defining = expectation.productModuleFileId ? expectation : expectations.get(expectation.productGrammarExpectationId)
    assert.ok(defining?.productModuleFileId, expectation.id)
    const file = files.get(defining.productModuleFileId)
    assert.ok(file, expectation.id)
    const bytes = readFileSync(join(root, file.path))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, expectation.id)
    const { grammar } = decodeGrammarModule(bytes.toString('utf8'), file.path)
    assert.equal(grammar.name, basename(file.path, '.mjs'), expectation.id)
    assert.equal(grammar.scopeName, defining.scopeName, expectation.id)
    const core = Object.fromEntries(expectation.coreComparison.keys.map((key) => [key, grammar[key]]))
    const hash = createHash('sha256').update(JSON.stringify(sortedJson(core))).digest('hex')
    assert.equal(hash, expectation.coreComparison.productSha256, expectation.id)
  }
})

test('selected fixture files have explicit permission evidence and excluded dependencies exclude their cases', () => {
  const selected = fixtures.files.filter((file) => file.selectedCandidate)
  const files = new Map(fixtures.files.map((file) => [file.id, file]))
  for (const file of selected) {
    const reviewed = file.sourceFileId ? files.get(file.sourceFileId) : file
    assert.equal(file.decision, 'fetch-by-hash', file.id)
    assert.ok(file.provenance?.licenseRefs?.length, file.id)
    assert.ok(reviewed?.review?.method, file.id)
    assert.equal(reviewed?.decision, 'fetch-by-hash', file.id)
  }
  assert.equal(selected.length, fixtures.counts.selectedCandidateFilesIncludingDependencies)
  const sql = files.get('vscode-textmate:test-cases/first-mate/fixtures/sql.json')
  assert.equal(sql.decision, 'skip')
  assert.equal(Boolean(sql.selectedCandidate), false)
  for (const source of fixtures.sources) {
    for (const candidate of source.caseInventory ?? []) {
      const blocked = candidate.dependencyFileIds.filter((id) => files.get(id)?.decision === 'skip')
      assert.deepEqual(candidate.blockedDependencyFileIds, blocked)
      assert.equal(candidate.decision, blocked.length ? 'skip' : 'fetch-by-hash')
    }
  }
  assert.equal(
    fixtures.counts.oracleSuiteSelectedCaseCandidates + fixtures.counts.oracleSuiteSkippedCases,
    fixtures.counts.oracleSuiteCases,
  )
  assert.equal(fixtures.counts.vendoredFiles, 0)
})
