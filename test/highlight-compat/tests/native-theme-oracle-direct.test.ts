import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Theme, type IRawTheme } from '@shikijs/vscode-textmate'
import { directNativeTheme, decodeNativeThemeMetadata, NATIVE_THEME_CONTROL_GRAMMAR, nativeThemeSpansEqual, nativeThemeStackGrammar, type NativeThemeDirect } from '../src/oracles/native-theme-direct.ts'
import { generateNativeThemeSuite, nativeThemeRawRegistration, nativeThemeReferenceEligibility, observeNativeTheme } from '../src/oracles/native-theme-reference.ts'
import { nativeThemeRegistration } from '../src/oracles/native-theme-inputs.ts'
import { vscodeRawTheme } from '../src/oracles/raw.ts'
import { NATIVE_THEME_MANIFEST, type NativeThemeFixture, type NativeThemeProfile } from '../src/oracles/native-theme-schema.ts'

const suite = generateNativeThemeSuite()

async function checkMatrix(fixture: NativeThemeFixture): Promise<void> {
  for (const row of fixture.cases) {
    if (row.scopes.length === 0) continue
    const { grammar, text, at } = nativeThemeStackGrammar(row.scopes)
    const actual = await directNativeTheme(fixture.normalized, fixture.profile, grammar, text)
    expect(nativeThemeSpansEqual(actual.direct, actual.repaint, text.length), `${fixture.id}/${fixture.profile}/${row.id}`).toBe(true)
    const token = actual.direct.find(span => span.from <= at && span.to > at)
    const scopes = actual.scopes.find(span => span.from <= at && span.to > at)
    expect(scopes?.scopes).toEqual(row.scopes)
    expect(token?.style).toEqual(row.applied)
  }
}

function repaintWithoutParent(theme: Theme, actual: NativeThemeDirect, profile: NativeThemeProfile) {
  return actual.scopes.map(span => ({ from: span.from, to: span.to,
    style: observeNativeTheme(theme, span.scopes.filter(scope => scope !== 'meta.parent'), profile).applied }))
}


it('decodes the pinned upstream named fields, including the full background ID', () => {
  const colors = Array.from({ length: 256 }, (_, index) => `#${index.toString(16).padStart(6, '0')}`)
  const metadata = (13 << 11) | (254 << 15) | (255 << 24)
  expect(decodeNativeThemeMetadata(metadata, colors)).toMatchObject({ foreground: '#0000feff', background: '#0000ffff', fontMask: 13 })
})

it('compares a complete nonoverlapping partition on the union of boundaries', () => {
  const style = { foreground: '#123456ff', background: '#abcdef01', fontMask: 0, fontStyle: 'reset' } as const
  const whole = [{ from: 0, to: 4, style }]
  const split = [{ from: 0, to: 1, style }, { from: 1, to: 4, style }]
  expect(nativeThemeSpansEqual(whole, split, 4)).toBe(true)
  expect(nativeThemeSpansEqual(whole, split.slice(1), 4)).toBe(false)
  expect(nativeThemeSpansEqual(whole, whole.concat(whole), 4)).toBe(false)
  expect(nativeThemeSpansEqual(whole, [{ from: 0, to: 5, style }], 4)).toBe(false)
  expect(nativeThemeSpansEqual(whole, [{ from: 0, to: 4, style: { ...style, background: '#00000000' } }], 4)).toBe(false)
})

it('validates every nonempty matrix stack with actual raw registry/product tokenizer output', async () => {
  for (const fixture of suite.fixtures) await checkMatrix(fixture)
}, 30_000)

it('reproduces stored controls and detects omitted clear, context, background and product field mutations', async () => {
  const observations = []
  for (const fixture of suite.fixtures.filter(item => item.id === 'inheritance')) {
    const actual = await directNativeTheme(fixture.normalized, fixture.profile, NATIVE_THEME_CONTROL_GRAMMAR, '(xy)')
    expect(nativeThemeSpansEqual(actual.direct, actual.repaint, 4)).toBe(true)
    const noClear = Theme.createFromRawTheme({ ...fixture.normalized, settings: fixture.normalized.settings.filter(rule => rule.scope !== 'variable.clear') })
    const clearMutation = actual.scopes.map(span => ({ from: span.from, to: span.to, style: observeNativeTheme(noClear, span.scopes, fixture.profile).applied }))
    const contextMutation = repaintWithoutParent(Theme.createFromRawTheme(fixture.normalized), actual, fixture.profile)
    expect(nativeThemeSpansEqual(actual.direct, clearMutation, 4), 'empty font converted to unset').toBe(false)
    expect(nativeThemeSpansEqual(actual.direct, contextMutation, 4), 'parent omitted during extraction').toBe(false)
    const backgroundMutation = actual.repaint.map(span => ({ ...span, style: { ...span.style, background: '#00000000' } }))
    expect(nativeThemeSpansEqual(actual.direct, backgroundMutation, 4), 'raw background omitted or product background fabricated').toBe(false)
    expect(actual.direct.some(span => span.from === 1 && span.style.fontMask === 0)).toBe(true)
    expect(actual.direct.some(span => span.from === 2 && span.style.fontMask === 4)).toBe(true)
    observations.push({ profile: fixture.profile, ...actual })
  }
  expect(readFileSync(new URL('controls.json', NATIVE_THEME_MANIFEST), 'utf8')).toBe(`${JSON.stringify(observations, null, 2)}\n`)
})

