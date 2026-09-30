import type { LanguageRegistration } from 'shiki/core'
import { ResultBuilder } from '../build.ts'
import type { CompleteResult, ReferenceProfileId, Style } from '../schema.ts'
import { languageRegistrations, themeModule, type ThemeModule } from './assets.ts'
import { type LineSpan, SEPARATOR_SCOPES, SEPARATOR_STYLE, sourceLines, writeTrack } from './lines.ts'
import { PINS, pinLabel } from './pins.ts'
import { resolvedStyle } from './resolved-style.ts'
import type { GrammarSet, RawTheme, TextmateEngine, TextmateGrammar, TextmateState, TextmateToken } from './textmate.ts'

// Bit layout of vscode-textmate's EncodedTokenAttributes (src/encodedTokenAttributes.ts at the pinned
// commit), which the package does not export at runtime.
const FONT_STYLE_MASK = 0b0000_0000_0000_0000_0111_1000_0000_0000
const FONT_STYLE_OFFSET = 11
const FOREGROUND_MASK = 0b0000_0000_1111_1111_1000_0000_0000_0000
const FOREGROUND_OFFSET = 15

export const decodeForeground = (metadata: number): number => (metadata & FOREGROUND_MASK) >>> FOREGROUND_OFFSET
export const decodeFontStyle = (metadata: number): number => (metadata & FONT_STYLE_MASK) >>> FONT_STYLE_OFFSET

function checked<T extends { readonly stoppedEarly: boolean }>(result: T, line: number): T {
  if (result.stoppedEarly) throw new Error(`line ${line}: tokenization stopped early`)
  return result
}

/** Tokenizes every physical line, empty ones included, carrying the rule stack from line to line. */
export function tokenizeScopes(grammar: TextmateGrammar, lines: readonly string[]): (readonly TextmateToken[])[] {
  let state: TextmateState | null = null
  return lines.map((line, index) => {
    const result = checked(grammar.tokenizeLine(line, state), index)
    state = result.ruleStack
    return result.tokens
  })
}

/** Styles from the registry's current theme; a theme change needs a fresh pass from the initial state. */
export function tokenizeStyles(grammar: TextmateGrammar, lines: readonly string[], colorMap: readonly string[]): LineSpan<Style>[][] {
  let state: TextmateState | null = null
  return lines.map((line, index) => {
    const result = checked(grammar.tokenizeLine2(line, state), index)
    state = result.ruleStack
    const spans: LineSpan<Style>[] = []
    for (let token = 0; token < result.tokens.length; token += 2) {
      const metadata = result.tokens[token + 1] ?? 0
      const to = result.tokens[token + 2] ?? line.length + 1
      const color = colorMap[decodeForeground(metadata)] ?? ''
      spans.push({ from: result.tokens[token] ?? 0, to, value: resolvedStyle(color, decodeFontStyle(metadata)) })
    }
    return spans
  })
}

const FALLBACK = {
  dark: { foreground: '#bbbbbb', background: '#1e1e1e' },
  light: { foreground: '#333333', background: '#fffffe' },
} as const

/** VS Code's theme input: a default rule from the editor colours, then the theme's own rules. */
export function vscodeRawTheme(theme: ThemeModule): RawTheme {
  const fallback = FALLBACK[theme.type === 'light' ? 'light' : 'dark']
  const colors = theme.colors ?? {}
  const settings = {
    foreground: colors['editor.foreground'] ?? fallback.foreground,
    background: colors['editor.background'] ?? fallback.background,
  }
  return { name: theme.name, settings: [{ settings }, ...((theme.settings ?? theme.tokenColors ?? []) as RawThemeSetting[])] }
}

type RawThemeSetting = RawTheme['settings'][number]

const dottedPrefixes = (scopeName: string): string[] =>
  scopeName.split('.').map((_part, index, parts) => parts.slice(0, index + 1).join('.'))

/** The product's registration closure: first registration per scope wins; injectTo applies to every dotted prefix. */
export function registrationGrammarSet(grammar: string, registrations: readonly LanguageRegistration[]): GrammarSet {
  const byScope = new Map<string, LanguageRegistration>()
  for (const registration of registrations) {
    if (!byScope.has(registration.scopeName)) byScope.set(registration.scopeName, registration)
  }
  const root = registrations.find((registration) => registration.name === grammar)
  if (root === undefined) throw new Error(`the ${grammar} module does not register a grammar named ${grammar}`)
  return {
    rootScope: root.scopeName,
    grammar: (scopeName) => byScope.get(scopeName),
    injections: (scopeName) => {
      const prefixes = dottedPrefixes(scopeName)
      const injectors = [...byScope.values()].filter((entry) => entry.injectTo?.some((target) => prefixes.includes(target)))
      return injectors.length === 0 ? undefined : injectors.map((entry) => entry.scopeName)
    },
  }
}

export async function loadRootGrammar(engine: TextmateEngine, grammars: GrammarSet) {
  const registry = engine.createRegistry(grammars)
  const grammar = await registry.loadGrammar(grammars.rootScope)
  if (grammar === null) throw new Error(`no grammar for ${grammars.rootScope}`)
  return { registry, grammar }
}

export interface RawDocumentRequest {
  readonly profileId: ReferenceProfileId
  readonly languageId: string
  readonly source: string
  readonly themeIds: readonly string[]
}

export async function rawDocument(engine: TextmateEngine, request: RawDocumentRequest): Promise<CompleteResult> {
  const grammars = registrationGrammarSet(request.languageId, await languageRegistrations(request.languageId))
  const { registry, grammar } = await loadRootGrammar(engine, grammars)
  const lines = sourceLines(request.source)
  const texts = lines.map((line) => line.text)
  const identity = {
    ...engine.identity,
    grammars: pinLabel(PINS.langs),
    themes: pinLabel(PINS.themes),
    themeInput: 'editor.foreground/background default rule, then tokenColors',
    lines: 'LF and CRLF terminators; every line tokenized, state carried',
  }
  const builder = new ResultBuilder({ profileId: request.profileId, languageId: request.languageId, engine: identity }, request.source)
  const scopes = tokenizeScopes(grammar, texts)
  const scopeSpans = (line: number) => (scopes[line] ?? []).map((token) => ({ from: token.startIndex, to: token.endIndex, value: token.scopes }))
  writeTrack(lines, scopeSpans, (from, to, value) => builder.scope(from, to, value), SEPARATOR_SCOPES)
  for (const themeId of request.themeIds) {
    registry.setTheme(vscodeRawTheme(await themeModule(themeId)))
    const styles = tokenizeStyles(grammar, texts, registry.getColorMap())
    writeTrack(lines, (line) => styles[line] ?? [], (from, to, value) => builder.style(themeId, from, to, value), SEPARATOR_STYLE)
  }
  return builder.complete()
}
