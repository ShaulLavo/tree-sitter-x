import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { ADMISSION_ROOT, CONTRACT_AUTHORITY, type AdmissionFixture, type AdmissionSuite, type Attempt } from '../src/oracles/theme-admission/schema.ts'
import { admissionInputs, identity, sha256, transportControls } from '../src/oracles/theme-admission/inputs.ts'
import { referenceDependencies } from '../src/oracles/theme-admission/independence.ts'
import { loadAdmissionSuite, object, validateAdmissionSuite } from '../src/oracles/theme-admission/load.ts'
import { admissionFixture, admissionTargets, generateAdmissionSuite, projected, suiteBytes } from '../src/oracles/theme-admission/reference.ts'

const suite = loadAdmissionSuite()
const packageRoot = fileURLToPath(new URL('../', import.meta.url))

function fixture(id: string): AdmissionFixture {
  const found = suite.fixtures.find(item => item.input.id === id)
  assert(found, id)
  return found
}

const styles = (id: string) => observed(id).cases.map(row => ({ id: row.id, scopes: row.scopes, effective: row.effective, applied: row.applied, trace: row.trace }))

function observed(id: string, profile: Attempt['profile'] = 'raw') {
  const result = fixture(id).attempts.find(attempt => attempt.profile === profile && attempt.view === 'full')?.result
  assert(result?.kind === 'observed', id)
  return result
}

function mutate(edit: (copy: AdmissionSuite) => void): AdmissionSuite {
  const copy = structuredClone(suite)
  edit(copy)
  const { identity: _old, ...body } = copy
  return { ...body, identity: identity('admission/suite/v1', body) }
}

it('loads a separate versioned suite with exact authored sources, closure and target pins', () => {
  expect(suite.schema).toBe('native-theme-admission-oracle/v1')
  expect(suite.source.commit).toBe('e961cc4dfe14e716e90694cda10378215be9e83b')
  expect(suite.fixtures.map(item => item.input)).toEqual(admissionInputs())
  expect(suite.targets).toEqual(admissionTargets())
  expect(suite.fixtures.every(item => item.input.contract.authority === CONTRACT_AUTHORITY)).toBe(true)
  expect(suite.fixtures.length).toBeGreaterThan(100)
})

it('pins the entire transitive reference graph including type imports, and rejects candidate entry points', () => {
  expect(suite.source.inputs).toEqual(referenceDependencies())
  expect(Object.keys(suite.source.inputs)).toContain('src/oracles/product/scopedTokens.ts')
  expect(Object.keys(suite.source.inputs)).toContain('src/oracles/raw.ts')
  expect(() => referenceDependencies(['src/native/theme-input.ts'])).toThrow('non-reference dependency')
  expect(() => referenceDependencies(['src/wave-collection.ts'])).toThrow('non-reference dependency')
})

it('regenerates actual raw, raw-fork, product and Shiki API output deterministically', async () => {
  const generated = await generateAdmissionSuite(referenceDependencies())
  expect(suiteBytes(generated)).toBe(readFileSync(new URL('suite.json', ADMISSION_ROOT), 'utf8'))
  expect(generated.fixtures.flatMap(item => item.attempts).filter(item => item.result.kind === 'observed').length).toBeGreaterThan(200)
}, 30_000)

it('runs the configured --check entry point without changing any expected bytes', () => {
  const before = sha256(readFileSync(new URL('suite.json', ADMISSION_ROOT)))
  const output = execFileSync(process.execPath, ['src/cli/native-theme-admission.ts', '--check'], { cwd: packageRoot, encoding: 'utf8' })
  expect(output).toContain('--check: native-theme-admission-oracle/v1')
  expect(sha256(readFileSync(new URL('suite.json', ADMISSION_ROOT)))).toBe(before)
}, 30_000)

it('checks missing versus present zero, all four bits and literal-space OR rather than a destructive reset', () => {
  const inherited = observed('font-missing').cases.at(-1)
  const zero = observed('font-1').cases.at(-1)
  assert(inherited && zero)
  expect(inherited.trace.at(-1)?.partial.fontMask.kind).toBe('inherit')
  expect(zero.trace.at(-1)?.partial.fontMask).toEqual({ kind: 'set', value: 0 })
  expect(zero.effective.fontMask).not.toBe(inherited.effective.fontMask)
  for (const id of ['font-0', 'font-2', 'font-3']) expect(styles(id)).toEqual(styles('font-1'))
  expect(styles('font-11')).toEqual(styles('font-12'))
  expect(styles('font-12')).toEqual(styles('font-13'))
  expect(styles('font-14')).toEqual(styles('font-15'))
  expect(styles('font-16')).toEqual(styles('font-17'))
  expect(observed('font-11').cases.at(-1)?.effective.fontMask).not.toBe(observed('font-8').cases.at(-1)?.effective.fontMask)
  expect(observed('font-14').cases.at(-1)?.effective.fontMask).toBe(15)
})

