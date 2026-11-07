import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { EncodedTokenMetadata, Registry, Theme, type IRawTheme } from '@shikijs/vscode-textmate'
import { normalizeTheme } from 'shiki/core'
import upstream from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
import { createScopedLineTokenizer, tokenScopes } from './product/scopedTokens.ts'
import { workerThemeRegistration } from './product/theme.ts'
import { nativeThemeEffective, nativeThemeReferenceEligibility, observeNativeTheme } from './native-theme-reference.ts'
import type { NativeThemeApplied, NativeThemeProfile } from './native-theme-schema.ts'

export interface NativeThemeSpan {
  readonly from: number
  readonly to: number
  readonly style: NativeThemeApplied
}
export interface NativeThemeDirect {
  readonly text: string
  readonly direct: readonly NativeThemeSpan[]
  readonly repaint: readonly NativeThemeSpan[]
  readonly scopes: readonly { readonly from: number; readonly to: number; readonly scopes: readonly string[] }[]
}
interface NativeThemeGrammarRule {
  readonly name?: string
  readonly match?: string
  readonly begin?: string
  readonly end?: string
  readonly patterns?: NativeThemeGrammarRule[]
}
export interface NativeThemeGrammar {
  readonly scopeName: string
  readonly patterns: readonly NativeThemeGrammarRule[]
}

let loaded: Promise<void> | undefined
async function onig() {
  loaded ??= oniguruma.loadWASM(readFileSync(createRequire(import.meta.url).resolve('vscode-oniguruma/release/onig.wasm')))
  await loaded
  return { createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
    createOnigString: (text: string) => new oniguruma.OnigString(text) }
}

/** Upstream 9.3.2 encodedTokenAttributes.ts uses these same named masks as fork 10.0.2. */
export function decodeNativeThemeMetadata(metadata: number, colors: readonly string[]): NativeThemeApplied {
  const foreground = colors[EncodedTokenMetadata.getForeground(metadata)]
  const background = colors[EncodedTokenMetadata.getBackground(metadata)]
  assert(typeof foreground === 'string' && typeof background === 'string', 'packed reference color')
  return nativeThemeEffective(foreground, background, EncodedTokenMetadata.getFontStyle(metadata))
}

export async function directNativeTheme(input: IRawTheme, profile: NativeThemeProfile, grammar: NativeThemeGrammar, text: string, maxLineLength = 100_000): Promise<NativeThemeDirect> {
  assert.deepEqual(nativeThemeReferenceEligibility(input, profile), { kind: 'eligible' }, 'preflight before reference compilation')
  const library = await onig()
  const theme = Theme.createFromRawTheme(input)
  if (profile === 'product') {
    const registry = new Registry({ onigLib: library, loadGrammar: () => ({ ...grammar, patterns: Array.from(grammar.patterns), repository: {} }) })
    const loadedGrammar = registry.loadGrammar(grammar.scopeName)
    assert(loadedGrammar)
    const resolved = normalizeTheme(workerThemeRegistration({ ...input, name: input.name ?? 'fixture' }))
    const tokenizer = createScopedLineTokenizer({ getLanguage: () => Object.assign(loadedGrammar, { name: 'native-theme' }), getTheme: () => resolved }, 'native-theme', input.name ?? 'fixture', maxLineLength)
    const tokens = tokenizer.tokenize(text, undefined).tokens
    assert(tokens.every(token => !('background' in token)), 'actual product token field set')
    const direct = tokens.map(token => {
      assert(typeof token.color === 'string' && typeof token.fontStyle === 'number')
      const { background: _background, ...style } = nativeThemeEffective(token.color, '#ffffff', token.fontStyle)
      return { from: token.offset, to: token.offset + token.content.length, style }
    })
    const scopes = tokens.map(token => ({ from: token.offset, to: token.offset + token.content.length, scopes: tokenScopes(token) }))
    return { text, direct, scopes, repaint: scopes.map(span => ({ from: span.from, to: span.to, style: observeNativeTheme(theme, span.scopes, profile).applied })) }
  }
  const registry = new upstream.Registry({ onigLib: Promise.resolve(library), loadGrammar: async () => upstream.parseRawGrammar(JSON.stringify(grammar), 'fixture.json') })
  try {
    const loadedGrammar = await registry.loadGrammar(grammar.scopeName)
    assert(loadedGrammar)
    registry.setTheme(input)
    const scopeResult = loadedGrammar.tokenizeLine(text, null)
    const packed = loadedGrammar.tokenizeLine2(text, null)
    assert(!scopeResult.stoppedEarly && !packed.stoppedEarly)
    const scopes = scopeResult.tokens.map(token => ({ from: token.startIndex, to: Math.min(token.endIndex, text.length), scopes: token.scopes }))
    const direct = Array.from({ length: packed.tokens.length / 2 }, (_, index) => ({
      from: packed.tokens[index * 2], to: Math.min(packed.tokens[index * 2 + 2] ?? text.length, text.length),
      style: decodeNativeThemeMetadata(packed.tokens[index * 2 + 1], registry.getColorMap()),
    }))
    return { text, direct, scopes, repaint: scopes.map(span => ({ from: span.from, to: span.to, style: observeNativeTheme(theme, span.scopes, profile).applied })) }
  } finally {
    registry.dispose()
  }
}

export function nativeThemeSpansEqual(left: readonly NativeThemeSpan[], right: readonly NativeThemeSpan[], length: number): boolean {
  if (!Number.isInteger(length) || length < 0) return false
  if (left.concat(right).some(span => span.from < 0 || span.to > length || span.from >= span.to)) return false
  const boundaries = Array.from(new Set([0, length].concat(left.flatMap(span => [span.from, span.to]), right.flatMap(span => [span.from, span.to]))))
  boundaries.sort((a, b) => a - b)
  return boundaries.slice(0, -1).every((from, index) => {
    const to = boundaries[index + 1]
    const a = left.filter(span => span.from <= from && span.to >= to)
    const b = right.filter(span => span.from <= from && span.to >= to)
    return a.length === 1 && b.length === 1 && isDeepStrictEqual(a[0].style, b[0].style)
  })
}

export const NATIVE_THEME_CONTROL_GRAMMAR: NativeThemeGrammar = {
  scopeName: 'source.native-theme', patterns: [{ begin: '\\(', end: '\\)', name: 'meta.parent', patterns: [
    { match: 'x', name: 'variable.clear' }, { match: 'y', name: 'variable.unset' },
  ] }],
}

export function nativeThemeStackGrammar(scopes: readonly string[]): { grammar: NativeThemeGrammar; text: string; at: number } {
  assert(scopes[0] === 'source.native-theme' && scopes.length > 0)
  let patterns: NativeThemeGrammarRule[] = [{ match: 'x' }]
  for (const scope of scopes.slice(1).toReversed()) patterns = [{ begin: '\\(', end: '\\)', name: scope, patterns }]
  return { grammar: { scopeName: 'source.native-theme', patterns }, text: '('.repeat(scopes.length - 1).concat('x', ')'.repeat(scopes.length - 1)), at: scopes.length - 1 }
}
