import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Theme, type IRawTheme } from '@shikijs/vscode-textmate'
import { normalizeTheme } from 'shiki/core'
import { PINS } from './pins.ts'
import { ScopePath } from './product/scopePath.ts'
import { workerThemeRegistration } from './product/theme.ts'
import { vscodeRawTheme } from './raw.ts'
import { nativeThemeDigest, nativeThemeInputs, nativeThemeSha256 } from './native-theme-inputs.ts'
import type { NativeThemeEffective, NativeThemeField, NativeThemeFixture, NativeThemeFont, NativeThemeInput, NativeThemeObservation, NativeThemePartial, NativeThemeProfile, NativeThemeSuite, NativeThemeTargets } from './native-theme-schema.ts'
import type { RawTheme } from './textmate.ts'

export function nativeThemeRgba(color: string): string {
  assert(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color), `reference color ${color}`)
  let digits = color.slice(1).toLowerCase()
  if (digits.length < 5) digits = Array.from(digits, digit => digit + digit).join('')
  if (digits.length === 6) digits += 'ff'
  return `#${digits}`
}

function font(mask: number): NativeThemeFont {
  assert(Number.isInteger(mask) && mask >= 0 && mask <= 15, 'reference font mask')
  if (mask === 0) return 'reset'
  return { ...(mask & 1 ? { italic: true } : {}), ...(mask & 2 ? { bold: true } : {}),
    ...(mask & 4 ? { underline: true } : {}), ...(mask & 8 ? { strikethrough: true } : {}) }
}

export function nativeThemeEffective(foreground: string, background: string, fontMask: number): NativeThemeEffective {
  return { foreground: nativeThemeRgba(foreground), background: nativeThemeRgba(background), fontMask, fontStyle: font(fontMask) }
}

function color(theme: Theme, id: number): string {
  const value = theme.getColorMap()[id]
  assert(typeof value === 'string', `reference color ID ${id}`)
  return nativeThemeRgba(value)
}

function colorField(theme: Theme, id: number): NativeThemeField<string> {
  return id === 0 ? { kind: 'inherit' } : { kind: 'set', value: color(theme, id) }
}

function partial(theme: Theme, match: ReturnType<Theme['match']>): NativeThemePartial {
  return { foreground: colorField(theme, match?.foregroundId ?? 0), background: colorField(theme, match?.backgroundId ?? 0),
    fontMask: match === null || match.fontStyle === -1 ? { kind: 'inherit' } : { kind: 'set', value: match.fontStyle } }
}

export function observeNativeTheme(theme: Theme, scopes: readonly string[], profile: NativeThemeProfile): NativeThemeObservation {
  const defaults = theme.getDefaults()
  let foreground = defaults.foregroundId, background = defaults.backgroundId, mask = defaults.fontStyle
  let path: Parameters<Theme['match']>[0] = null
  const trace: NativeThemeObservation['trace'][number][] = []
  for (const scope of scopes) {
    path = new ScopePath(path, scope)
    const match = theme.match(path)
    trace.push({ scope, partial: partial(theme, match) })
    if (match === null) continue
    if (match.foregroundId !== 0) foreground = match.foregroundId
    if (match.backgroundId !== 0) background = match.backgroundId
    if (match.fontStyle !== -1) mask = match.fontStyle
  }
  const effective = nativeThemeEffective(color(theme, foreground), color(theme, background), mask)
  const { background: _background, ...product } = effective
  return { effective, applied: profile === 'raw' ? effective : product, trace }
}

export function normalizeNativeThemeReference(input: NativeThemeInput, profile: NativeThemeProfile): IRawTheme {
  if (profile === 'product') return normalizeTheme(workerThemeRegistration(input.expanded))
  return nativeThemeRawRegistration(vscodeRawTheme(input.expanded))
}

export function nativeThemeRawRegistration(raw: RawTheme): IRawTheme {
  return { name: raw.name, settings: Array.from(raw.settings, rule => {
    const settings = { ...rule.settings }
    if (rule.scope === undefined) return { settings }
    return { settings, scope: typeof rule.scope === 'string' ? rule.scope : Array.from(rule.scope) }
  }) }
}

export type ReferenceEligibility = { readonly kind: 'eligible' } | { readonly kind: 'unsupported'; readonly code: 'raw-palette' | 'trie-tail-atom' }