it.each(['foreground', 'background'])('tests the conservative raw %s boundary and refuses the first larger theme before compilation', async role => {
  const accepted = suite.fixtures.find(item => item.id === `palette-${role}-253` && item.profile === 'raw')
  assert(accepted)
  const palette = new Set(['#000000', '#FFFFFF'].concat(Theme.createFromRawTheme(accepted.normalized).getColorMap().filter(value => typeof value === 'string')))
  expect(palette.size).toBe(255)
  const row = accepted.cases.find(item => item.id === 'last-color')
  assert(row)
  const { grammar, text } = nativeThemeStackGrammar(row.scopes)
  const actual = await directNativeTheme(accepted.normalized, 'raw', grammar, text)
  expect(nativeThemeSpansEqual(actual.direct, actual.repaint, text.length)).toBe(true)
  const bytes = readFileSync(new URL(`themes/palette-${role}-254.json`, NATIVE_THEME_MANIFEST), 'utf8')
  const registration = nativeThemeRegistration(bytes)
  const raw = vscodeRawTheme(registration)
  const rejected = nativeThemeRawRegistration(raw)
  expect(nativeThemeReferenceEligibility(rejected, 'raw')).toEqual({ kind: 'unsupported', code: 'raw-palette' })
  await expect(directNativeTheme(rejected, 'raw', grammar, text)).rejects.toThrow('preflight before reference compilation')
  expect(nativeThemeReferenceEligibility(rejected, 'product')).toEqual({ kind: 'eligible' })
  const product = suite.fixtures.find(item => item.id === `palette-${role}-253` && item.profile === 'product')
  assert(product)
  const productInput = { ...product.input, expanded: registration }
  const { normalizeNativeThemeReference } = await import('../src/oracles/native-theme-reference.ts')
  const productDirect = await directNativeTheme(normalizeNativeThemeReference(productInput, 'product'), 'product', grammar, text)
  expect(nativeThemeSpansEqual(productDirect.direct, productDirect.repaint, text.length)).toBe(true)
})

it('checks ordinary empty scope paths through the actual product plain-line control', async () => {
  const fixture = suite.fixtures.find(item => item.id === 'inheritance' && item.profile === 'product')
  assert(fixture)
  const actual = await directNativeTheme(fixture.normalized, 'product', NATIVE_THEME_CONTROL_GRAMMAR, 'x', 0)
  expect(actual.scopes).toEqual([{ from: 0, to: 1, scopes: [] }])
  expect(actual.direct[0]?.style).toEqual(fixture.cases.find(row => row.id === 'empty')?.applied)
})

it.each(['foreground', 'background'])('counts equivalent %s spellings as separate raw palette entries', async role => {
  const colors = Array.from({ length: 252 }, (_, index) => `#${(index + 1).toString(16).padStart(6, '0')}`)
    .concat(['#123', '#112233'])
  const settings: IRawTheme['settings'] = [{ settings: { foreground: '#000000', background: '#ffffff' } }]
  settings.push(...colors.map((value, index) => ({ scope: `probe.c${String(index).padStart(3, '0')}`, settings: { [role]: value } })))
  const input = { settings }
  const palette = Theme.createFromRawTheme(input).getColorMap()
  expect(palette).toHaveLength(257)
  expect(palette.at(-1)).toBe('#112233')
  expect(nativeThemeReferenceEligibility(input, 'raw')).toEqual({ kind: 'unsupported', code: 'raw-palette' })
  const grammar = { scopeName: 'source.native-theme', patterns: [{ match: 'x', name: 'probe.c253' }] }
  await expect(directNativeTheme(input, 'raw', grammar, 'x')).rejects.toThrow('preflight before reference compilation')
  expect(nativeThemeReferenceEligibility(input, 'product')).toEqual({ kind: 'eligible' })
})

it('rejects unsafe tail components before either actual target compiles them', async () => {
  for (const profile of ['raw', 'product'] as const) for (const scope of ['hasOwnProperty', '__proto__', 'scope.__proto__.leaf'])
    await expect(directNativeTheme({ settings: [{ scope, settings: { foreground: '#123456' } }] }, profile, NATIVE_THEME_CONTROL_GRAMMAR, '(xy)')).rejects.toThrow('preflight before reference compilation')
})
