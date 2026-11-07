import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { harnessRoot } from '../src/fixtures/manifest.ts'
import { originalFixtures } from '../src/original-fixtures.ts'
import { fixtures } from '../src/fixtures/registry.ts'
import { readJsJsxIntake, materializeJsJsxRows } from '../src/fixtures/js-jsx-wave.ts'

const prefix = 'fixtures/waves/010-js-jsx/'
const wavePath = 'manifest/waves/010-js-jsx-root.json'
const read = (path: string) => readFileSync(new URL(path, harnessRoot))
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

function corrupt(path: string, transform: (value: string) => string): void {
  expect(() => readJsJsxIntake(name => name === path ? Buffer.from(transform(read(name).toString('utf8'))) : read(name))).toThrow()
}

it('admits only the exact frozen source packet offline', () => {
  const intake = readJsJsxIntake()
  expect(intake.inputs).toHaveLength(25)
  expect(intake.inputs.filter(input => input.split === 'evaluation')).toHaveLength(4)
  expect(intake.inputs.filter(input => input.storage === 'existing-repository')).toHaveLength(7)
  expect(intake.selectionSha256).toBe('7ca8c0ca9fc2cc29445ecead260a906693fafe62c52a55c55f40f6103312d2bd')
})

it('materializes all theme rows before any result exists', () => {
  const rows = materializeJsJsxRows()
  expect(rows.themeRows).toHaveLength(8125)
  expect(rows.themeRows.filter(row => row.utf16Units === 0)).toHaveLength(650)
  expect(new Set(rows.themeRows.map(row => row.key)).size).toBe(8125)
})

it('deduplicates theme repetition without dropping full UTF-16 scope denominators', () => {
  const intake = readJsJsxIntake()
  const rows = materializeJsJsxRows(intake)
  expect(rows.scopeRows).toHaveLength(125)
  expect(rows.scopeRows.filter(row => row.utf16Units === 0)).toHaveLength(10)
  const perProfile = intake.inputs.reduce((total, input) => total + input.utf16Units, 0)
  expect(rows.scopeRows.reduce((total, row) => total + row.utf16Units, 0)).toBe(perProfile * 5)
  expect(rows.themeRows.reduce((total, row) => total + row.utf16Units, 0)).toBe(perProfile * 5 * 65)
  for (const input of intake.inputs) {
    expect(rows.scopeRows.filter(row => row.fixture === input.id).map(row => row.utf16Units)).toEqual(Array(5).fill(input.utf16Units))
  }
})

