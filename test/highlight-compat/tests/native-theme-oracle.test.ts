import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Theme } from '@shikijs/vscode-textmate'
import { generateNativeThemeSuite, nativeThemeFixture, nativeThemeReferenceEligibility, nativeThemeRgba, observeNativeTheme } from '../src/oracles/native-theme-reference.ts'
import { nativeThemeDigest, nativeThemeInputs, nativeThemeRegistration, nativeThemeSha256 } from '../src/oracles/native-theme-inputs.ts'
import { NATIVE_THEME_MANIFEST } from '../src/oracles/native-theme-schema.ts'
import { nativeThemeDiagnosticFixtures } from '../src/oracles/native-theme-diagnostics.ts'

const suite = generateNativeThemeSuite()
function fixture(id: string, profile: 'raw' | 'product' = 'raw') {
  const value = suite.fixtures.find(item => item.id === id && item.profile === profile)
  assert(value, id)
  return value
}
function row(id: string, name: string, profile: 'raw' | 'product' = 'raw') {
  const value = fixture(id, profile).cases.find(item => item.id === name)
  assert(value, name)
  return value
}


it('keeps ordinary tests read-only and every expectation reproducible from pinned reference packages', () => {
  expect(readFileSync(new URL('suite.json', NATIVE_THEME_MANIFEST), 'utf8')).toBe(`${JSON.stringify(suite, null, 2)}\n`)
  expect(readFileSync(new URL('diagnostics.json', NATIVE_THEME_MANIFEST), 'utf8')).toBe(`${JSON.stringify(nativeThemeDiagnosticFixtures(), null, 2)}\n`)
  for (const item of suite.fixtures) for (const resource of item.input.resources) {
    expect(readFileSync(new URL(resource.file, NATIVE_THEME_MANIFEST), 'utf8')).toBe(resource.bytes)
    expect(nativeThemeSha256(resource.bytes)).toBe(resource.sha256)
  }
})

it('distinguishes nonempty defaults, inherited fields, explicit clears and replacement masks', () => {
  expect(row('inheritance', 'empty').effective.fontMask).toBe(15)
  expect(row('inheritance', 'default-inherits').effective.fontMask).toBe(15)
  expect(row('inheritance', 'default-clear').effective.fontStyle).toBe('reset')
  expect(row('inheritance', 'parent-inherits').trace.at(-1)?.partial.fontMask).toEqual({ kind: 'inherit' })
  expect(row('inheritance', 'parent-inherits').effective.fontMask).toBe(4)
  expect(row('inheritance', 'parent-clear').trace.at(-1)?.partial.fontMask).toEqual({ kind: 'set', value: 0 })
  expect(row('inheritance', 'parent-clear').effective.fontMask).toBe(0)
  expect(row('inheritance', 'parent-replacement').effective.fontMask).toBe(1)
  expect(row('inheritance', 'color-inherits-font').effective.fontMask).toBe(4)
  expect(row('inheritance', 'root-default').trace[0]?.partial).toEqual({ foreground: { kind: 'inherit' }, background: { kind: 'inherit' }, fontMask: { kind: 'inherit' } })
})

it('locks ordered, repeated, immediate and mixed contexts with dot boundaries and alternatives', () => {
  const foreground = (id: string) => row('contexts', id).effective.foreground
  expect(foreground('ordered')).toBe('#333333ff')
  expect(foreground('reordered')).toBe('#929292ff')
  expect(foreground('missing')).toBe('#111111ff')
  expect(foreground('extra')).toBe('#333333ff')
  expect(foreground('tail-depth')).toBe('#555555ff')
  expect(foreground('dot-boundary')).toBe(fixture('contexts').defaults.foreground)
  expect(foreground('immediate')).toBe('#232323ff')
  expect(foreground('immediate-gap')).toBe('#121212ff')
  expect(foreground('repeat-present')).toBe('#343434ff')
  expect(foreground('repeat-missing')).not.toBe('#343434ff')
  expect(foreground('mixed')).toBe('#454545ff')
  expect(foreground('mixed-gap')).not.toBe('#454545ff')
  expect(foreground('greedy-nearest-fails')).not.toBe('#a1b2c3ff')
  expect(foreground('greedy-adjacent')).toBe('#a1b2c3ff')
  expect(foreground('comma-first')).toBe('#565656ff')
  expect(foreground('comma-second')).toBe('#565656ff')
  expect(foreground('array-first')).toBe('#676767ff')
  expect(foreground('array-second')).toBe('#676767ff')
})

it('locks nearest-first specificity, stable equal-specificity order and per-field exact-selector merges', () => {
  expect(row('contexts', 'nearest-name').effective.foreground).toBe('#202020ff')
  expect(row('contexts', 'more-context').effective.foreground).toBe('#404040ff')
  expect(row('contexts', 'stable-tie').effective.foreground).toBe('#606060ff')
  expect(row('contexts', 'stable-tie-reversed-path').effective.foreground).toBe('#606060ff')
  expect(row('contexts', 'stable-tie').effective.fontMask).toBe(2)
  expect(row('contexts', 'tail-depth').effective).toMatchObject({ foreground: '#555555ff', background: '#667788ff', fontMask: 0 })
  expect(row('contexts', 'no-cross-context-merge').effective.foreground).toBe('#111111ff')
  expect(row('contexts', 'no-cross-context-merge').effective.fontMask).toBe(2)
})