/** Safety preflight for the two known pinned-target limits, never a candidate normalizer. */
export function nativeThemeReferenceEligibility(input: IRawTheme, profile: NativeThemeProfile): ReferenceEligibility {
  const colors = new Set(['#000000ff', '#ffffffff'])
  for (const rule of input.settings) {
    const selectors = typeof rule.scope === 'string' ? rule.scope.split(',') : rule.scope ?? []
    if (selectors.some(selector => selector.trim().split(' ').at(-1)?.split('.').some(atom => atom === 'hasOwnProperty' || atom === '__proto__')))
      return { kind: 'unsupported', code: 'trie-tail-atom' }
    if (rule.settings.foreground !== undefined) colors.add(nativeThemeRgba(rule.settings.foreground))
    if (rule.settings.background !== undefined) colors.add(nativeThemeRgba(rule.settings.background))
  }
  return profile === 'raw' && colors.size > 255 ? { kind: 'unsupported', code: 'raw-palette' } : { kind: 'eligible' }
}

export function nativeThemeTargets(): NativeThemeTargets {
  const require = createRequire(import.meta.url)
  const fork = nativeThemeSha256(readFileSync(require.resolve('@shikijs/vscode-textmate')))
  const raw = nativeThemeSha256(readFileSync(require.resolve('vscode-textmate')))
  const wasm = nativeThemeSha256(readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')))
  assert.equal(fork, 'e620383bf90108b309c238d054a06e519328425a02d0ce62b84c7023ba5543d9')
  assert.equal(raw, '9da91ca33178e8d68ac5b9ea5733258275fe2f1924db02930ef9cf7e0d850e0f')
  assert.equal(wasm, PINS.vscodeOniguruma.wasmSha256)
  return { fork: { version: '10.0.2', sha256: fork }, raw: { version: '9.3.2', sha256: raw, commit: PINS.vscodeTextmate.commit },
    shiki: { version: '4.4.3', sha256: nativeThemeSha256(readFileSync(new URL(import.meta.resolve('shiki/core')))),
      coreSha256: nativeThemeSha256(readFileSync(require.resolve('@shikijs/core'))) },
    oniguruma: { version: '2.0.1', wasmSha256: wasm }, product: { commit: PINS.platformCommit,
      themeSha256: nativeThemeSha256(readFileSync(new URL('./product/theme.ts', import.meta.url))),
      tokensSha256: nativeThemeSha256(readFileSync(new URL('./product/scopedTokens.ts', import.meta.url))) } }
}

export function nativeThemeFixture(input: NativeThemeInput, profile: NativeThemeProfile, targets = nativeThemeTargets()): NativeThemeFixture {
  const normalized = normalizeNativeThemeReference(input, profile)
  assert.deepEqual(nativeThemeReferenceEligibility(normalized, profile), { kind: 'eligible' }, input.id)
  const theme = Theme.createFromRawTheme(normalized)
  const acquisitionIdentity = nativeThemeDigest('native-theme-oracle/acquisition/v1', [input.root].concat(
    input.resources.flatMap(resource => [resource.id, 'json', resource.sha256]), input.edges.flatMap(edge => [edge.from, edge.to, String(edge.ordinal)])))
  const normalizedSettingsIdentity = nativeThemeDigest('native-theme-oracle/settings/v1', [JSON.stringify(normalized.settings)])
  const contentIdentity = nativeThemeDigest('native-theme-oracle/content/v1', [acquisitionIdentity, profile, JSON.stringify(targets),
    'authored-expanded-base-first/v1', normalizedSettingsIdentity])
  return { id: input.id, profile, acquisitionIdentity, contentIdentity, normalizedSettingsIdentity, input, normalized,
    defaults: observeNativeTheme(theme, [], profile).effective,
    cases: input.stacks.map(stack => ({ ...stack, ...observeNativeTheme(theme, stack.scopes, profile) })) }
}

export function generateNativeThemeSuite(): NativeThemeSuite {
  const targets = nativeThemeTargets()
  const fixtures = nativeThemeInputs().flatMap(input => ['raw', 'product'].map(profile => {
    assert(profile === 'raw' || profile === 'product')
    return nativeThemeFixture(input, profile, targets)
  }))
  const identity = nativeThemeDigest('native-theme-oracle/suite/v1', [JSON.stringify({ targets, fixtures })])
  return { schema: 'native-theme-oracle/v1', identity, targets, fixtures }
}