it('preserves the historical registry, original discovery, and every locked old file', () => {
  expect(fixtures).toHaveLength(16)
  expect(originalFixtures()).toHaveLength(28)
  const preserved: unknown = JSON.parse(read(prefix + 'evidence/preserved-repository-files.json').toString('utf8'))
  expect(preserved).toBeTypeOf('object')
  if (!preserved || typeof preserved !== 'object') throw new Error('missing preservation index')
  for (const [path, identity] of Object.entries(preserved)) {
    if (!identity || typeof identity !== 'object' || !('sha256' in identity) || !('bytes' in identity)) throw new Error('invalid identity')
    const bytes = read(path.replace(/^test\/highlight-compat\//, ''))
    expect(hash(bytes)).toBe(identity.sha256)
    expect(bytes.byteLength).toBe(identity.bytes)
  }
})

it.each([
  'missing source', 'duplicate source ID', 'family overlap', 'missing license', 'wrong source hash',
  'wrong source role', 'generated evaluation', 'implicit fence admission', 'invented scope truth',
  'missing reference availability', 'invented metadata availability', 'mandatory metadata removed',
  'missing metadata prerequisite', 'empty passing label', 'unsupported region passing label',
])('rejects frozen declaration corruption: %s', name => {
  const substitutions: Record<string, readonly [string, string]> = {
    'missing source': ['development/original/javascript/ordinary.js', 'development/absent.js'],
    'duplicate source ID': ['development/original/javascript/unsupported.js', 'development/original/javascript/ordinary.js'],
    'family overlap': ['caitlin-potter-test262', 'original-010'],
    'missing license': ['original-010-mit', 'missing-license'],
    'wrong source hash': ['3e74a57759a1f8ff923a695905c4a13c73905e9b7fe1c7bdf04dd796826614ae', '0'.repeat(64)],
    'wrong source role': ['source-input', 'stored-golden'],
    'generated evaluation': ['"generated": false', '"generated": true'],
    'implicit fence admission': ['"newLanguagesEnabled": false', '"newLanguagesEnabled": true'],
    'invented scope truth': ['"exactChildScopes": null', '"exactChildScopes": ["source.tsx"]'],
    'missing reference availability': ['referenceTrackAvailability', 'absentAvailability'],
    'invented metadata availability': ['"metadata": "unavailable"', '"metadata": "implemented-unmeasured"'],
    'mandatory metadata removed': ['"metadata"\n    ]', '"removed"\n    ]'],
    'missing metadata prerequisite': ['referenceMetadataPrerequisite', 'absentPrerequisite'],
    'empty passing label': ['zero-unit-lifecycle-N/A; required output lifecycle still checked', 'pass'],
    'unsupported region passing label': ['nonempty scored; never discard for parse error', 'pass'],
  }
  const [before, after] = substitutions[name]
  expect(read(wavePath).toString('utf8')).toContain(before)
  corrupt(wavePath, text => name === 'generated evaluation' ? text.replace(/("split": "evaluation"[\s\S]*?"generated": )false/, '$1true') : text.replace(before, after))
})

it.each(['expected-rows.tsv', 'scope-requests.tsv'])('rejects missing, duplicate, shortened, and passing rows in %s', name => {
  const path = prefix + name
  corrupt(path, text => text.split('\n').slice(0, -2).join('\n') + '\n')
  corrupt(path, text => text + text.split('\n')[1] + '\n')
  corrupt(path, text => text.replace('\t3946\t', '\t1\t'))
  corrupt(path, text => text.replace('N/A-zero-unit-lifecycle', 'pass'))
  corrupt(path, text => text.replace('unmeasured', 'pass'))
})

it.each(['languages', 'structuralRows', 'themes', 'unavailableInjectionDependencies'])('rejects incomplete catalog accounting: %s', key => {
  corrupt(prefix + 'inventory-accounting.json', text => text.replace(`"${key}"`, '"removed"'))
})

it('rejects lost notice/license/ancestry/source bytes and changed selection identity', () => {
  for (const path of ['development/NOTICE', 'licenses/original-010/LICENSE', 'evidence/original-authorship.json', 'development/original/javascript/ordinary.js', 'selection-lock.json']) {
    corrupt(prefix + path, text => text + '\n')
  }
})

it('rejects missing assets, path traversal, and changed existing development bytes', () => {
  const missingRead = (path: string): Uint8Array => {
    if (path === prefix + 'development/original/javascript/ordinary.js') throw new Error('missing asset')
    return read(path)
  }
  expect(() => readJsJsxIntake(missingRead)).toThrow('missing asset')
  corrupt(wavePath, text => text.replace('development/original/javascript/ordinary.js', '../escape.js'))
  corrupt('fixtures/textmate-grammars-themes/samples/javascript.sample', text => text + '\n')
})

it('retains strict unavailable metadata and all non-passing conditions without producing outcomes', () => {
  const intake = readJsJsxIntake()
  expect(intake.requiredTracks).toEqual(['ordered-scope-path', 'resolved-style', 'metadata'])
  expect(intake.metadataAvailability).toBe('unavailable')
  expect(intake.nonPassing).toEqual(['missing', 'error', 'timeout', 'cancel', 'unsupported', 'missing-style', 'missing-metadata', 'invalid-source-identity', 'partial', 'empty-denominator-as-pass'])
  expect(intake).not.toHaveProperty('acceptance')
  expect(materializeJsJsxRows(intake)).not.toHaveProperty('results')
})

it('keeps every packet file explicitly inventoried, without shipping acquisition scripts', () => {
  const lock: unknown = JSON.parse(read(prefix + 'selection-lock.json').toString('utf8'))
  if (!lock || typeof lock !== 'object' || !('files' in lock) || !lock.files || typeof lock.files !== 'object') throw new Error('Invalid selection lock')
  const expected = Object.keys(lock.files).filter(path => !path.startsWith('manifest/') && !path.endsWith('.py')).concat(['selection-lock.json', 'scope-requests.tsv'])
  expectInventory(fileURLToPath(new URL(prefix, harnessRoot)), expected)
})

it.each(['raw', 'raw:shiki-fork', 'shiki-api', 'product', 'product:warm'])('rejects silently missing profile requests: %s', profile => {
  for (const path of ['expected-rows.tsv', 'scope-requests.tsv']) {
    corrupt(prefix + path, text => withoutProfile(text, profile))
  }
})

function withoutProfile(text: string, profile: string): string {
  return text.split('\n').filter(line => line.split('\t')[3] !== profile).join('\n')
}

it.each(['file', 'file-link', 'directory-link'] as const)('rejects an unregistered inventory entry: %s', kind => {
  const root = mkdtempSync(join(tmpdir(), 'js-jsx-inventory-'))
  try {
    writeFileSync(join(root, 'known.js'), 'known')
    if (kind === 'file') writeFileSync(join(root, 'extra.js'), 'extra')
    if (kind === 'file-link') symlinkSync('known.js', join(root, 'extra.js'))
    if (kind === 'directory-link') {
      mkdirSync(join(root, 'known-directory'))
      symlinkSync('known-directory', join(root, 'extra-directory'))
    }
    expect(() => expectInventory(root, ['known.js'])).toThrow()
  } finally { rmSync(root, { recursive: true, force: true }) }
})

function expectInventory(root: string, expected: readonly string[]): void {
  expect(inventoryFiles(root).sort()).toEqual(expected.toSorted())
}
function inventoryFiles(root: string): string[] {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isFile()) throw new Error(`Unsupported inventory entry: ${relative(root, join(entry.parentPath, entry.name))}`)
  }
  return entries.filter(entry => entry.isFile()).map(entry => relative(root, join(entry.parentPath, entry.name)))
}