it('extracts shorthand and alpha without using zero as an absence sentinel', () => {
  expect(row('inheritance', 'alpha').effective).toMatchObject({ foreground: '#12345678', background: '#aabbccdd' })
  expect(row('inheritance', 'shorthand').effective).toMatchObject({ foreground: '#aabbccff', background: '#112233ff' })
  expect(row('inheritance', 'transparent-zero').trace.at(-1)?.partial.foreground).toEqual({ kind: 'set', value: '#00000000' })
  expect(row('inheritance', 'transparent-zero').effective).toMatchObject({ foreground: '#00000000', background: '#00000000' })
  expect(nativeThemeRgba('#AbC')).toBe('#aabbccff')
  expect(nativeThemeRgba('#ABCD')).toBe('#aabbccdd')
  const wire = new Uint8Array(4)
  new DataView(wire.buffer).setUint32(0, Number.parseInt('12345678', 16), true)
  expect(Array.from(wire)).toEqual([0x78, 0x56, 0x34, 0x12])
})

it('records profile normalization, raw background, product projection and warning-only fields', () => {
  expect(fixture('empty-dark').defaults.foreground).toBe('#bbbbbbff')
  expect(fixture('empty-light').defaults.foreground).toBe('#333333ff')
  expect(row('inheritance', 'parent-inherits').applied).toHaveProperty('background', '#112233ff')
  expect(row('inheritance', 'parent-inherits', 'product').applied).not.toHaveProperty('background')
  expect(row('precedence', 'root-default').effective.foreground).toBe('#0a0b0cff')
  expect(fixture('outside-score').input.warnings).toHaveLength(4)
  expect(fixture('outside-score').cases).not.toHaveLength(0)
  expect(fixture('inheritance').normalized.settings).not.toEqual(fixture('inheritance', 'product').normalized.settings)
})

it('binds identities to exact root/include bytes, profile, target and ordered normalization', () => {
  const original = fixture('inheritance'), changed = fixture('inheritance-changed')
  expect(original.input.expanded.name).toBe(changed.input.expanded.name)
  expect(original.contentIdentity).not.toBe(changed.contentIdentity)
  expect(original.acquisitionIdentity).toBe(fixture('inheritance', 'product').acquisitionIdentity)
  expect(original.contentIdentity).not.toBe(fixture('inheritance', 'product').contentIdentity)
  expect(fixture('included').input.resources.at(-1)?.sha256).toBe(fixture('included-changed').input.resources.at(-1)?.sha256)
  expect(fixture('included').contentIdentity).not.toBe(fixture('included-changed').contentIdentity)
  expect(row('included', 'base').effective.foreground).toBe('#333333ff')
  expect(row('included-changed', 'base').effective.foreground).toBe('#444444ff')
  expect(nativeThemeDigest('domain', ['ab', 'c'])).not.toBe(nativeThemeDigest('domain', ['a', 'bc']))
  expect(nativeThemeDigest('domain', ['a'])).not.toBe(nativeThemeDigest('other-domain', ['a']))
  const input = nativeThemeInputs()[0]
  assert(input)
  const resource = input.resources[0]
  assert(resource)
  const bytes = resource.bytes.concat(' ')
  const byteChanged = { ...input, resources: [{ ...resource, bytes, sha256: nativeThemeSha256(bytes) }], expanded: nativeThemeRegistration(bytes) }
  const actual = nativeThemeFixture(byteChanged, 'raw', suite.targets)
  expect(actual.normalizedSettingsIdentity).toBe(original.normalizedSettingsIdentity)
  expect(actual.contentIdentity).not.toBe(original.contentIdentity)
  expect(nativeThemeFixture(input, 'raw', { ...suite.targets, shiki: { ...suite.targets.shiki, sha256: 'different' } }).contentIdentity).not.toBe(original.contentIdentity)
})

it('refuses unsafe tail components before target compilation, keeping contexts and constructor supported', () => {
  for (const atom of ['hasOwnProperty', '__proto__']) {
    for (const scope of [atom, `scope.${atom}.leaf`]) expect(nativeThemeReferenceEligibility({ settings: [{ scope, settings: { foreground: '#123456' } }] }, 'raw')).toEqual({ kind: 'unsupported', code: 'trie-tail-atom' })
    expect(nativeThemeReferenceEligibility({ settings: [{ scope: `${atom} variable`, settings: { foreground: '#123456' } }] }, 'raw')).toEqual({ kind: 'eligible' })
  }
  expect(row('contexts', 'context-hasOwnProperty').effective.foreground).toBe('#787878ff')
  expect(row('contexts', 'context-proto').effective.foreground).toBe('#898989ff')
  expect(row('contexts', 'constructor').effective.foreground).toBe('#9a9a9aff')
  expect(row('contexts', 'constructor-component').effective.foreground).toBe('#abababff')
  expect(observeNativeTheme(Theme.createFromRawTheme({ settings: [] }), ['__proto__', 'hasOwnProperty'], 'raw').effective.fontMask).toBe(0)
})