it('retains transparent zero as present while leaving absent fields inherited', () => {
  for (const profile of ['raw', 'product'] as const) {
    const transparent = observed('aux-content-1', profile).cases.at(-1)?.trace.at(-1)?.partial
    const background = observed('aux-content-2', profile).cases.at(-1)?.trace.at(-1)?.partial
    expect(transparent).toEqual({ foreground: { kind: 'set', value: '#00000000' }, background: { kind: 'inherit' }, fontMask: { kind: 'set', value: 0 } })
    expect(background).toEqual({ foreground: { kind: 'inherit' }, background: { kind: 'set', value: '#00000000' }, fontMask: { kind: 'inherit' } })
  }
})

it('does not confuse permissive target behavior with our authored font rejection contract', () => {
  const negatives = suite.fixtures.filter(item => item.input.group === 'font-contract-reject')
  expect(negatives).toHaveLength(17)
  expect(negatives.every(item => item.input.contract.admission.kind !== 'ok')).toBe(true)
  expect(negatives.every(item => item.attempts.every(attempt => attempt.result.kind === 'observed'))).toBe(true)
  expect(negatives.some(item => item.input.resources[0]?.bytes.includes('\\t'))).toBe(true)
})

it('keeps auxiliary property-only rules, original alternative arrays and include overrides in actual normalized registrations', () => {
  for (const key of ['content', 'text-decoration', '-webkit-font-smoothing']) checkAuxiliary(key)
})

function checkAuxiliary(key: string): void {
  const propertyOnly = observed(`aux-${key}-0`)
  const normalized = object(propertyOnly.normalized)
  assert(Array.isArray(normalized.settings))
  expect(normalized.settings.map(object).some(rule => object(rule.settings)[key] !== undefined)).toBe(true)
  const repeat = object(observed(`aux-${key}-repeat`).normalized)
  assert(Array.isArray(repeat.settings))
  expect(repeat.settings.map(object).some(rule => Array.isArray(rule.scope) && rule.scope.length === 2)).toBe(true)
  expect(observed(`aux-${key}-repeat`).cases.some(row => row.id === 'second-alternative')).toBe(true)
  const included = fixture(`included-both-arrays-${key}`)
  expect(included.input.baseFirst).toEqual(['admission:/base', 'admission:/root'])
  expect(included.input.contract.admission.kind).toBe('ok')
  expect(observed(`included-both-arrays-${key}`).cases.at(-1)?.effective).toEqual(observed('included-both-arrays-content').cases.at(-1)?.effective)
}

it('compares selected output and normalized syntax for full versus typed UI inputs, not unequal UI bags', () => {
  for (const item of suite.fixtures.filter(item => item.input.projection === 'untouched-ui')) checkProjection(item)
})

function checkProjection(item: AdmissionFixture): void {
  for (const profile of ['raw', 'product']) {
    const full = item.attempts.find(attempt => attempt.profile === profile && attempt.view === 'full')
    const projected = item.attempts.find(attempt => attempt.profile === profile && attempt.view === 'typed-projection')
    assert(full?.result.kind === 'observed' && projected?.result.kind === 'observed')
    expect(full.result.cases).toEqual(projected.result.cases)
    const a = object(full.result.normalized), b = object(projected.result.normalized)
    expect({ settings: a.settings, fg: a.fg, bg: a.bg, type: a.type }).toEqual({ settings: b.settings, fg: b.fg, bg: b.bg, type: b.type })
  }
}

it('retains consumed editor/ANSI target errors and detects an unsafe projection that hides them', async () => {
  const item = fixture('consumed-terminal.ansiBogus-false-1')
  expect(item.input.contract.admission.kind).toBe('invalid')
  const full = item.attempts.find(attempt => attempt.profile === 'product')
  assert(full?.result.kind === 'error')
  expect(full.result.stage).toBe('profile-normalization')
  expect(full.result.name).toBe('TypeError')
  const unsafe = await admissionFixture({ ...item.input, expanded: { ...item.input.expanded, colors: {} } })
  expect(unsafe.attempts.find(attempt => attempt.profile === 'product')?.result.kind).toBe('observed')
  expect(projected(item.input.expanded).colors).toEqual(item.input.expanded.colors)
  expect(() => projected(fixture('ui-reject-0').input.expanded)).toThrow('admitted UI shapes')
})

it('records upstream metrics separately instead of calling them universally ignored', () => {
  for (const [id, key] of [['unknown-0', 'fontFamily'], ['unknown-1', 'fontSize'], ['unknown-2', 'lineHeight']]) {
    const row = observed(id).cases.at(-1)
    assert(row)
    const partial = object(row.upstreamPartial)
    assert(Array.isArray(partial.partials))
    const child = object(partial.partials.at(-1))
    const match = object(child.match)
    expect(match[key]).toBeTruthy()
    expect(key in row.effective).toBe(false)
    expect(fixture(id).input.contract.admission).toMatchObject({ kind: 'unsupported', code: 'syntax-property' })
  }
})

it('keeps authored array-qualified pointers, source ordering, unselected occurrences and legacy absence separate from target observations', () => {
  const paired = fixture('equal-array-ordinals').input.contract.admission
  assert(paired.kind === 'ok')
  expect(paired.warnings.map(warning => warning.location?.jsonPointer)).toEqual(['/settings/0/settings/content', '/tokenColors/0/settings/content'])
  const included = fixture('included-both-arrays-content').input.contract.admission
  assert(included.kind === 'ok')
  expect(included.warnings.map(warning => warning.location?.jsonPointer)).toEqual(['/settings/2/settings/content', '/tokenColors/0/settings/content', '/settings/0/settings/content', '/tokenColors/0/settings/content', '/colors/a~0~1b'])
  expect(included.warnings.slice(0, 2).every(warning => warning.resource === 'admission:/base')).toBe(true)
  const unselected = fixture('unselected-only').input.contract.admission
  assert(unselected.kind === 'ok')
  expect(unselected.warnings).toHaveLength(1)
  expect(fixture('unselected-invalid-auxiliary').input.contract.admission).toMatchObject({ kind: 'invalid', location: { jsonPointer: '/tokenColors/0/settings/content' } })
  expect(suite.transport).toEqual(transportControls())
  const legacy = fixture('ui-true-3').input.contract.admission
  assert(legacy.kind === 'ok')
  expect(Object.keys(legacy.warnings[0] ?? {}).sort()).toEqual(['kind', 'property', 'resource'])
  expect(JSON.stringify(suite.transport)).toContain('retained-request-readback')
})

it('binds byte aliases and included bytes even when the selected target styles are equal', () => {
  const original = fixture('included-both-arrays-content'), alias = fixture('included-byte-alias')
  expect(original.acquisitionIdentity).not.toBe(alias.acquisitionIdentity)
  expect(original.attempts).toEqual(alias.attempts)
  expect(original.input.resources[1]?.sha256).toBe(alias.input.resources[1]?.sha256)
})

it('rejects corrupted resource bytes, closure, named fields, pointers, traces and identities', () => {
  const corruptResource = mutate(copy => { const input = object(copy.fixtures[0]?.input); const resources = input.resources; assert(Array.isArray(resources)); Object.assign(resources[0], { bytes: '{}' }) })
  expect(() => validateAdmissionSuite(corruptResource)).toThrow('exact resource bytes')
  const corruptPointer = mutate(copy => { const target = copy.fixtures.find(item => item.input.id === 'equal-array-ordinals'); assert(target); const admission = target.input.contract.admission; assert(admission.kind === 'ok'); Object.assign(admission.warnings[0]?.location ?? {}, { jsonPointer: '/colors/bad~2' }) })
  expect(() => validateAdmissionSuite(corruptPointer)).toThrow('escaped JSON pointer')
  const corruptTrace = mutate(copy => { const result = copy.fixtures[0]?.attempts[0]?.result; assert(result?.kind === 'observed'); Object.assign(result.cases[1]?.trace[0]?.partial ?? {}, { fontMask: { kind: 'set', value: 16 } }) })
  expect(() => validateAdmissionSuite(corruptTrace)).toThrow()
  const corruptStyle = mutate(copy => { const result = copy.fixtures[0]?.attempts[0]?.result; assert(result?.kind === 'observed'); Object.assign(result.cases[0]?.effective ?? {}, { foreground: 'red' }) })
  expect(() => validateAdmissionSuite(corruptStyle)).toThrow()
  const corruptEdges = mutate(copy => { const included = copy.fixtures.find(item => item.input.id === 'included-both-arrays-content'); assert(included); Object.assign(included.input.edges[0] ?? {}, { to: 'not-authorized' }) })
  expect(() => validateAdmissionSuite(corruptEdges)).toThrow('authorized include closure')
  expect(() => loadAdmissionSuite(JSON.stringify(suite))).toThrow('deterministic serialized format')
  expect(() => validateAdmissionSuite({ ...suite, identity: '0'.repeat(64) })).toThrow('complete suite identity')
})
